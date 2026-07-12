# issue-143 — 문장 복원 부분 실패: 대형 배치 파티션 불일치로 60큐 통째 원본 폴백

> sentence-builder가 에피소드의 일부 배치만 성공하고, 실패 배치는 60큐가 통째로 원본 큐로 폴백되어 파편·무구두점 세그먼트로 남음. 실측: `C9VabhxOPbA` 213 세그먼트 중 병합 33 / 원본큐 180.

## 근본 원인 (요약)

`buildSentences`가 60큐 배치로 LLM 병합을 시도하는데, 반환 `cueCount` 합이 배치 길이와 정확히 일치해야 채택(`isValidPartition`)한다. gemini flash + low effort로 60개 정확 카운팅 신뢰도가 낮아, 단일 카운트 오류가 60큐를 all-or-nothing으로 폐기한다.

## 시그니처

```ts
// src/lib/services/import/sentence-builder.ts (public 불변)
buildSentences(videoId: string, deps: BuildSentencesDeps): Promise<void>

interface BuildSentencesDeps {
  builder: SentenceBuilder;
  batchSize?: number;   // 기본 SENTENCE_BATCH_SIZE
  minChunk?: number;    // 기본 MIN_MERGE_CHUNK — 적응 분할 하한
}
```

### 상수 변경 / 추가

- `SENTENCE_BATCH_SIZE = 20` (기존 60 → 축소, AC1).
- `MIN_MERGE_CHUNK = 5` (파티션 실패 시 이 크기 이하로는 더 쪼개지 않고 원본 큐 유지).

### 내부 헬퍼 (비공개)

```ts
isRawCue(seg: Segment): boolean            // id.startsWith('cue-') — 재병합 대상 판별
mergeChunk(                                 // 적응 병합
  cues: Segment[],
  builder: SentenceBuilder,
  contextHint: string | undefined,
  minChunk: number,
): Promise<Segment[]>
```

### 동작 계약

- **적응 분할(AC2)**: `mergeChunk`는 builder 호출 결과가 유효 파티션이면 문장 세그먼트로 매핑, 아니면 `cues.length > minChunk`일 때 절반으로 분할해 각각 재귀(왼쪽 먼저 → 오른쪽은 왼쪽 마지막 문장을 hint로). `minChunk` 이하에서 여전히 불일치면 원본 큐를 그대로 반환한다. ⇒ 불일치 격리 범위가 배치 전체가 아니라 ≤`minChunk`.
- **재시도 passthrough(AC3)**: 입력 세그먼트 중 `isRawCue`가 아닌(이미 병합된 `sent-*`) 항목은 그대로 통과시키고, `cue-*` 런만 `batchSize`로 청크해 재병합한다. 첫 실행(전부 cue-_)과 재시도(sent-_·cue-\* 혼합)를 동일 로직으로 처리.
- **재번호**: 최종 출력에서 문장 세그먼트(비-cue)는 `sent-N`으로 순차 재번호, 원본 큐(`cue-*`)는 원본 id 유지.
- **throw 처리(AC4)**: builder가 throw(HTTP·키 부재·timeout)하면 그 청크는 분할하지 않고 원본 큐 유지(분할은 카운트 오류에만 의미). 파이프라인은 완주.
- **불변**: 증분 저장(청크 성공 즉시 부분 저장), contextHint 스레딩, `segments.json` 부재 시 throw 유지.

## 테스트 시나리오

### [정상]

- [정상] buildSentences — should split cues into batches no larger than the reduced batch size when merging (each builder call receives ≤ batchSize cues) — **AC1**
- [정상] buildSentences — should re-merge only `cue-*` runs and pass through existing `sent-*` segments unchanged on retry with mixed input — **AC3**
- [정상] buildSentences — should merge a valid-partition chunk into sentence segments (기존 동작 보존) — 회귀

### [경계]

- [경계] buildSentences — should isolate a partition mismatch to a sub-chunk (≤ minChunk) and keep valid sub-chunks merged instead of reverting the whole batch — **AC2**
- [경계] buildSentences — should keep original cues for a sub-chunk that still mismatches at the minimum chunk size — **AC2**
- [경계] buildSentences — should preserve `sent-*` segments' order and text while re-merging adjacent `cue-*` runs — **AC3**

### [예외 / 폴백]

- [예외] buildSentences — should keep original cues for a chunk when the builder throws (no split) and still complete — **AC4**
- [예외] buildSentences — should leave segments.json as raw cues when the builder throws for every batch (기존) — **AC4**
- [예외] buildSentences — should throw when segments.json is missing (기존) — 회귀

## AC ↔ 시나리오 교차 대조

| AC                       | 커버 시나리오  |
| ------------------------ | -------------- |
| AC1 (배치 크기 축소)     | 정상#1         |
| AC2 (하위 청크 격리)     | 경계#1, 경계#2 |
| AC3 (재시도 passthrough) | 정상#2, 경계#3 |
| AC4 (throw 폴백·완주)    | 예외#1, 예외#2 |
