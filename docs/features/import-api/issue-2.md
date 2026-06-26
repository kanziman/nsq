# Issue #2 — 파이프라인 오케스트레이션: 단계 상태 전이 · matchRate 검증 · 실패 처리

> 근거: [issues.md](./issues.md) · [prd.md](./prd.md) · [spec-fixed.md](./spec-fixed.md)
> 본 문서는 구현 전 **시그니처 확정 + 테스트 시나리오**를 영속화한다. (TDD 입력)
> 범위 확정(2026-06-25): 오케스트레이터 + 단계 모듈 인터페이스 + (Issue 1에서 미룬) `save`/`getImportState` **실제 구현**.

---

## 1. 확정 시그니처 (Signatures)

### 1-1. 단계 모듈 인터페이스 (신규 — 후속 모듈 계약)

**파일**: `src/lib/services/import/youtube.ts`, `src/lib/services/import/transcript.ts`, `src/lib/services/import/alignment.ts`
각 step의 산출 아티펙트는 `.shadowing/episodes/{videoId}/` 하위에 기록된다. 내부 구현(yt-dlp·스크래핑·정합)은 각각 **별도 태스크**이며 본 이슈에서는 시그니처 stub만 둔다.

```ts
// src/lib/services/import-pipeline.ts (또는 별도 types) 에 계약 정의
export interface PipelineSteps {
  /** download: youtubeUrl → audio.mp3 */
  downloadAudio(videoId: string, youtubeUrl: string): Promise<void>;
  /** subtitle: youtubeUrl → subtitle.en.vtt */
  fetchSubtitle(videoId: string, youtubeUrl: string): Promise<void>;
  /** transcript: transcriptUrl → transcript.txt */
  fetchTranscript(videoId: string, transcriptUrl: string): Promise<void>;
  /** alignment: subtitle.en.vtt + transcript.txt → segments.json, matchRate 반환 */
  alignTranscript(videoId: string): Promise<{ matchRate: number }>;
}
```

### 1-2. 오케스트레이터 (Issue 1 스텁 → 실제 구현)

**파일**: `src/lib/services/import-pipeline.ts`

```ts
export async function runImportPipeline(
  videoId: string,
  urls: { youtubeUrl: string; transcriptUrl: string; retryStep?: RetryStep },
  steps?: PipelineSteps, // 테스트 더블 주입용(DI). 미주입 시 실제 모듈(기본값)
): Promise<void>;
```

**처리 순서** (retryStep 분기는 Issue 3 — 본 이슈는 항상 전체 실행)

1. `download` 단계 상태 기록 → `downloadAudio(videoId, youtubeUrl)`
2. `subtitle` 단계 상태 기록 → `fetchSubtitle(videoId, youtubeUrl)`
3. `transcript` 단계 상태 기록 → `fetchTranscript(videoId, transcriptUrl)`
4. `alignment` 단계 상태 기록 → `alignTranscript(videoId)` → `matchRate`
5. `matchRate < 0.85` → `failed` 처리(아티펙트 유지) 후 종료
6. 성공 → `completed`(progress 100)
7. **임의 단계 throw** → `catch`에서 `failed` + 실패한 `currentStep` + `error`(메시지) 기록, 아티펙트 유지, **재-throw 안 함**(fire-and-forget 안전)

**상수**: `MATCH_RATE_THRESHOLD = 0.85` — **이상(≥)이면 통과** (CLAUDE.md/spec-fixed §5 정책 일치)

**단계 ↔ 상태 매핑**

| 단계/결과        | `status`                | `currentStep` | `progress` |
| ---------------- | ----------------------- | ------------- | ---------- |
| download         | `downloading`           | `download`    | 10         |
| subtitle         | `processing_subtitles`  | `subtitle`    | 40         |
| transcript       | `processing_transcript` | `transcript`  | 70         |
| alignment        | `aligning`              | `alignment`   | 90         |
| 성공             | `completed`             | `completed`   | 100        |
| matchRate < 0.85 | `failed`                | `alignment`   | (유지)     |
| 임의 단계 throw  | `failed`                | 실패한 단계   | (유지)     |

> `progress` 수치는 단조 증가 예시값. 테스트는 정확값이 아니라 **status·currentStep 전이 순서**와 `completed=100`만 검증한다(브리틀 방지).

### 1-3. 상태 조회·기록 헬퍼 (episodes.ts — Issue 1 스텁의 실제 구현)

**파일**: `src/lib/services/episodes.ts`

```ts
/** videoId의 현재 import-state.json을 읽는다. 없거나 손상 시 null. (기존 readJson 재사용) */
export async function getImportState(
  videoId: string,
): Promise<ImportState | null>;

/** import-state.json을 기록한다. 디렉토리 없으면 생성(ensureDir). */
export async function saveImportState(
  videoId: string,
  state: ImportState,
): Promise<void>;
```

