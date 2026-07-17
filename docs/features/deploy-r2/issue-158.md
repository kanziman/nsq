# Issue #158: [deploy S1] 오디오 R2 스트리밍 전환 및 오디오 API 라우트 제거

부모: #157 (배포 전략 전환 — R2 하이브리드)의 수직 슬라이스 S1.

## 1. 구현 대상 (시그니처 및 변경)

### `src/lib/utils/audio-url.ts` (NEW)

```ts
export function buildAudioUrl(episodeId: string, baseUrl?: string): string;
```

- `episodeId`: 유튜브 videoId
- `baseUrl?`: R2 공개 base URL. 기본값 `process.env.NEXT_PUBLIC_R2_BASE_URL ?? ''`
- 반환: `${정규화된_base}/${episodeId}/audio.mp3`

**동작 / 에러 정책**

- base 정규화: 끝의 `/`(복수 포함)를 제거한 뒤 조립 → 이중 슬래시 방지
- base 빈값(로컬 미설정): `console.warn` 경고 후 `/${episodeId}/audio.mp3` 반환. 재생은 불가하나 빌드·타입체크는 정상(AC3)
- 순수 함수 — 예외를 던지지 않는다. 로컬·프로덕션 모두 R2 URL 사용

### 영향받는 지점

- **`src/hooks/useShadowingPlayer.ts:124`**: `createAudioManager(\`/api/episodes/${episodeId}/audio\`)`→`createAudioManager(buildAudioUrl(episodeId))`
- **`src/components/player/shadowing-player.tsx:80`**: `useWaveform(\`/api/episodes/${episode.id}/audio\`, ...)`→`useWaveform(buildAudioUrl(episode.id), ...)`
- **삭제**: `src/app/api/episodes/[id]/audio/route.ts` + `route.test.ts` (AC2)
- **`.env.example`**: `NEXT_PUBLIC_R2_BASE_URL` 항목 추가(값 예시/설명)

### 범위 밖 (다른 슬라이스)

- 실제 R2 업로드·퍼블리시 스크립트 → S4
- meta/segments 정적화 → S2
- 임포트 가드 → S3

## 2. 테스트 시나리오

### [정상]

- [정상] buildAudioUrl — should return `${base}/${id}/audio.mp3` when baseUrl is provided
- [정상] buildAudioUrl — should read baseUrl from NEXT_PUBLIC_R2_BASE_URL when arg omitted
- [정상] buildAudioUrl — should compose URL for a typical youtube videoId

### [경계]

- [경계] buildAudioUrl — should strip a single trailing slash from baseUrl before composing
- [경계] buildAudioUrl — should strip multiple trailing slashes from baseUrl
- [경계] buildAudioUrl — should not produce double slashes between base and id

### [예외]

- [예외] buildAudioUrl — should warn and return root-relative `/${id}/audio.mp3` when baseUrl is empty
- [예외] buildAudioUrl — should warn and return root-relative path when NEXT_PUBLIC_R2_BASE_URL is unset
- [예외] buildAudioUrl — should not throw when baseUrl is empty (build/type safety, AC3)

## 3. AC ↔ 시나리오 교차 대조

| AC                                       | 커버하는 시나리오                       |
| :--------------------------------------- | :-------------------------------------- |
| AC1: R2 URL로 요청 (내부 API 아님)       | 정상 1·3, 호출부 교체 검증              |
| AC2: 오디오 라우트 부재                  | route.ts/route.test.ts 삭제 (구조 검증) |
| AC3: 미설정 시 빌드·타입 안전, 예측 가능 | 예외 1·2·3                              |
| AC4: URL 조립 단위 테스트 존재           | 정상·경계·예외 전체                     |
