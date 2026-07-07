# Issue #126 — [multilingual] 언어별 번역 프롬프트 라우팅

> `/test-scenarios 126` 산출. 승인 게이트는 사용자 상시 정책(추천안 자동 진행)으로 통과 처리.

## 1. 시그니처 명세

### 1-1. 번역기 팩토리 (`src/lib/services/import/translation.ts`)

```ts
/**
 * language 인자 추가(기본 'en' — 기존 호출 무변경).
 * - 'en': 기존 영어→한국어 시스템 프롬프트 그대로(회귀 없음).
 * - 'ja': 일본어→한국어 시스템 프롬프트로 라우팅(구어체, 화자·문맥 참조 정책 동일).
 */
export function createOpenRouterTranslator(
  config: OpenRouterConfig,
  language?: LanguageCode, // 기본 'en'
): SegmentTranslator;
```

- **화자 접두사 제거 일반화**: 하드코딩 화자 정규식(`DUCKWORTH|DUBNER|BOTH|NARRATOR`)을
  **임의 대괄호 화자 토큰**(`\[[^\]]+\]`)으로 확장 — `[SPEAKER]` 등 신규 화자 키에도 동작.
  번호 접두사(`1. `) 제거는 기존 유지.
- 응답 계약(JSON 배열·길이 일치)·에러 정책(HTTP throw/파싱 실패 빈 배열)은 언어와 무관하게 동일.

### 1-2. 파이프라인 (`src/lib/services/import-pipeline.ts`)

```ts
export interface PipelineSteps {
  /** translation: segments.json의 text → 한국어 translation 주입 (best-effort, 언어 라우팅) */
  translate?(videoId: string, language: LanguageCode): Promise<void>;
}
```

- `runImportPipeline`이 `steps.translate?.(videoId, language)`로 호출.
- 기본 스텝(`translateStep`)은 `createOpenRouterTranslator(config, language)`로 번역기 생성.
- `retryStep 'translation'`: state에서 복원된 language가 그대로 전달됨(재보충도 ja 프롬프트).

### 1-3. 변경 없는 것

- `translate(videoId, deps)` 코어(멱등·배치·증분 저장): 무변경 — 번역기(deps.translator)만 언어별로 달라진다.
- ScriptView blur/토글: 데이터 소비 UI 무변경(기존 완성).

## 2. 테스트 시나리오

### createOpenRouterTranslator (언어 라우팅)

- [x] [정상] createOpenRouterTranslator — should use a Japanese→Korean system prompt when language is 'ja'
- [x] [정상] createOpenRouterTranslator — should keep the existing English→Korean system prompt when language is omitted (기존 회귀)
- [x] [정상] createOpenRouterTranslator — should strip arbitrary bracketed speaker prefixes echoed by the model (e.g. [SPEAKER])
- [x] [경계] createOpenRouterTranslator — should still strip numbered + legacy speaker prefixes (기존 회귀)
- [x] [예외] createOpenRouterTranslator — should throw on HTTP error regardless of language

### runImportPipeline (language 전달)

- [x] [정상] runImportPipeline — should call translate with 'ja' in subtitle-only ja mode
- [x] [정상] runImportPipeline — should call translate with 'en' in transcript mode (기존 회귀)
- [x] [정상] runImportPipeline — should call translate with state language when retryStep is 'translation' (ja 재보충)

## 3. AC 교차 대조

| AC                                                               | 커버 시나리오                                                                                          |
| :--------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| AC1: ja 세그먼트에 자연스러운 한국어 주입 + blur/토글 동작       | ja 프롬프트 라우팅 + pipeline ja 전달 (blur/토글은 기존 ScriptView 테스트가 커버 — 데이터 주입만 변경) |
| AC2: en 기존 번역 품질·동작 유지(프롬프트 회귀 없음)             | en 프롬프트 회귀 + transcript 모드 'en' 전달 + 접두사 제거 회귀                                        |
| AC3: retryStep 'translation' — ja 프롬프트로 누락분만 보충(멱등) | retry language 전달 (멱등 스킵은 기존 translate 코어 테스트가 커버)                                    |
