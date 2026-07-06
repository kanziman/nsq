# Issue #81 — 쉐도잉 단어 강조를 실제 VTT 발화 시각에 맞춤

> 배경: #78에서 VTT 단어를 표시에서 제거하며 타이밍까지 유실 → 현재 균등분할 폴백.
> AC1 실제 VTT 시각 기반 강조 / AC2 VTT 부재·매칭 없음 시 균등분할 폴백 / AC3 표시 텍스트는 항상 공식 대본

---

## 1. 시그니처 명세

### ① `src/lib/types.ts` (확장)

```ts
export interface Segment {
  // ...기존
  /** 공식 단어별 시작 시각(초). 있으면 단어 강조에 사용, 없으면 균등분할 폴백. */
  wordStarts?: number[];
}
```

### ② `src/lib/utils/words.ts` (추가)

```ts
// 세그먼트 [start,end) 구간의 VTT 토큰 시각(오름차순)을 공식 단어 수에 비례 매핑해
// 각 공식 단어의 시작 시각 배열을 만든다. 토큰이 없으면 균등분할로 폴백.
export function computeWordStarts(
  wordCount: number,
  start: number,
  end: number,
  tokenTimes: number[],
): number[];

// 명시적 시작 시각 배열에서 현재 시간 t의 단어 인덱스.
// starts[i] <= t 인 마지막 i. 첫 시작 이전이거나 비어 있으면 -1.
export function currentWordIndexFromStarts(starts: number[], t: number): number;
```

- 기존 `findCurrentWordIndex(wordCount, start, end, t)`(균등분할)는 폴백용으로 유지.

### ③ `src/lib/services/episodes.ts` (수정)

- `getEpisodeSegments`: `subtitle.en.vtt` 존재 시 `parseVtt`로 토큰을 얻고, 각 세그먼트의
  `[start,end)` 구간 토큰 시각으로 `computeWordStarts`를 계산해 `wordStarts`를 부착.
  VTT 부재/파싱 실패/구간 토큰 없음 시 부착하지 않음(폴백). (VTT는 표시가 아닌 타이밍 전용)

### ④ `src/components/player/SegmentText.tsx` (수정)

- `highlightWords && currentTime != null`일 때: `segment.wordStarts`가 있으면
  `currentWordIndexFromStarts`로 현재 단어 판정, 없으면 기존 `findCurrentWordIndex`(균등분할).
- 표시 텍스트는 언제나 `segment.text`(공식 대본). VTT 단어는 노출하지 않음(#78 회귀 방지).

---

## 2. 테스트 시나리오

### `computeWordStarts`

- [정상] should map official words to VTT token times proportionally when tokens exist (AC1)
- [정상] should place the first word at the first token time, not the segment start (AC1)
- [경계] should fall back to even distribution when no tokens in the window (AC2)
- [경계] should return [] when wordCount is 0

### `currentWordIndexFromStarts`

- [정상] should return the last word whose start <= t
- [경계] should return -1 before the first word start
- [경계] should return -1 for empty starts

### `SegmentText`

- [정상] should highlight by wordStarts timing when present (AC1)
- [경계] should fall back to even distribution when wordStarts is absent (AC2)
- [정상] should always render official text, never VTT words (AC3)

### `getEpisodeSegments`

- [정상] should attach wordStarts from VTT tokens within each segment window (AC1)
- [경계] should not attach wordStarts when subtitle.en.vtt is missing (AC2)
- [예외] should fall back (no wordStarts) when subtitle.en.vtt is malformed (AC2)

---

## 3. AC ↔ 시나리오

| AC                         | 커버                                                                                      |
| :------------------------- | :---------------------------------------------------------------------------------------- |
| **AC1** 실제 VTT 시각 강조 | computeWordStarts(proportional/first-token), getEpisodeSegments(attach), SegmentText(use) |
| **AC2** 폴백(회귀 없음)    | computeWordStarts(no tokens), getEpisodeSegments(missing/malformed), SegmentText(absent)  |
| **AC3** 표시 텍스트 공식   | SegmentText(always official text)                                                         |
