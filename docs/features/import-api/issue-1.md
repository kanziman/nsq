# Issue #1 — `POST /api/import` 접수·검증·초기 상태 생성

> 근거: [issues.md](./issues.md) · [prd.md](./prd.md) · [spec-fixed.md](./spec-fixed.md)
> 본 문서는 구현 전 **시그니처 확정 + 테스트 시나리오**를 영속화한다. (TDD 입력)

---

## 1. 확정 시그니처 (Signatures)

### 1-1. videoId 추출 유틸 (신규)

**파일**: `src/lib/utils/youtube.ts`

```ts
/**
 * YouTube URL에서 videoId를 추출한다.
 * 지원 포맷: watch?v=ID, youtu.be/ID, /embed/ID, /shorts/ID 등
 * @returns 추출된 videoId, 추출 불가 시 null (throw 하지 않음 → 호출부가 400으로 변환)
 */
export function extractVideoId(url: string): string | null;
```

### 1-2. 요청 바디 타입 (신규)

**파일**: `src/lib/types.ts` 에 추가

```ts
export type RetryStep = 'all' | 'transcript' | 'subtitles';

export interface ImportRequestBody {
  youtubeUrl: string; // 필수
  transcriptUrl: string; // 필수
  retryStep?: RetryStep; // 선택 (Issue 1에서는 409 분기 우회에만 사용)
}
```

### 1-3. 상태 조회·기록 헬퍼 (episodes.ts 확장)

**파일**: `src/lib/services/episodes.ts`

```ts
/** videoId의 현재 import-state.json을 읽는다. 없으면 null. */
export async function getImportState(
  videoId: string,
): Promise<ImportState | null>;

/** 초기/갱신 import-state.json을 기록한다 (디렉토리 없으면 생성). */
export async function saveImportState(
  videoId: string,
  state: ImportState,
): Promise<void>;
```

> `getImportState`는 기존 `readJson` 헬퍼 재사용. `saveImportState`는 Issue 1이 초기 상태 파일을
> 생성하기 위한 최소 write 헬퍼이며, 단계별 상세 갱신 로직(`import-state` 모듈)은 후속 태스크 범위.

### 1-4. 파이프라인 오케스트레이터 스텁 (신규, no-op)

**파일**: `src/lib/services/import-pipeline.ts`

```ts
/**
 * 임포트 파이프라인 오케스트레이터.
 * Issue 1에서는 호출 계약만 존재하는 no-op 스텁. 실제 단계 구현은 Issue 2.
 */
export async function runImportPipeline(
  videoId: string,
  urls: { youtubeUrl: string; transcriptUrl: string; retryStep?: RetryStep },
): Promise<void>;
```

### 1-5. 라우트 핸들러 (신규)

**파일**: `src/app/api/import/route.ts`

```ts
export async function POST(request: Request): Promise<Response>;
```

**처리 순서**

1. JSON 바디 파싱 → 실패 시 `400`
2. `youtubeUrl`·`transcriptUrl` 타입/빈값 검증 → 실패 시 `400`
3. `extractVideoId(youtubeUrl)` → `null`이면 `400` (**상태 파일 생성 안 함**)
4. `getImportState(videoId)`로 중복 검사 (`retryStep` 없을 때):
   - 진행중(`downloading`/`processing_subtitles`/`processing_transcript`/`aligning`) 또는 `completed` → `409`
   - `failed`/없음 → 진행
5. 초기 `import-state.json` 기록 (`status: 'downloading'`, `progress: 0`, `currentStep: 'download'`, `updatedAt`)
6. `runImportPipeline(...)`를 **`await` 없이** 호출 (fire-and-forget)
7. `202 { videoId, status: 'downloading' }` 반환
8. 예기치 못한 예외 → `500 { error }`

**에러/응답 매핑**

| 상황                                               | 코드  | 바디                                 |
| -------------------------------------------------- | ----- | ------------------------------------ |
| 정상 수락                                          | `202` | `{ videoId, status: 'downloading' }` |
| 바디 파싱 실패 / 빈값·비문자열 / videoId 추출 불가 | `400` | `{ error }`                          |
| 진행중·완료 중복 (retryStep 없음)                  | `409` | `{ error, videoId, status }`         |
| 서버 내부 오류                                     | `500` | `{ error }`                          |

---

## 2. 테스트 시나리오 (Test Scenarios)

> 포맷: `[정상/경계/예외] 대상 — should [기대동작] when [조건]`
> 모듈(오케스트레이터)·파일시스템은 테스트 더블/임시 디렉토리로 대체해 결정적으로 검증한다.

### [정상]

- [x] `[정상] extractVideoId — should return videoId when given a watch?v= URL`
- [x] `[정상] extractVideoId — should return videoId when given a youtu.be/ short URL`
- [x] `[정상] POST /api/import — should return 202 with { videoId, status: 'downloading' } when youtubeUrl and transcriptUrl are valid`
- [x] `[정상] POST /api/import — should create import-state.json with status 'downloading', progress 0, currentStep 'download' when request is accepted`
- [x] `[정상] POST /api/import — should call runImportPipeline without awaiting (fire-and-forget) after responding 202`
- [x] `[정상] POST /api/import — should return 202 and start fresh when existing state status is 'failed'`
- [x] `[정상] POST /api/import — should return 202 and start fresh when no existing state exists for videoId`

