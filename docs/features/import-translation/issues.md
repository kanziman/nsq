# import-translation — 이슈 분해 (issues.md)

> `prd.md`(A안 In-place, GATE 3 통과) 기반. **[GATE 4]** 수직 슬라이스·의존성·AC 승인 대기.
> 표시 UI(ScriptView)는 완성 상태이므로 각 슬라이스의 "관찰 가능한 결과"는 **segments.json의 변화** 또는 **임포트 파이프라인 동작**이다.

## 수직 슬라이스 원칙 적용

번역 기능은 백엔드 데이터 주입이라 UI 레이어가 없다. 따라서 슬라이스 기준을 **"이 이슈만 끝내면 독립적으로 실행·검증 가능한 산출물이 나오는가"** 로 잡는다. 레이어 순차(client→step→pipeline)가 아니라, 각 이슈가 자체 완결된 실행·테스트 표면을 갖는다.

## 의존성 순서

```
이슈 1 (번역 스텝 코어, DI translator)
   └─ 계약: SegmentTranslator = (batch) => Promise<string[]>
        ↓
이슈 2 (OpenRouter 배치 번역기 — 이슈1의 translator 자리에 주입)
        ↓
이슈 3 (파이프라인 통합 + retryStep 'translation' + best-effort + 마무리)
```

---

## 이슈 1 — 번역 스텝 코어: segments.json에 translation 멱등 주입

**목표**: `translate(videoId, deps)`가 `segments.json`을 읽어 번역이 없는 세그먼트만 배치로 묶어 주입 translator를 호출하고, 결과를 병합해 **같은 파일에 재기록**한다. OpenRouter 없이 스텁 translator로 완결 검증.

**시그니처 (제안)**

```ts
// src/lib/services/import/translation.ts
export type SegmentTranslator = (batch: Segment[]) => Promise<string[]>;
export interface TranslateDeps {
  translator: SegmentTranslator;
  batchSize?: number; // 기본 20
}
export function translate(videoId: string, deps: TranslateDeps): Promise<void>;
```

**Acceptance Criteria (Given-When-Then)**

- **AC1**: _Given_ 번역이 전혀 없는 `segments.json`, _When_ 스텁 translator로 `translate` 실행, _Then_ 모든 비어있지 않은 세그먼트에 `translation`이 채워지고 파일이 재기록된다.
- **AC2 (멱등)**: _Given_ 일부 세그먼트에 이미 `translation`이 존재, _When_ `translate` 실행, _Then_ 기존 번역은 보존되고 **누락분만** translator에 전달된다.
- **AC3 (배치)**: _Given_ 45개 세그먼트·`batchSize=20`, _When_ `translate` 실행, _Then_ translator가 3회(20/20/5) 호출되고 각 호출 입력이 인접 세그먼트 묶음이다.
- **AC4 (배치 실패 격리)**: _Given_ 특정 배치에서 translator가 throw, _When_ `translate` 실행, _Then_ 그 배치만 스킵(해당 세그먼트 `translation` 없음)되고 다른 배치는 정상 주입되며 함수는 정상 종료한다.
- **AC5 (길이 불일치 방어)**: _Given_ translator가 입력 개수와 다른 길이 배열 반환, _Then_ 그 배치는 주입하지 않는다(스킵).
- **AC6 (빈 텍스트)**: _Given_ 공백/빈 `text` 세그먼트, _Then_ 번역 대상에서 제외되고 그대로 통과한다.

---

## 이슈 2 — OpenRouter 배치 번역기 (문맥·화자 프롬프트 → 한국어 JSON 배열)

**목표**: 이슈1의 `SegmentTranslator` 계약을 만족하는 실제 OpenRouter 구현. 배치 세그먼트를 화자·인접 문맥과 함께 프롬프트로 구성해 `google/gemini-2.5-pro`에 요청하고, 한국어 문자열 JSON 배열을 파싱·검증해 반환한다. 주입형 `fetch`로 네트워크 없이 검증.

**시그니처 (제안)**

```ts
// src/lib/services/import/translation.ts (또는 openrouter.ts)
export interface OpenRouterConfig {
  apiKey: string;
  model?: string; // 기본 process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-pro'
  baseUrl?: string; // 기본 https://openrouter.ai/api/v1
  fetchFn?: typeof fetch; // 테스트 주입
  timeoutMs?: number;
}
export function createOpenRouterTranslator(
  config: OpenRouterConfig,
): SegmentTranslator;
```

