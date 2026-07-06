# import-translation — PRD (단일 진실 원천)

> `spec-fixed.md` 승인(GATE 1 통과) 기반. **GATE 2 완료 — A안(In-place 주입) 선택됨.** §3 ADR·§4 Out of Scope 확정, [GATE 3] 승인 대기.

## 1. 개요

임포트 파이프라인 정합(alignment) 성공 직후, `segments.json`의 영어 문장을 **OpenRouter LLM(`google/gemini-2.5-pro`)**으로 한국어 번역해 세그먼트별 `translation`을 채운다. 표시 UI(ScriptView blur/toggle)는 완성 상태이며, 본 기능은 **번역 데이터 생성·주입**만 담당한다.

- **목표**: 임포트 완료 시 스크립트 뷰에 한국어 번역이 자동으로 채워진다.
- **비목표(요약)**: 번역 캐시/용어집/다국어/구(phrase) 정렬 번역 (상세는 §4, GATE 2 이후 확정).

## 2. 사용자 스토리

1. 학습자로서, 새 에피소드를 임포트하면 **추가 조작 없이** 한국어 번역이 채워져 한↔영 대조 학습을 바로 시작하고 싶다.
2. 학습자로서, LLM 일시 오류로 번역이 일부 비어도 **오디오·정합·재생은 정상 완료**되길 바라고, 나중에 **누락분만 재보충**하고 싶다.

## 3. 기술 결정 (ADR) — **확정: A안 In-place 주입**

### 3-0. ADR (Architecture Decision Record)

- **Context**: 정합 후 `segments.json`의 영어 `text`를 한국어로 번역해 세그먼트별 `translation`을 채워야 한다. 소비 UI(ScriptView blur/toggle)와 저장 스키마(`Segment.translation?`), 상태 슬롯(`'translating'`)은 이미 존재하고, 파이프라인에는 번역 스텝만 없다. Provider는 OpenRouter(`google/gemini-2.5-pro`), 정책은 best-effort·멱등·배치+문맥으로 확정됨.
- **Decision**: `src/lib/services/import/translation.ts`에 `translate(videoId): Promise<void>`를 구현한다. 이 함수는 (1) `segments.json`을 읽고, (2) `translation`이 아직 없는 세그먼트만 골라 기본 20개 단위 배치로 묶어 인접 문맥·화자와 함께 OpenRouter에 요청하고, (3) 입력과 동일 길이의 한국어 JSON 배열을 회수해 각 세그먼트에 병합한 뒤, (4) **같은 `segments.json`에 재기록**한다. `runImportPipeline`에서 alignment 성공 직후 `translating(95)` 상태로 `steps.translate(videoId)`를 호출하고, `PipelineSteps`에 `translate`를 추가해 DI·테스트 더블을 지원한다. `RetryStep`에 `'translation'`을 추가하고 재사용 아티팩트로 `segments.json`을 요구한다. 실패는 스텝 내부에서 삼켜 `completed`를 유지한다.
- **Alternatives (기각)**:
  - **B안 Read-time lazy**: 최초 조회 시 번역. **기각 사유** — 번역은 LLM 고비용이라 매 조회 재계산·최초 열람 블로킹이 비현실적이고, "임포트 파이프라인 스텝" 취지(checklist)와 `'translating'` 상태 설계에 어긋남.
  - **C안 Overlay 아티팩트(translations.json)**: 별도 파일 + read-time 병합. **기각 사유** — 비파괴·재정합 생존이라는 이점은 있으나, 번역은 1회 영속 생성이면 충분해 overlay 이점이 작고, 조회 병합 로직·2파일 정합이라는 상시 복잡도를 새로 도입한다. A안은 소비처 무변경으로 표면이 더 좁다.
- **Consequences**:
  - **장점**: 소비처(`getEpisodeSegments`) 무변경; `alignment.ts`와 동형 컨벤션으로 학습비용·리뷰비용 최소; 스텝 단위 TDD가 단순(alignment 테스트 패턴 재사용); `'translating'`·retryStep 자연 통합.
  - **단점/한계**: (1) `segments.json`이 정합+번역 두 관심사를 함께 담아 순수 정합 산출이 아님. (2) 재정합(retry `all/subtitles/transcript`)은 `segments.json`을 새로 써 번역을 지우지만, translate가 **항상 alignment 직후 동일 흐름에서 실행**되므로 즉시 재보충된다(추가 API 비용 발생은 감수). (3) 배치 응답 비결정성(길이 불일치)은 해당 배치 스킵으로 방어하나, 그만큼 번역 누락이 남아 재시도(`translation`)로 보충해야 한다.

### 3-A. 아키텍처 3개 시나리오 비교 (참고 — GATE 2 근거)

### 3-A. 아키텍처 3개 시나리오 비교

세 안 모두 공통: `translation.ts`가 OpenRouter를 **배치+문맥**으로 호출하고, best-effort·멱등, `RetryStep`에 `'translation'` 추가. **차이는 "번역 결과를 어디에 저장하고 어떻게 소비하는가"** 이다.