### [경계]

- [x] `[경계] extractVideoId — should still extract videoId when URL has extra query params (e.g., &t=30s, &list=...)`
- [x] `[경계] extractVideoId — should extract videoId from /embed/ID and /shorts/ID formats`
- [x] `[경계] POST /api/import — should return 409 for each in-progress status (downloading, processing_subtitles, processing_transcript, aligning) when retryStep is absent`
- [x] `[경계] POST /api/import — should return 400 when transcriptUrl is whitespace-only (treated as empty)`
- [x] `[경계] POST /api/import — should bypass 409 and proceed when retryStep is present even though existing state is 'completed' (retry path entry; execution covered in Issue 3)`

### [예외]

- [x] `[예외] extractVideoId — should return null when url is not a valid YouTube URL`
- [x] `[예외] extractVideoId — should return null when url is empty string or non-string`
- [x] `[예외] POST /api/import — should return 400 and NOT create import-state.json when videoId extraction fails`
- [x] `[예외] POST /api/import — should return 400 when transcriptUrl is an empty string`
- [x] `[예외] POST /api/import — should return 400 when youtubeUrl is missing or non-string`
- [x] `[예외] POST /api/import — should return 400 when transcriptUrl is missing or non-string`
- [x] `[예외] POST /api/import — should return 400 when request body is not valid JSON`
- [x] `[예외] POST /api/import — should return 409 with current status when existing state is 'completed' and retryStep is absent`
- [x] `[예외] POST /api/import — should return 409 with { error, videoId, status } when existing state is in progress ('downloading') and retryStep is absent`
- [x] `[예외] POST /api/import — should return 500 when saveImportState throws unexpectedly`

---

## 3. Acceptance Criteria 교차 대조 (6단계)

`gh issue view 1`의 AC ↔ 위 시나리오 1:1 매핑. 모든 AC가 ≥1개 시나리오로 커버됨.

| AC                                                                                   | 커버 시나리오                                                                                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC1: 유효 입력 → `202` + `{videoId}` + `import-state.json` `status: downloading`     | `[정상] POST … should return 202 with { videoId, status: 'downloading' }`, `[정상] POST … should create import-state.json with status 'downloading' …` |
| AC2: videoId 추출 불가 → `400` + 상태 파일 미생성                                    | `[예외] POST … should return 400 and NOT create import-state.json when videoId extraction fails`, `[예외] extractVideoId … should return null …`       |
| AC3: 빈 transcriptUrl → `400`                                                        | `[예외] POST … should return 400 when transcriptUrl is an empty string`, `[경계] POST … whitespace-only transcriptUrl → 400`                           |
| AC4: 진행중(`downloading`) 또는 `completed` (retryStep 없음) → `409` + 현재 `status` | `[예외] POST … 409 with current status when … 'completed' …`, `[예외] POST … 409 … in progress ('downloading') …`, `[경계] POST … each in-progress …`  |
| AC5: `failed` 또는 미존재 → `202` 신규 시작                                          | `[정상] POST … start fresh when existing state status is 'failed'`, `[정상] POST … start fresh when no existing state exists`                          |

> 결론: 5개 AC 모두 대응 시나리오 존재. AC 미커버로 인한 신규 추가 시나리오 없음.

---

## 4. 알려진 갭 / 후속 범위 (의도된 슬라이싱)

> 결정(2026-06-25): Issue 1은 **라우트 검증·분기 로직 슬라이스**로 종료한다. 협력 모듈의 실제 구현은
> 의도적으로 후속 태스크로 분리한다(`issues.md` L9 "모듈은 테스트 더블로 대체" 원칙). 아래 갭은
> ac-verifier 독립 검증으로 확인되었으며 **수용된 상태**다.

**현재 상태**

- `src/lib/services/episodes.ts`의 `getImportState`/`saveImportState`, `src/lib/services/import-pipeline.ts`의
  `runImportPipeline`은 아직 `throw new Error('Not implemented')` 스텁이다.
- 라우트 단위 테스트(22/22 green)는 이 세 모듈을 `vi.mock`으로 대체하므로 **분기·상태코드·응답바디는 검증되나,
  실제 디스크 기록(`import-state.json` 생성)·중복 차단·파이프라인 기동은 검증되지 않는다.**
- 따라서 **정상 입력에 대해 실제 HTTP 엔드포인트는 런타임에서 `500`을 반환**한다(saveImportState throw → catch → 500).
  즉 AC1·AC4·AC5의 부수효과(생성/차단/신규시작)는 "단위 green, 런타임 미동작" 상태다. (AC2·AC3는 영향 없음 — 완전 충족)

**후속 태스크에서 닫을 갭**

- (episodes 모듈 태스크) `getImportState`/`saveImportState` 실구현 + 자체 단위 테스트(디렉토리 자동생성,
  파일 부재 시 null, 손상 JSON 안전 처리, save→get round-trip).
- (Issue 2) `runImportPipeline` 실구현 및 fire-and-forget 연동.
- (통합 테스트) 임시 `BASE_DIR`로 모킹 없이 POST → 실제 `import-state.json` 파일 존재·내용 검증, 디스크 기반 409 round-trip.