**Acceptance Criteria (Given-When-Then)**

- **AC1 (프롬프트 구성)**: _Given_ 화자·text가 있는 배치, _When_ 번역기 호출(스텁 fetch), _Then_ 요청 본문에 각 세그먼트의 **화자와 원문**이 순서대로 포함되고 "한국어 JSON 배열로만 응답" 지시가 담긴다.
- **AC2 (파싱)**: _Given_ 모델이 유효한 한국어 JSON 배열 반환, _Then_ 입력과 동일 길이의 `string[]`로 파싱해 반환한다.
- **AC3 (코드펜스/잡음 방어)**: _Given_ 응답이 ` ```json ... ``` ` 펜스로 감싸짐, _Then_ 펜스를 제거하고 정상 파싱한다.
- **AC4 (길이 불일치)**: _Given_ 응답 배열 길이 ≠ 입력 개수, _Then_ 이슈1이 스킵할 수 있도록 빈 배열 반환 또는 명확한 실패 신호를 준다(이슈1 AC5와 정합).
- **AC5 (인증/HTTP 오류)**: _Given_ fetch가 401/5xx, _Then_ 예외를 던져 이슈1의 배치 실패 격리(AC4)에 걸린다.
- **AC6 (키 부재)**: _Given_ `apiKey` 미설정, _Then_ 호출 전 즉시 실패/no-op 경로로 처리되어 상위 best-effort에 흡수된다.

**의존**: 이슈 1(계약 `SegmentTranslator`).

---

## 이슈 3 — 파이프라인 통합: translating 스텝 + retryStep 'translation' + best-effort 마무리

**목표**: `runImportPipeline`에 번역 스텝을 배선한다. alignment 성공 직후 `translating(95)`로 `steps.translate` 실행(best-effort), `PipelineSteps.translate` 추가, `RetryStep`에 `'translation'` 추가 및 재사용 아티팩트(`segments.json`) 검증. `.env.example`·기본 모델 상수·checklist 상태를 마무리한다.

**변경 지점**: `import-pipeline.ts`, `types.ts`(`RetryStep`), `import/route.ts`(검증 화이트리스트, 필요 시), `.env.example`, `checklist.json`.

**Acceptance Criteria (Given-When-Then)**

- **AC1 (정상 배선)**: _Given_ 신규 임포트, _When_ alignment가 matchRate 통과, _Then_ `status: translating`(progress 95)로 `steps.translate(videoId)`가 1회 호출된 뒤 `completed(100)`가 된다.
- **AC2 (best-effort)**: _Given_ `steps.translate`가 throw, _When_ 임포트 실행, _Then_ status는 `failed`가 아니라 `completed`로 마감된다(오류는 로그).
- **AC3 (retryStep translation)**: _Given_ `retryStep: 'translation'`으로 재접수 & `segments.json` 존재, _When_ 파이프라인 실행, _Then_ download/subtitle/transcript/alignment는 건너뛰고 `translate`만 실행된다.
- **AC4 (재사용 아티팩트 검증)**: _Given_ `retryStep: 'translation'`인데 `segments.json` 부재, _Then_ 어떤 단계도 실행하지 않고 `failed`(누락 아티팩트 메시지)로 기록된다.
- **AC5 (멱등 재보충)**: _Given_ 번역 일부 누락 상태의 `segments.json`, _When_ `retryStep: 'translation'` 실행(실제 번역기), _Then_ 누락 세그먼트만 채워지고 기존 번역은 보존된다.
- **AC6 (마무리)**: `.env.example`에 `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`/`OPENROUTER_BASE_URL` 추가, checklist `import-translation` → `completed`.

**의존**: 이슈 1, 2.

---

## GATE 4 체크리스트 (자가 점검)

- [x] 각 이슈가 독립적으로 실행·검증 가능한 산출물을 낸다(수직).
- [x] 레이어 순차 강제(수평) 아님 — 각 이슈 자체 테스트 표면 보유.
- [x] 의존성 순서 정렬(1→2→3), 역방향 없음.
- [x] 모든 AC가 Given-When-Then.
- [x] 각 이슈 반나절~하루 크기.