- **A안 — In-place 주입**: `translate(videoId)`가 `segments.json`을 읽어 각 세그먼트에 `translation`을 넣고 **같은 `segments.json`을 재기록**. 소비는 기존 `getEpisodeSegments`(segments.json 읽기) 그대로.
- **B안 — Read-time lazy 번역**: 임포트 때 번역하지 않고, 에피소드 **최초 조회 시** 번역해 별도 캐시(`translations.json`)에 저장 후 병합. (기존 `wordStarts` read-time 부착 패턴 차용)
- **C안 — Overlay 아티팩트**: 임포트 스텝이 번역을 **별도 `translations.json`(id→번역 맵)** 으로 기록하고, `segments.json`은 정합 산출 그대로 유지. 조회 시 `getEpisodeSegments`가 **read-time 병합**(기존 wordStarts 병합 지점 재사용).

| #   | 기준                 | **A — In-place 주입 (추천)**                                                                 | B — Read-time lazy                                                         | C — Overlay 아티팩트                                      |
| :-- | :------------------- | :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------- | :-------------------------------------------------------- |
| 1   | **데이터 구조**      | `segments.json`에 `translation` 필드 병합 저장(단일 파일)                                    | 최초 조회 시 생성, `translations.json` 캐시                                | `segments.json`(정합) + `translations.json`(번역 맵) 분리 |
| 2   | **API 레이어 변경**  | `import-pipeline`에 `translate` 스텝 1개 삽입                                                | 임포트 무변경, **조회 경로(episodes/서버)에 번역 트리거** 추가             | 임포트에 `translate` 스텝 삽입 + 조회 병합 로직           |
| 3   | **상태관리 변경**    | 없음(서버 파일 기반)                                                                         | 최초 조회 지연 로딩 상태 필요(로딩 UX)                                     | 없음                                                      |
| 4   | **핵심 동작**        | align→translate(재기록)→meta→completed. 진행률 `translating(95)`                             | 조회 시 번역 대기(첫 열람 수 초 블로킹)                                    | align→translate(overlay 기록)→...→completed + 병합        |
| 5   | **컴포넌트 구조**    | 신규 컴포넌트 0. `translation.ts` + 파이프라인 배선                                          | ScriptView/에피소드 로딩에 번역 대기 상태 추가                             | `translation.ts` + `episodes.ts` 병합 지점 확장           |
| 6   | **기존 패턴 일관성** | `alignment.ts`(segments.json 기록)와 **동일 패턴**. `'translating'` 상태·retryStep 자연 통합 | wordStarts read-time 패턴과 유사하나, **번역은 비싸서 lazy 재계산 부적합** | wordStarts overlay 패턴과 **정확히 일치**(비파괴적)       |
| 7   | **테스트 용이성**    | `translate(videoId)` 순수 스텝 단위테스트 + DI 주입(alignment 테스트와 동형)                 | 조회 경로·로딩 상태까지 얽혀 테스트 표면 넓음                              | 스텝 + 병합 두 지점 테스트 필요                           |

### 3-B. 추천안과 트레이드오프 요약

- **추천: A안(In-place 주입).** 근거: (1) checklist의 "`translation` 필드 주입" 문구에 가장 직접적, (2) 기존 `alignment.ts`의 segments.json 기록 컨벤션·`'translating'` 상태·retryStep과 **군더더기 없이 통합**, (3) 소비처(`getEpisodeSegments`) 무변경, (4) 스텝 단위 테스트가 alignment 테스트와 동형이라 TDD가 단순. 파이프라인상 **translate는 항상 alignment 직후 실행**되므로 재정합으로 인한 번역 유실도 같은 흐름에서 즉시 재보충된다.
- **B안 단점(치명)**: 번역은 LLM 비용이 커 **매 조회 재계산·최초 열람 블로킹**이 비현실적. 임포트 파이프라인 취지와도 어긋남 → 제외 권고.
- **C안 장점**: `segments.json`을 정합 순수 산출로 보존(비파괴), 재정합에도 번역 생존. **단점**: 조회 병합 로직·2파일 정합이라는 추가 복잡도. wordStarts 패턴과의 일관성이 최대 매력이나, 번역은 영속·고비용이라 read-time 재계산이 아닌 **1회 생성**이면 충분해 overlay의 이점이 상대적으로 작다.

## 4. Out of Scope (이번 구현에서 명시적으로 배제)

MVP 스텝을 최소·안정적으로 세우기 위해 아래는 **이번에 구현하지 않는다**:

1. **번역 캐시/무효화 시스템** — 별도 캐시 스토어·해시 기반 무효화 없음. 멱등 스킵만으로 재호출을 줄인다.
2. **용어집(glossary)·고유명사 고정** — 화자명 등 일관 표기 강제 사전 없음(프롬프트 힌트 수준까지만).
3. **다국어 지원** — 한국어 단일. 언어 선택 UI/파라미터 없음.
4. **문장 내 구(phrase)/단어 정렬 번역** — 세그먼트(문장) 단위까지만. 단어 하이라이트와 번역 연동 없음.
5. **번역 품질 자동 채점·검수 루프** — matchRate 같은 품질 게이트 없음(번역은 게이트하지 않음).
6. **전용 번역 재시도 UI** — 재시도는 기존 import 모니터의 `retryStep: 'translation'` 경로 재사용. 세그먼트별 개별 재번역 버튼 등 신규 UI 없음.
7. **스트리밍/실시간 번역 표시** — 배치 완료 후 일괄 저장. 진행 중 부분 표시 없음.
8. **비용/토큰 사용량 대시보드** — 사용량 계측·표시 없음(서버 로그 수준).

## 5. 용어 정의

`spec-fixed.md` §11과 동기화(번역 스텝 / translation 필드 / best-effort / 멱등 번역 / 배치 / translating).
