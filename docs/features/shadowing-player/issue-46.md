# Issue #46 — 플레이어 페이지 진입 + 화자별 스크립트 정적 렌더

> Slice 1 · 의존성: 없음(기반) · 흡수 유틸: `utils-time`
> AC1 렌더 / AC2 리다이렉트 / AC3 segments API

---

## 1. 시그니처 명세 (승인됨)

### ① `src/lib/utils/time.ts`

```ts
// 초 → "mm:ss" (3600초 이상이면 "h:mm:ss"). 음수·NaN·Infinity → "00:00"
export function formatTime(seconds: number): string;

// "HH:MM:SS.mmm" | "MM:SS.mmm" (쉼표 소수점 허용) → 초(number)
// 형식 불일치 시 throw new Error('Invalid VTT timecode: ...')
export function parseVttTimecode(timecode: string): number;
```

### ② `GET /api/episodes/[id]/segments` — `src/app/api/episodes/[id]/segments/route.ts`

```ts
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response>;
// getEpisodeById(id) null → 404
// status ∈ {downloading,processing_subtitles,processing_transcript,aligning,translating} → 409
// 그 외 → 200 + Segment[] (getEpisodeSegments) / 예외 → 500
```

### ③ `src/app/episodes/[id]/page.tsx` (RSC)

```ts
export default async function EpisodePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement>;
// 로드: getEpisodeById(id) + getEpisodeSegments(id)
// redirect('/') 조건: episode === null || status !== 'completed' || segments.length === 0
// 통과 시: 상단 dark 플레이어 골격 + 하단 ScriptView(segments) + 우측 튜터 골격
```

### ④ `src/components/player/ScriptView.tsx`

```ts
interface ScriptViewProps {
  segments: Segment[];
  currentSegmentIndex?: number; // 강조(Issue 2+). 미지정 시 강조 없음
  onSegmentClick?: (index: number) => void; // 클릭(Issue 4+)
}
export default function ScriptView(props: ScriptViewProps): React.ReactElement;
// Issue 1: SPEAKER_COLORS[speaker] 색상 + 화자명 + text + formatTime(start) 타임코드 정적 렌더
// optional props는 타입에 존재하되 동작 구현/검증은 후속 이슈(2·4)로 이연
```

### ⑤ `scripts/seed-episode.ts`

```ts
export async function seedEpisode(options?: {
  id?: string; // 기본 'mock-episode'
  segmentCount?: number; // 기본 10
  status?: ImportState['status']; // 기본 'completed'
  baseDir?: string; // 기본 process.cwd()/.shadowing/episodes
}): Promise<{ id: string; dir: string }>;
// meta.json / import-state.json / segments.json / audio.mp3(stub) 생성
// CLI: npx tsx scripts/seed-episode.ts
```

### 설계 노트

- `getEpisodeSegments`는 부재·빈 배열을 모두 `[]`로 반환 → 구분 불가. **AC2 우선**으로 "세그먼트 0개(부재·빈) → redirect" 단순화(spec-fixed §5 "빈 세그먼트 안내" 폐기).
- segments **API**는 redirect 없이 completed면 `200 []`도 허용(페이지 가드가 UX 처리).

---

## 2. 테스트 시나리오 (정상/경계/예외)

### `formatTime`

- [정상] formatTime — should return "mm:ss" when seconds < 3600 (예: 65 → "01:05")
- [정상] formatTime — should return "h:mm:ss" when seconds >= 3600 (예: 3661 → "1:01:01")
- [경계] formatTime — should return "00:00" when seconds is 0
- [예외] formatTime — should return "00:00" when seconds is negative
- [예외] formatTime — should return "00:00" when seconds is NaN or Infinity

### `parseVttTimecode`

- [정상] parseVttTimecode — should parse "MM:SS.mmm" to seconds (예: "01:05.500" → 65.5)
- [정상] parseVttTimecode — should parse "HH:MM:SS.mmm" to seconds (예: "01:01:01.000" → 3661)
- [경계] parseVttTimecode — should accept comma decimal (예: "00:01,500" → 1.5)
- [예외] parseVttTimecode — should throw Error when format is invalid (예: "abc")

### `GET /api/episodes/[id]/segments`

- [정상] GET segments — should return 200 with Segment[] when episode is completed
- [경계] GET segments — should return 200 with [] when completed episode has no segments
- [예외] GET segments — should return 404 when episode does not exist
- [예외] GET segments — should return 409 when import is in progress

### `EpisodePlayerPage` (RSC)

- [정상] EpisodePlayerPage — should render ScriptView with segments when episode is completed and has segments
- [예외] EpisodePlayerPage — should redirect to '/' when episode does not exist (null)
- [예외] EpisodePlayerPage — should redirect to '/' when status is not 'completed' (진행중·실패)
- [경계] EpisodePlayerPage — should redirect to '/' when segments.length === 0

### `ScriptView`

- [정상] ScriptView — should render each segment's text, speaker name, and timecode (formatTime(start))
- [정상] ScriptView — should apply speaker color class (SPEAKER_COLORS[speaker]) per segment
- [경계] ScriptView — should render without error when currentSegmentIndex/onSegmentClick are omitted

### `seedEpisode`

- [정상] seedEpisode — should create meta.json / import-state.json / segments.json / audio.mp3 under baseDir/id
- [정상] seedEpisode — should generate `segmentCount` segments with valid Segment shape (valid speaker keys)
- [경계] seedEpisode — should use defaults (id='mock-episode', count=10, status='completed') when options omitted
- [정상] seedEpisode — should write import-state.json with given status when status option provided

---

## 3. AC ↔ 시나리오 교차 대조

| AC                               | 커버 시나리오                                                                               |
| :------------------------------- | :------------------------------------------------------------------------------------------ |
| **AC1** 화자색·타임코드 렌더     | ScriptView(text/speaker/timecode, color class) + EpisodePlayerPage(정상) + formatTime(정상) |
| **AC2** 미충족 시 redirect       | EpisodePlayerPage(null / status≠completed / segments 0)                                     |
| **AC3** segments API 200/404/409 | GET segments(200 / 200 [] / 404 / 409) + seedEpisode(mock 데이터)                           |

→ 모든 AC가 1개 이상 시나리오로 커버됨.
