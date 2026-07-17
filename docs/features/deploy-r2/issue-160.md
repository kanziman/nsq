# Issue #160: [deploy S2] 조회 데이터 public 정적화 및 상세 페이지 SSG 전환

부모: #157 (배포 전략 전환 — R2 하이브리드)의 수직 슬라이스 S2.

## 1. 구현 대상 (시그니처 및 변경)

### `src/lib/services/episodes.ts`

```ts
const READ_BASE = path.join(process.cwd(), 'public', 'episodes'); // 조회 소스 (신규)
const WRITE_BASE = path.join(process.cwd(), '.shadowing', 'episodes'); // 임포트 쓰기 (기존 BASE_DIR)

export async function getEpisodes(baseDir?: string): Promise<Episode[]>;
export async function getEpisodeById(
  id: string,
  baseDir?: string,
): Promise<Episode | null>;
export async function getEpisodeSegments(
  id: string,
  baseDir?: string,
): Promise<Segment[]>;
```

- 조회 3함수는 `baseDir` 기본값 `READ_BASE`. 명시 주입 시 fixture 디렉토리로 테스트 가능.
- 쓰기 함수(`saveImportState`/`deleteEpisode`/`getImportState`)는 `WRITE_BASE` 유지 — 변경 없음.

### `src/app/episodes/[id]/page.tsx`

```ts
export async function generateStaticParams(): Promise<{ id: string }[]>;
// getEpisodes()로 published 에피소드 id 목록을 얻어 정적 생성 파라미터로 반환
```

### `src/components/episode/EpisodeDashboard.tsx`

- `fetch('/api/episodes')` → `fetch('/episodes/index.json')` (정적 자산, 반환 `Episode[]`)

### 삭제

- `src/app/api/episodes/route.ts` (GET 목록)
- `src/app/api/episodes/[id]/segments/route.ts` (GET 세그먼트)
- 각 route.test.ts

### 범위 밖 (다른 슬라이스)

- 로컬 임포트 진행률 폴링·삭제·대시보드 이중성, Production 임포트 가드 → S3
- `.shadowing → public` 복사 + `index.json` 생성 publish 스크립트, R2 오디오 업로드 → S4

## 2. 테스트 시나리오

### [정상]

- [정상] getEpisodes — should return episodes from given baseDir sorted by addedAt desc
- [정상] getEpisodeById — should return episode from meta.json in given baseDir
- [정상] getEpisodeSegments — should return segments from segments.json in given baseDir
- [정상] getEpisodeSegments — should attach wordStarts when subtitle vtt present in baseDir
- [정상] generateStaticParams — should return id params for each published episode
- [정상] EpisodeDashboard — should load list from /episodes/index.json

### [경계]

- [경계] getEpisodes — should return empty array when baseDir has no episode dirs
- [경계] getEpisodeById — should return null when episode dir absent in baseDir
- [경계] getEpisodeSegments — should return empty array when segments.json absent
- [경계] generateStaticParams — should return empty array when no episodes published

### [예외]

- [예외] getEpisodes — should return empty array when baseDir does not exist
- [예외] getEpisodeSegments — should return raw segments when vtt parse fails
- [예외] EpisodeDashboard — should show error when index.json fetch fails

### [구조 — AC4]

- [정상] api removal — should not have /api/episodes GET route file
- [정상] api removal — should not have /api/episodes/[id]/segments route file

## 3. AC ↔ 시나리오 교차 대조

| AC                             | 커버하는 시나리오                                  |
| :----------------------------- | :------------------------------------------------- |
| AC1: 조회 서비스가 public 읽기 | getEpisodes/ById/Segments의 baseDir 정상·경계·예외 |
| AC2: 상세 SSG, 런타임 fs 없음  | generateStaticParams 정상·경계 + 빌드 검증(AC5)    |
| AC3: 대시보드 index.json 로드  | EpisodeDashboard 정상·예외                         |
| AC4: 조회 API 부재             | api removal 구조 테스트 2건                        |
| AC5: build 성공·정적 생성      | 빌드 로그 검증(통합, green 단계에서 확인)          |
