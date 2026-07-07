# Issue #125 — [multilingual] LLM 문장 복원 스텝 (sentence-builder)

> `/test-scenarios 125` 산출. 승인 게이트는 사용자 상시 정책(추천안 자동 진행)으로 통과 처리.
> **TDD Green 완료** — 전체 스위트 552/552 통과(2026-07-07).

## 1. 시그니처 명세

### 1-1. 타입 (`src/lib/types.ts`)

```ts
export interface ImportState {
  status:
    | // ...기존 유지
    | 'building_sentences' // 신규 — 자막 전용 모드 문장 복원 진행
    | ...;
}

export type RetryStep = 'all' | 'transcript' | 'subtitles' | 'sentences' | 'translation';
```

### 1-2. 문장 복원 스텝 (`src/lib/services/import/sentence-builder.ts`, 신규)

`translation.ts`와 동형 컨벤션(DI 주입형 LLM, 배치, best-effort, 증분 저장, console.warn 로깅).

```ts
/** 한 문장이 소비한 연속 큐 수. cueCount 합 = 배치 큐 수(파티션 계약 — 인덱스 오류 원천 차단). */
export interface SentenceGroup {
  text: string; // 구두점 복원된 완결 문장
  cueCount: number; // 이 문장이 병합한 연속 큐 개수 (>= 1)
}

/** 큐 배치(+이전 배치 말미 문맥 힌트)를 받아 순서대로 큐를 소비하는 문장 그룹을 반환. */
export type SentenceBuilder = (
  cues: Segment[],
  contextHint?: string,
) => Promise<SentenceGroup[]>;

export interface BuildSentencesDeps {
  builder: SentenceBuilder;
  batchSize?: number; // 기본 60 (spec-fixed B5)
}

export const SENTENCE_BATCH_SIZE = 60;

/**
 * segments.json(큐 세그먼트)을 읽어 배치별로 문장 그룹을 회수하고,
 * 문장 세그먼트(id `sent-{n}`, start/end = 그룹 첫/끝 큐 시각, speaker 승계)로 재기록.
 * - 배치 실패/검증 실패(cueCount 합 불일치·빈 text·비정수) → 그 배치는 원본 큐 유지(격리).
 * - 배치 성공마다 증분 저장(중단 내성).
 * - segments.json 부재 → throw (호출측 파이프라인이 best-effort로 흡수).
 */
export async function buildSentences(
  videoId: string,
  deps: BuildSentencesDeps,
): Promise<void>;

/**
 * OpenRouter chat completions 기반 SentenceBuilder 팩토리 (translator와 동일 인프라).
 * - 파싱 실패/파티션 불일치 → 빈 배열 반환(호출측이 배치 스킵).
 * - HTTP 오류/키 부재 → throw.
 */
export function createOpenRouterSentenceBuilder(
  config: OpenRouterConfig, // translation.ts의 것 재사용(export 공유)
): SentenceBuilder;
```

### 1-3. 파이프라인 (`src/lib/services/import-pipeline.ts`)

```ts
export interface PipelineSteps {
  // ...기존 유지
  /** sentences(자막 전용): 큐 segments.json → 문장 단위 재구성 (best-effort) */
  buildSentences?(videoId: string): Promise<void>;
}
```

- **정상 흐름(자막 전용)**: `... → segments(90, aligning) → sentences(92, building_sentences) → translation(95) → meta → completed`.
- **best-effort**: `buildSentences` 예외는 삼키고 진행(큐 세그먼트 폴백 유지).
- **retryStep 'sentences'**: 재사용 아티팩트 `subtitle.{language}.vtt`(state.language 기반 동적 검증 — `REQUIRED_REUSE`를 language 인자 함수화). 첫 단계 `segments`. 흐름: 큐 재생성 → 문장 복원 → 번역 → meta → completed. download/subtitle 미실행.
- **대본 정합 모드**: `buildSentences` 미실행(기존 경로 무변경).

### 1-4. API 라우트 (`src/app/api/import/route.ts`)

- `IN_PROGRESS`에 `'building_sentences'` 추가(신규 임포트 409 차단 대상).

