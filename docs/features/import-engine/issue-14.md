# Issue #14 — 엔진 통합 회귀 + import-state 검증

> 근거: issues.md (Issue 6). 의존성: #9 #10 #11 #12 #13.
> 목적: 네 단계가 오케스트레이터(`runImportPipeline`) 위에서 일관되게 흐르고 상태 전이가 올바른지 **실제 단계 모듈**로 통합 검증. import-state 회귀 포함.

## 1. 접근 — 실제 모듈 통합

기존 `import-pipeline.test.ts`는 단계 모듈을 **mock**으로 주입해 오케스트레이터 분기만 검증한다. 본 이슈는 **실제 단계 모듈**(`downloadAudio`/`fetchSubtitle`/`fetchTranscript`/`alignTranscript`)을 `runImportPipeline`에 배선하고, 최하위 IO(프로세스 spawn·HTTP)만 fake `runner`/`fetcher`로 대체해 **엔드투엔드**로 검증한다.

- fake `runner`: `--extract-audio` → `audio.mp3`, `--write-subs` → `subtitle.en.vtt` 기록
- fake `fetcher`: 고정 대본 HTML 반환 → `fetchTranscript`가 `transcript.txt` JSONL 기록
- 실제 `alignTranscript`: 위 산출물(vtt+transcript)을 읽어 `segments.json`·matchRate 산출
- 상태 전이 시퀀스: `saveImportState` 래핑으로 기록(파일은 덮어써 최종만 남으므로)

→ 단위 테스트(mock)가 가렸을 **모듈 간 배선 결함**을 드러낼 수 있다. 신규 프로덕션 코드는 최소(배선·회귀).

## 2. 테스트 시나리오 (3 통합 + 전체 109 통과)

### [정상]

- [x] `[정상] runImportPipeline(real steps) — should create all 4 artifacts and transition downloading→processing_subtitles→processing_transcript→aligning→completed(100)`

### [경계]

- [x] `[경계] runImportPipeline(real steps) — retryStep='transcript' should skip download/subtitle, run transcript+alignment, complete`

### [예외]

- [x] `[예외] runImportPipeline(real steps) — should mark failed at the failing step, skip subsequent steps, and keep prior artifacts`

### [회귀]

- [x] `[회귀] import-state 단위 테스트(episodes.test.ts)·기존 import-pipeline.test.ts — 전체 실행 시 회귀 없음 (109/109)`

## 3. AC ↔ 시나리오 교차 대조

| #   | Acceptance Criteria                                                             | 커버 시나리오                    |
| --- | ------------------------------------------------------------------------------- | -------------------------------- |
| 1   | 전체 성공(matchRate≥0.85) → 4 아티펙트·상태 전이 …→completed(100)               | real-steps 성공 통합 테스트      |
| 2   | retryStep='transcript'·기존 audio/subtitle → download/subtitle 미실행·completed | real-steps retryStep 통합 테스트 |
| 3   | 한 단계 throw → 해당 currentStep failed·후속 미실행·아티펙트 유지               | real-steps 실패 통합 테스트      |
| 4   | 기존 import-state 단위 테스트 → 회귀 없이 통과                                  | 전체 스위트 grün 확인            |

> import-state 갭: `translating` 상태는 본 엔진 경로에서 미사용(보존). 전이는 downloading→…→aligning→completed/failed.
