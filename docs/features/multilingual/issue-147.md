# issue-147 — 문장 복원 과병합: 한 세그먼트에 여러 완결 문장이 뭉침

> #143 재병합 후 `C9VabhxOPbA`에서 발견. 병합률은 100%지만 `sent-1` `[0.6–33.1]` 32.6s에 종결부호 5개 — 완결 문장 5개가 한 세그먼트. 섀도잉엔 문장 단위가 이상적.

## 근본 원인

`isValidPartition`이 그룹당 문장 수를 제약하지 않아, LLM이 배치(≤20큐)를 소수 큰 그룹으로 반환하면 여러 문장이 한 세그먼트로 뭉친다. 프롬프트도 "완결 문장으로 병합"이라 분리를 강제하지 않는다.

## 시그니처 (public 불변, 내부 헬퍼 추가)

```ts
// src/lib/services/import/sentence-builder.ts
// (public buildSentences / BuildSentencesDeps 불변)

// 내부 헬퍼(비공개)
splitIntoSentences(text: string): string[]
splitSegmentBySentences(base: Segment): Segment[]
```

### 동작 계약

- **문장 분할(AC1)**: `splitIntoSentences`는 `。！？` 종결부호 경계로 분할(부호 유지, trim, 빈 조각 제거). `groupsToSegments`가 각 그룹 세그먼트를 `splitSegmentBySentences`로 문장별 분리한다. 결과 각 세그먼트는 완결 문장 1개(내부 문장 경계 없음, 종결부호는 문말 1개까지).
- **시각 재분배(AC2)**: `splitSegmentBySentences`는 그룹 `[start,end)`를 조각 글자수 비례로 나눠 단조 비감소로 배분한다. 첫 조각.start = base.start, 마지막 조각.end = base.end.
- **speaker·재번호(AC3)**: 분할 세그먼트는 base.speaker를 계승하고, 최종 `renumber`가 `sent-N`을 연속 부여한다.
- **최소길이 병합 없음(AC4)**: 짧은 완결 문장(「はい。」 등)은 화자 턴일 수 있어 인접에 흡수하지 않고 독립 세그먼트로 둔다.
- **화자 경계 보존(AC5)**: `buildSentences`의 cue-\* 런 수집을 speaker 변경 지점에서도 끊어(동일 speaker 연속만 1런), 병합이 서로 다른 speaker 큐를 가로지르지 않는다.
- **프롬프트**: `SYSTEM_PROMPT`에 "각 완결 문장마다 별도 그룹" 지시 추가(모델 유도).
- **불변(AC6)**: #143 적응 배치·`sent-*` passthrough·throw 폴백·cueCount 파티션 계약 보존.

## 테스트 시나리오

### [정상]

- [정상] splitIntoSentences — should split text into one piece per 。！？ terminal keeping the punctuation — **AC1**
- [정상] buildSentences — should emit one segment per complete sentence when a group merges multiple sentences — **AC1**
- [정상] buildSentences — should redistribute a split group's [start,end) proportionally to sentence char length (monotonic non-decreasing) — **AC2**
- [정상] buildSentences — should inherit speaker and assign sequential sent-N to split segments — **AC3**

### [경계]

- [경계] splitIntoSentences — should return the whole text as a single piece when there is no internal terminal punctuation — **AC1**
- [경계] splitSegmentBySentences — should keep first piece.start === base.start and last piece.end === base.end — **AC2**
- [경계] buildSentences — should keep a short complete sentence (「はい。」) as its own segment without min-length coalescing — **AC4**
- [경계] buildSentences — should not merge cues across a speaker change into one segment — **AC5**

### [예외 / 회귀]

- [예외] splitIntoSentences — should return [] for empty or whitespace-only text — 경계
- [회귀] buildSentences — should preserve #143 adaptive sub-chunk isolation and sent-\* passthrough — **AC6**
- [회귀] buildSentences — should keep raw cues when the builder throws (fallback) — **AC6**

## AC ↔ 시나리오 교차 대조

| AC                       | 커버 시나리오          |
| ------------------------ | ---------------------- |
| AC1 (문장 1개/세그먼트)  | 정상#1, 정상#2, 경계#1 |
| AC2 (시각 비례 재분배)   | 정상#3, 경계#2         |
| AC3 (speaker·재번호)     | 정상#4                 |
| AC4 (최소길이 병합 없음) | 경계#3                 |
| AC5 (화자 경계 보존)     | 경계#4                 |
| AC6 (#143 회귀)          | 회귀#1, 회귀#2         |
