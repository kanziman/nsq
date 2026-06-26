# Issue #3 — retryStep 부분 재시도 (아티펙트 재사용)

> 근거: [issues.md](./issues.md) · [prd.md](./prd.md) · [spec-fixed.md](./spec-fixed.md) §3-3
> 본 문서는 구현 전 **시그니처 확정 + 테스트 시나리오**를 영속화한다. (TDD 입력)
> 범위 확정(2026-06-26): 라우트의 `retryStep` 409 우회·전달은 Issue 1에서 완료 → **본 이슈는 오케스트레이터 분기 로직**.

---

## 1. 확정 시그니처 (Signatures)

### 1-1. 오케스트레이터 — 시그니처 **변경 없음**

**파일**: `src/lib/services/import-pipeline.ts`

```ts
export async function runImportPipeline(
  videoId: string,
  urls: { youtubeUrl: string; transcriptUrl: string; retryStep?: RetryStep },
  steps?: PipelineSteps,
): Promise<void>;
```

`urls.retryStep`을 읽어 내부 분기. 새 함수/파라미터 없음. 라우트는 손대지 않는다(Issue 1에서 완성: retryStep present → 409 우회 + retryStep 전달).

### 1-2. 단계 실행 매트릭스 (spec-fixed §3-3)

| retryStep         | download | subtitle | transcript | alignment | 사전 존재 필요(재사용)         |
| ----------------- | :------: | :------: | :--------: | :-------: | ------------------------------ |
| `undefined`/`all` |    ✓     |    ✓     |     ✓      |     ✓     | 없음                           |
| `transcript`      |    ✗     |    ✗     |     ✓      |     ✓     | `audio.mp3`, `subtitle.en.vtt` |
| `subtitles`       |    ✗     |    ✓     |     ✗      |     ✓     | `audio.mp3`, `transcript.txt`  |

- **alignment는 항상 실행.** `all`은 fresh full run과 동일.
- 아티펙트: `audio.mp3`(download), `subtitle.en.vtt`(subtitle), `transcript.txt`(transcript), `segments.json`(alignment). 모두 `.shadowing/episodes/{videoId}/` 하위.

### 1-3. 재사용 아티펙트 사전 검증 (AC4)

- 건너뛰는 단계의 산출물이 실제로 존재하는지 **단계 실행 전에** 확인한다(내부 헬퍼 `artifactExists(videoId, name)` — 실제 `fs.access`, Issue 2의 실파일 검증 방식과 일관).
- 누락 시: **어떤 단계도 실행하지 않고** `status: failed` 기록.
  - `error`: 누락 파일명을 명시 — `"Cannot retry '<retryStep>': missing reused artifact '<file>'"`
  - `currentStep`: 해당 retry의 첫 실행 단계 (`transcript` 또는 `subtitle`)

### 1-4. 불변 정책 (Issue 2 계승)

- `matchRate < 0.85` 검증은 **retry 경로에서도 그대로 적용**.
- 실패 시 아티펙트 미삭제. 단계 throw 시 `failed` + `currentStep` + `error`, 재-throw 안 함(fire-and-forget 안전).

---

## 2. 테스트 시나리오 (Test Scenarios)

> 포맷: `[정상/경계/예외] 대상 — should [기대동작] when [조건]`
> 단계 모듈은 **DI 더블 주입**, 재사용 아티펙트·상태는 **실제 파일**(테스트 videoId + cleanup)로 결정적 검증.

### [정상]

- [x] `[정상] runImportPipeline — should run all steps (download→subtitle→transcript→alignment) when retryStep is undefined (fresh import, unchanged)`
- [x] `[정상] runImportPipeline — should run all steps including downloadAudio when retryStep is 'all'`
- [x] `[정상] runImportPipeline — should skip downloadAudio/fetchSubtitle and run only fetchTranscript→alignTranscript when retryStep is 'transcript' and audio.mp3 + subtitle.en.vtt exist`
- [x] `[정상] runImportPipeline — should skip downloadAudio/fetchTranscript and run only fetchSubtitle→alignTranscript when retryStep is 'subtitles' and audio.mp3 + transcript.txt exist`
- [x] `[정상] POST /api/import — should forward retryStep to runImportPipeline when retryStep is provided`

### [경계]

- [x] `[경계] runImportPipeline — should reach status 'completed' on a 'transcript' retry when transcript and alignment succeed`
- [x] `[경계] runImportPipeline — should not call downloadAudio (no audio re-download) on a 'subtitles' retry of an existing episode`
- [x] `[경계] runImportPipeline — should still mark failed when matchRate < 0.85 on a retry path (matchRate check not bypassed)`
- [x] `[경계] runImportPipeline — should set currentStep to 'transcript' (not 'download') when precheck fails on a 'transcript' retry`
- [x] `[경계] runImportPipeline — should set currentStep to 'subtitle' when precheck fails on a 'subtitles' retry`
- [x] `[경계] runImportPipeline — should include both retryStep name and missing artifact name in the precheck error message`

### [예외]

- [x] `[예외] runImportPipeline — should mark failed with a clear error naming the missing artifact when retryStep is 'transcript' but audio.mp3 is missing`
- [x] `[예외] runImportPipeline — should mark failed when retryStep is 'transcript' but subtitle.en.vtt is missing`
- [x] `[예외] runImportPipeline — should mark failed when retryStep is 'subtitles' but transcript.txt is missing`
- [x] `[예외] runImportPipeline — should mark failed with error naming 'audio.mp3' when retryStep is 'subtitles' but audio.mp3 is missing`
- [x] `[예외] runImportPipeline — should not call any step (transcript/alignment) when a required reused artifact is missing`

---

## 3. Acceptance Criteria 교차 대조

`gh issue view 3`의 AC ↔ 위 시나리오 매핑. 모든 AC가 ≥1개 시나리오로 커버됨.

| AC                                                                                                                                            | 커버 시나리오                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1: `failed` + `audio.mp3`·`subtitle.en.vtt` 존재, `retryStep: transcript` → download/subtitle 미호출, transcript→alignment 재실행·상태 갱신 | `[정상] … skip downloadAudio/fetchSubtitle … 'transcript' …`, `[경계] … reach 'completed' on a 'transcript' retry …`                                                                                                                        |
| AC2: `completed` 에피소드, `retryStep: subtitles` → `409` 없이 수락 + `audio.mp3` 재다운로드 안 됨 + subtitle→alignment 재실행                | `[정상] … skip downloadAudio/fetchTranscript … 'subtitles' …`, `[경계] … no audio re-download on a 'subtitles' retry …`, `[정상] POST … forward retryStep …` + Issue 1 route 테스트(`bypass 409 … retryStep present even though completed`) |
| AC3: `retryStep: all` → 모든 단계 처음부터 재실행(audio 재다운로드 포함)                                                                      | `[정상] … run all steps including downloadAudio … 'all'`                                                                                                                                                                                    |
| AC4: 재사용 대상 아티펙트 누락 → 명확한 `error`와 함께 `failed`                                                                               | `[예외] … audio.mp3 is missing`, `[예외] … subtitle.en.vtt is missing`, `[예외] … transcript.txt is missing`, `[예외] … should not call any step …`                                                                                         |

> 결론: 4개 AC 모두 대응 시나리오 존재. AC2의 "`409` 없이 수락"은 Issue 1 `route.test.ts`에서 이미 검증되며, 본 이슈는 retryStep이 오케스트레이터로 전달되어 분기됨을 보강한다.
