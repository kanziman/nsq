# Issue #13 — alignment 품질·경계 처리

> 근거: spec-fixed §7(C3, C5), issues.md (Issue 5). 의존성: #12.
> 목적: 저품질·결손 입력에서의 **안전 동작** — 낮은/0 matchRate도 기록, 누락 입력은 파일명 포함 throw.

## 1. 배경 — #12와의 관계

#13의 경계 동작은 대부분 **#12 구현에서 이미 견고하게 처리**되었다(C3를 happy-path 구현 시 선제 반영):

- `alignment.ts`: 항상 `segments.json` 기록 후 `{matchRate}` 반환(저품질도 기록).
- `interpolate.ts` `buildAlignment`: `candidateCount > 0 ? anchored/candidate : 0` 가드로 **앵커 0개 → matchRate 0**(NaN 방지), `MIN_DURATION`+`prevEnd`로 start<end·단조 보장.
- `readFileOrThrow`: 누락 파일 시 **파일명(경로) 포함** Error throw.
- 오케스트레이터(`import-pipeline.ts`): matchRate<0.85 → 상태 `failed`·아티펙트 유지(기존 회귀 테스트 존재).

따라서 #13은 **경계 계약을 회귀 테스트로 고정**하고 오케스트레이터 회귀(AC4)를 확인하는 데 초점을 둔다. (신규 프로덕션 코드 변경 없음 — 경계가 #12에서 충족됨.)

## 2. 경계 계약 (회귀 고정 대상)

| 상황                              | 동작                                                      |
| --------------------------------- | --------------------------------------------------------- |
| 거의 불일치(앵커 일부 누락)       | segments.json 기록 + matchRate<0.85 반환, **throw 안 함** |
| 공통 앵커 0개                     | matchRate=0(NaN 아님) + segments.json 기록, throw 안 함   |
| subtitle.en.vtt 누락              | `Error`(메시지에 `subtitle.en.vtt` 포함) throw            |
| transcript.txt 누락               | `Error`(메시지에 `transcript.txt` 포함) throw             |
| 저 matchRate 반환(오케스트레이터) | 상태 `failed`·아티펙트 유지(기존 회귀)                    |

## 3. 테스트 시나리오

### [경계] alignment.boundary.test.ts (실제 alignTranscript)

- [x] `should still write segments.json and return matchRate<0.85 (no throw) for near-mismatch input` — 단어 전치로 LIS<후보(예: 4/5=0.8)
- [x] `should return matchRate 0 and still write segments.json when there are zero common anchors` — 공통 단어 0 → matchRate 0·segments 기록

### [예외] alignment.boundary.test.ts

- [x] `should throw an Error whose message names subtitle.en.vtt when it is missing`
- [x] `should throw an Error whose message names transcript.txt when it is missing`

### [회귀] import-pipeline.test.ts (AC4, 기존)

- [x] matchRate 0.72/0.84/0.5 → 상태 `failed`·`'<0.85'` 에러·에피소드 디렉토리(아티펙트) 유지

## 4. AC ↔ 시나리오 교차 대조

| #   | Acceptance Criteria                                           | 커버 시나리오                                       |
| --- | ------------------------------------------------------------- | --------------------------------------------------- |
| 1   | 거의 불일치 → segments.json 기록·matchRate<0.85·throw 안 함   | near-mismatch boundary 테스트                       |
| 2   | 누락 입력 → 누락 파일명 포함 Error                            | missing subtitle / missing transcript 메시지 테스트 |
| 3   | 공통 앵커 0개 → matchRate=0·throw 안 함(segments.json 기록)   | zero-anchor boundary 테스트                         |
| 4   | 저 matchRate → 상태 failed·아티펙트 유지(오케스트레이터 회귀) | import-pipeline 기존 회귀 테스트(확인)              |

> 비고: AC1~3는 #12의 C3 구현으로 이미 충족 → 본 이슈는 회귀 고정. AC4는 기존 오케스트레이터 테스트로 충족.
