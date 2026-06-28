# import-engine PRD

> 단일 기준 문서(Single Source of Truth). 이 피처에 관해 궁금하면 이 문서를 본다.
> 요구사항 근거: [spec-fixed.md](./spec-fixed.md) · 상태: **Stage 2 진행 중(GATE 2 아키텍처 선택 대기)**

---

## 1. 개요

임포트 파이프라인의 **백엔드 엔진**을 완성한다. 오케스트레이터(`runImportPipeline`)가 DI로 호출하는 세 단계
스텁(`downloadAudio`/`fetchSubtitle`, `fetchTranscript`, `alignTranscript`)을 동작 구현으로 채우고,
이미 완성된 `import-state`는 회귀 검증만 한다. 계약·파일명·산출 위치는 고정.
산출 흐름: `audio.mp3` + `subtitle.en.vtt` + `transcript.txt` → `segments.json`(+matchRate).

## 2. 사용자 스토리

- 임포트 오케스트레이터로서, `downloadAudio`/`fetchSubtitle`를 호출하면 유효 URL의 오디오·자막이 디스크에 산출되길 바란다.
- 오케스트레이터로서, `fetchTranscript`를 호출하면 화자가 정규화되고 비발화가 제거된 문장 JSONL이 산출되길 바란다.
- 오케스트레이터로서, `alignTranscript`를 호출하면 자막↔대본이 정합된 `segments.json`과 품질 지표 `matchRate`를 받고 싶다.
- 단계 모듈을 테스트하는 개발자로서, 실제 yt-dlp·네트워크 없이 결정적으로 검증하고 싶다(주입형 runner/fetcher).
- 앱 사용자로서(최종 수혜), 임포트가 끝나면 정확한 타임라인의 쉐도잉 세그먼트를 얻고 싶다.

## 3. 기술 결정 (ADR)

> **⏸ GATE 2 선택 대기.** 아래 §3-A 비교표에서 한 가지 아키텍처를 선택하면 §3-B에 ADR을 확정 기재한다.

### 3-A. 아키텍처 3개 시나리오 비교

결정 축: **공유 관심사·알고리즘의 분해 입도와 DI 방식.** (계약 시그니처는 세 안 모두 동일)

> 이 엔진은 서버 사이드 순수 로직이라 "API 레이어/상태관리/컴포넌트" 기준은 해당 사항이 적다 →
> 각각 "오케스트레이터 계약 변경지점 / 모듈 구조 / 내부 추상화"로 치환해 평가한다.

| 기준                        | 시나리오 A — 단일 파일 모듈(최소 변경)                                                                                                   | 시나리오 B — 공유 인프라 추상화 레이어                                               | 시나리오 C — 순수 함수 코어 + 얇은 어댑터                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **1. 데이터 구조**          | 세 안 공통: `audio.mp3`/`subtitle.en.vtt`/`transcript.txt`(JSONL `Sentence`)/`segments.json`(`Segment[]`, words 생략). 내부 표현도 동일. | 동일                                                                                 | 동일                                                                                                          |
| **2. 계약 변경지점**        | 없음(기존 스텁 시그니처 그대로 채움).                                                                                                    | 없음. 단, 스텝이 공유 유틸을 import.                                                 | 없음. 스텝은 순수 코어 함수 + IO 어댑터 조합.                                                                 |
| **3. 내부 추상화(DI)**      | runner/fetcher를 **각 스텝 함수의 optional 마지막 인자**(기본=실제 구현)로 주입.                                                         | `runner`/`fetcher`/`vtt`/`text` 전용 모듈을 만들고 스텝이 **모듈 단위로 주입/조합**. | 알고리즘은 **부수효과 없는 순수 함수**로 분리, 스텝은 IO·DI만 담당하는 **얇은 어댑터**.                       |
| **4. 핵심 동작(alignment)** | 파싱·앵커링·LIS·보간을 `alignment.ts` 한 파일의 비공개 헬퍼로 구현.                                                                      | VTT 파싱은 `vtt.ts`, 정규화는 `text.ts`로 분리, 앵커/LIS/보간은 `alignment.ts`.      | `vtt/parse`, `align/anchor`, `align/lis`, `align/interpolate`를 각각 순수 함수로 분리, `alignment.ts`는 조립. |
| **5. 모듈 구조**            | 기존 `import/*.ts` 3파일만 채움(+테스트). 신규 파일 최소.                                                                                | `import/` 아래 공유 유틸 다수(`io/runner/fetcher/vtt/text`). 파일 수 ↑↑.             | `import/` 아래 도메인별 폴더(`align/`, `transcript/`)에 순수 함수 + 얇은 스텝. 파일 수 中.                    |
| **6. 기존 패턴 일관성**     | 현행 스텁 구조·`episodes.ts` 헬퍼 재사용과 **가장 일치**.                                                                                | 추상화 레이어가 현 코드베이스(소비자=엔진 하나)엔 다소 과함.                         | 서비스 DI 관습과 일치하나 폴더 계층은 신규 도입.                                                              |
| **7. 테스트 용이성**        | 스텝 단위 테스트는 쉬움. 단, 알고리즘 세부(LIS·보간)는 파일 내 비공개라 **단위 분리가 어려움**(스텝 통해 간접 검증).                     | 공유 유틸 단위 테스트 양호. 스텝은 유틸 모킹 필요.                                   | **최상**: 순수 함수라 입출력만으로 결정적 단위 테스트, TDD Red/Green 사이클에 최적. alignment 복잡도에 강함.  |