> 본 이슈에서 실제 구현하여 Issue 1 §4 "런타임 미동작" 갭을 닫는다. 오케스트레이터는 각 전이마다
> `saveImportState`를 호출하며 `updatedAt`을 갱신한다. 검증은 **실제 `import-state.json` 파일**을
> 테스트 전용 `videoId` 디렉토리에 기록 후 읽어 수행하고 `afterEach`에서 정리한다.

### 1-4. 실패/아티펙트 정책 (spec-fixed §3-6 준수)

- 실패 시 **아티펙트 미삭제**(롤백 없음). `deleteEpisode` 등 삭제를 호출하지 않는다.
- `error`는 사람이 읽을 수 있는 문자열. matchRate 실패는 `"matchRate 0.72 < 0.85"` 형태로 수치 포함.

---

## 2. 테스트 시나리오 (Test Scenarios)

> 포맷: `[정상/경계/예외] 대상 — should [기대동작] when [조건]`
> 단계 모듈은 **DI 더블 주입**, 상태는 **실제 import-state.json 파일**(테스트 videoId + cleanup)로 결정적 검증.

### [정상]

- [x] `[정상] runImportPipeline — should transition status/currentStep through download→subtitle→transcript→alignment in order when all steps succeed`
- [x] `[정상] runImportPipeline — should end with status 'completed' and progress 100 when all steps succeed`
- [x] `[정상] runImportPipeline — should call each step exactly once in download→subtitle→transcript→alignment order when all steps succeed`
- [x] `[정상] runImportPipeline — should invoke alignTranscript (producer of segments.json) when the alignment stage is reached`
- [x] `[정상] saveImportState — should write import-state.json and create the directory when it does not exist`
- [x] `[정상] getImportState — should return the persisted ImportState when import-state.json exists`

### [경계]

- [x] `[경계] runImportPipeline — should mark status 'failed' with currentStep 'alignment' and error containing '0.72 < 0.85' when alignTranscript returns matchRate 0.72`
- [x] `[경계] runImportPipeline — should treat matchRate exactly 0.85 as success (completed) since threshold is inclusive`
- [x] `[경계] runImportPipeline — should mark status 'failed' when alignTranscript returns matchRate 0.84 (just below threshold)`
- [x] `[경계] runImportPipeline — should keep downloaded artifacts (not delete the episode dir) when failing on low matchRate`
- [x] `[경계] runImportPipeline — should not call subsequent steps after a failing step (transcript/alignment not called when fetchSubtitle throws)`
- [x] `[경계] getImportState — should return null when import-state.json does not exist`

### [예외]

- [x] `[예외] runImportPipeline — should set status 'failed' with currentStep 'download' and recorded error when downloadAudio throws`
- [x] `[예외] runImportPipeline — should set status 'failed' with currentStep 'subtitle' and recorded error when fetchSubtitle throws`
- [x] `[예외] runImportPipeline — should set status 'failed' with currentStep 'transcript' and recorded error when fetchTranscript throws`
- [x] `[예외] runImportPipeline — should set status 'failed' with currentStep 'alignment' and recorded error when alignTranscript throws`
- [x] `[예외] runImportPipeline — should resolve (not throw) even when a step throws, so the fire-and-forget caller stays safe`
- [x] `[예외] runImportPipeline — should keep artifacts (not delete) when a step throws`
- [x] `[예외] runImportPipeline — should record the thrown value in error when a step throws a non-Error (string)`
- [x] `[예외] getImportState — should return null when import-state.json is corrupt/invalid JSON`

---

## 3. Acceptance Criteria 교차 대조

`gh issue view 2`의 AC ↔ 위 시나리오 매핑. 모든 AC가 ≥1개 시나리오로 커버됨.

| AC                                                                                                                      | 커버 시나리오                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1: 모든 step 성공 → `currentStep` download→subtitle→transcript→alignment 전이, 최종 `completed`, `segments.json` 생성 | `[정상] … transition … in order`, `[정상] … completed and progress 100`, `[정상] … each step exactly once …`, `[정상] … invoke alignTranscript …` |
| AC2: alignment `matchRate 0.72` → `failed`, `currentStep: alignment`, `error`에 `0.72 < 0.85`, 아티펙트 미삭제          | `[경계] … failed … error containing '0.72 < 0.85'`, `[경계] … keep downloaded artifacts …`                                                        |
| AC3: 임의 step throw → `failed` + 해당 `currentStep` + `error`, 아티펙트 유지                                           | `[예외] … download/subtitle/transcript/alignment throws`, `[예외] … keep artifacts when a step throws`                                            |
| AC4: 라우트 `202` 직후 폴링 시 진행 상태 갱신(fire-and-forget 동작)                                                     | `[예외] … resolve (not throw) … fire-and-forget`, `[정상] … transition … in order`(점진적 상태 기록) + Issue 1 route fire-and-forget 테스트       |

> 결론: 4개 AC 모두 대응 시나리오 존재. AC4의 "라우트 202 즉시 반환"은 Issue 1 `route.test.ts`에서 이미 검증되며, 본 이슈는 그 사이 **상태가 점진적으로 갱신됨**과 **오케스트레이터가 throw하지 않음**을 보강한다.