### 1-5. 모니터 (`ImportMonitor.tsx`, `StepTimeline.tsx`)

```ts
export type TimelineMode = 'transcript' | 'subtitle-only';

export interface StepTimelineProps {
  status: ImportState['status'];
  currentStep: string;
  progress: number;
  mode?: TimelineMode; // 기본 'transcript' (기존 회귀 없음)
}
// subtitle-only 단계: 다운로드 → 자막 → 세그먼트(segments) → 문장(sentences)
```

- `ImportMonitor`: `STATUS_LABEL`에 `building_sentences: '문장 복원 중'` 추가. `state.transcriptUrl` 부재 시 `mode="subtitle-only"` 전달.
- `retryPlanFor` 변경 없음(문장 복원은 best-effort라 failed로 나타나지 않음; 'sentences' 재시도는 API 경로).

## 2. 테스트 시나리오

### buildSentences (sentence-builder)

- [x] [정상] buildSentences — should rewrite segments.json with sentence segments consuming cueCounts when builder returns a valid partition
- [x] [정상] buildSentences — should set sentence start/end from first/last consumed cue and inherit speaker
- [x] [정상] buildSentences — should pass previous batch last sentence as context hint when processing subsequent batches
- [x] [경계] buildSentences — should keep original cue segments for a batch when cueCount sum mismatches batch length
- [x] [경계] buildSentences — should process later batches when an earlier batch fails (batch isolation)
- [x] [예외] buildSentences — should leave segments.json unchanged when builder throws for every batch
- [x] [예외] buildSentences — should throw when segments.json is missing

### createOpenRouterSentenceBuilder

- [x] [정상] createOpenRouterSentenceBuilder — should return sentence groups when response is a valid JSON partition
- [x] [정상] createOpenRouterSentenceBuilder — should include context hint in the user message when provided
- [x] [경계] createOpenRouterSentenceBuilder — should return empty array when response partition mismatches input cue count
- [x] [경계] createOpenRouterSentenceBuilder — should return empty array when response is not parseable JSON
- [x] [예외] createOpenRouterSentenceBuilder — should throw when API key is missing or HTTP status is not ok

### runImportPipeline (sentences)

- [x] [정상] runImportPipeline — should run buildSentences with status 'building_sentences' after cue segments in subtitle-only mode
- [x] [정상] runImportPipeline — should still complete when buildSentences throws (best-effort, cue fallback)
- [x] [정상] runImportPipeline — should rebuild cues→sentences→translate without download/subtitle when retryStep is 'sentences'
- [x] [경계] runImportPipeline — should fail with missing-artifact error when retryStep 'sentences' and subtitle.{lang}.vtt is absent
- [x] [정상] runImportPipeline — should not run buildSentences in transcript mode (기존 회귀)

### POST /api/import (route)

- [x] [정상] POST — should return 409 for a new import when existing status is 'building_sentences'

### StepTimeline / ImportMonitor (UI)

- [x] [정상] StepTimeline — should render subtitle-only steps 다운로드/자막/세그먼트/문장 when mode is 'subtitle-only'
- [x] [정상] StepTimeline — should mark 문장 active when currentStep 'sentences' in subtitle-only mode
- [x] [정상] StepTimeline — should keep transcript steps by default (기존 회귀)
- [x] [정상] ImportMonitor — should show '문장 복원 중' when status is 'building_sentences'
- [x] [정상] ImportMonitor — should pass subtitle-only mode to timeline when state has no transcriptUrl

## 3. AC 교차 대조

| AC                                                                   | 커버 시나리오                                         |
| :------------------------------------------------------------------- | :---------------------------------------------------- |
| AC1: 문장 단위(구두점 포함) 재구성 + start/end가 원 큐 시각 범위 내  | buildSentences 정상 3건 + pipeline sentences 정상     |
| AC2: LLM 전면 오류 → 큐 세그먼트 상태로 completed(실패 미노출)       | buildSentences throws 격리 2건 + pipeline best-effort |
| AC3: retryStep 'sentences' → 자막 재다운로드 없이 문장 복원만 재실행 | pipeline retry 정상 + missing-artifact 경계           |