**트레이드오프 한 줄 요약**

- **A**: 가장 빠르고 변화 최소, 그러나 alignment 알고리즘 단위 테스트가 약함.
- **B**: 재사용·분리 우수, 그러나 현재 규모엔 파일·추상화 과다(오버엔지니어링 위험).
- **C**: 알고리즘 중심 테스트 최상·TDD 친화, 그러나 폴더 계층 신규 + 순수/부수효과 경계 설계 비용.

### 3-B. ADR-002 — 순수 함수 코어 + 얇은 어댑터 (시나리오 C)

**Status**: Accepted (2026-06-27)

**Context**

엔진의 세 단계는 성격이 다르다. youtube/transcript는 **부수효과(외부 프로세스·네트워크·파일 IO)** 가 본질이고,
alignment는 **결정적 알고리즘(VTT 파싱·희소 단어 앵커링·LIS·선형 보간)** 이 본질이다. CLAUDE.md는 TDD 사이클
(Red→Green→Refactor)과 서비스 DI를 표준으로 요구한다. 알고리즘을 부수효과와 한 함수에 섞으면(시나리오 A)
LIS·보간 같은 핵심 로직을 입출력만으로 단위 검증하기 어렵고, 반대로 모든 관심사를 공유 유틸 레이어로 추상화하면
(시나리오 B) 소비자가 엔진 하나뿐인 현 규모에 비해 파일·간접성이 과하다.

**Decision**

부수효과와 순수 로직을 물리적으로 분리한다.

- **순수 함수 코어**(부수효과 0, 입력→출력 결정적):
  - `import/vtt/parse.ts` — VTT 텍스트 → `VttToken[]`
  - `import/transcript/parse.ts` — 대본 HTML 문자열 → `Sentence[]` (비발화 제거·화자 정규화·문장 분할 포함)
  - `import/align/anchor.ts` — 양쪽 토큰 → 희소 공통 단어 앵커 후보
  - `import/align/lis.ts` — 앵커 후보 → 단조 증가 부분수열(LIS)
  - `import/align/interpolate.ts` — 확정 앵커 + 토큰 타임 → 문장 경계 시간(선형 보간) → `Segment[]`, `matchRate`
- **얇은 어댑터(스텝 모듈)** — IO·DI만 담당, 순수 코어를 조립:
  - `youtube.ts`: 주입형 **runner**(기본 `child_process.spawn`)로 yt-dlp 호출 → 파일 산출
  - `transcript.ts`: 주입형 **fetcher**(기본 `fetch`)로 HTML 취득 → `transcript/parse` → JSONL 기록
  - `alignment.ts`: 입력 파일 로드 → `vtt/parse`+`transcript` 로드 → `anchor`→`lis`→`interpolate` 조립 → `segments.json` 기록 + `{matchRate}` 반환
- **HTML 파서 의존성**: `node-html-parser`(경량·빠름·full DOM 불필요)를 채택. 순수 `transcript/parse`에서만 사용.
- **DI 방식**: runner/fetcher는 각 스텝 함수의 optional 마지막 인자(기본=실제 구현). 순수 코어는 주입 불필요(결정적).

**Alternatives (기각 사유)**

- **시나리오 A (단일 파일)**: 변경 최소·최속이나 alignment의 LIS·보간이 파일 내 비공개라 **단위 테스트를 스텝 경유 간접 검증으로만** 할 수 있어, 복잡도가 가장 높은 부분의 TDD 피드백이 약하다 → 기각.
- **시나리오 B (공유 인프라 레이어)**: io/runner/fetcher/vtt/text 전역 유틸화는 재사용성은 좋으나 **현재 소비자가 이 엔진 하나뿐**이라 추상화·파일 수가 과다(오버엔지니어링)하고, 스텝 테스트마다 유틸 모킹 비용이 든다 → 기각. (공유 유틸은 두 번째 소비자가 생길 때 추출해도 늦지 않음)

**Consequences**

- 장점: 알고리즘이 순수 함수라 **결정적 단위 테스트**가 쉽고 TDD Red/Green에 최적. 부수효과는 어댑터에 격리돼 fake runner/fetcher로 네트워크·yt-dlp 없이 검증 가능. 관심사 분리로 alignment 디버깅 용이.
- 단점/한계: `import/` 아래 **폴더 계층(vtt/·transcript/·align/)이 신규 도입**되어 현행 평면 구조보다 파일이 늘고, 순수/부수효과 **경계 설계 비용**이 든다. `node-html-parser` **신규 의존성 1종** 추가.

## 4. Out of Scope

이번 엔진에서 **구현하지 않는다**:

- 썸네일 다운로드 (계약 `PipelineSteps` 확장 없음).
- `Segment.words[]` 단어 단위 타이밍 (문장 단위만; 후속 확장).
- 번역(`translating` 상태) — 타입에 보존하되 단계 미구현.
- 다국어 자막 (en 외), 영상(비오디오) 다운로드.
- UI·라우트·페이지(`import-form-ui`, `import-page`) — 별도 피처.
- `import-state` 재구현 (이미 완료, 회귀 검증만).
- 계약 시그니처·산출 파일명 변경, 새 공유 인프라 유틸 레이어(시나리오 B) 도입.

## 5. 용어 정의

[spec-fixed.md §13](./spec-fixed.md) 동기화 (단계 모듈·runner·fetcher·artifact·anchor·matchRate·멱등 재생성·계약).
