# issue-142 — ja 하이라이트: 세그먼트 진입 시 선두 무타임스탬프 단어 붕괴

> 클릭해 세그먼트 처음부터 재생하면 첫 단어가 아니라 선두 클러스터의 꼬리 단어(예: 「たら」)부터 하이라이트되는 버그. 실측: `C9VabhxOPbA` `sent-2` `[9.16–23.35]`.

## 근본 원인 (요약)

유튜브 롤링 자동자막에서 선두 단어(えー…やっ)에 개별 인라인 타임스탬프가 없어, `computeWordStartsAligned`의 첫 표면 앵커(「たら」@9.16 == seg.start) 이전 단어들이 전부 `wordStarts = start`로 붕괴한다. `currentWordIndexFromStarts`는 동률 시각에서 **마지막 인덱스**를 반환하므로 진입 시점(t≈start)에 붕괴 런의 꼬리(「たら」)가 강조된다.

## 시그니처 (동작 계약 강화, 시그니처 불변)

```ts
// src/lib/utils/words.ts
computeWordStartsAligned(
  officialWords: string[],
  start: number,
  end: number,
  vttTokens: { word: string; start: number }[],
): number[]
```

### 추가 계약

- **G-lead(선두 붕괴 제거)**: `starts[0] === start`이고 start와 값이 같은 선두 런 `starts[1..k]`(k≥1)가 존재하면, `(start, hiTime)` 사이로 인덱스 비례 **순증 재분배**한다. `hiTime`은 그 런 다음의 첫 구별 시각(`starts[k+1] > start`), 없으면 `end`. 결과적으로 `currentWordIndexFromStarts(starts, start) === 0`.

### 내부 헬퍼 (비공개)

```ts
decollapseLeadingRun(starts: number[], start: number, end: number): number[]
```

- 선두 등가-시각 런을 `(start, hiTime)`로 순증 분배. 인라인 처리도 무방.

### 불변 (기존 계약 유지 · 회귀 검증)

- 반환 길이 = `officialWords.length`; `[start, end)` 내 단조 비감소; 마지막 단어 < `end`.
- 구별 앵커 단어의 start는 매칭된 VTT 토큰 시각과 정확히 일치.
- 앵커 없음 / `vttTokens` 빈 배열 → `computeWordStarts`(위치-비례/균등분할) 폴백.
- `currentWordIndexFromStarts`, `SegmentText`, `episodes.ts`, `useShadowingPlayer` **무변경**.

### 경계 / 예외

- `officialWords` 빈 배열 → `[]`.
- 전량 붕괴(단일 앵커@start 등) → `(start, end)`로 분배.
- `officialWords.length === 1` → `[start]` 그대로.

## 테스트 시나리오

### [정상]

- [정상] computeWordStartsAligned — should make `currentWordIndexFromStarts(ws, start) === 0` when leading words collapse to segment start (sent-2류 입력) — **AC1**
- [정상] computeWordStartsAligned — should spread a collapsed leading run strictly increasing between start and the next distinct anchor time — **AC2**
- [정상] computeWordStartsAligned — should keep each distinct anchored word start exactly at its matched VTT token time (앵커 정확도 무회귀) — **AC4**
- [정상] currentWordIndexFromStarts — should advance the highlighted index in order without jumping backward as t passes each word start — **AC3**

### [경계]

- [경계] computeWordStartsAligned — should keep `starts[0]` exactly equal to `start` after de-collapse — **AC1/AC2**
- [경계] computeWordStartsAligned — should distribute words across `(start, end)` when every word collapses to start (single anchor at start) — **AC2**
- [경계] computeWordStartsAligned — should remain monotonically non-decreasing within `[start, end)` and keep the last word `< end` — **AC3**
- [경계] computeWordStartsAligned — should return `[start]` unchanged when `officialWords` has length 1 — 경계

### [예외 / 폴백]

- [예외] computeWordStartsAligned — should fall back to positional mapping (no crash) when there are no surface-form anchors — **AC4**
- [예외] computeWordStartsAligned — should fall back to uniform split when `vttTokens` is empty — **AC4**
- [예외] computeWordStartsAligned — should return `[]` when `officialWords` is empty — 경계

## AC ↔ 시나리오 교차 대조

| AC                            | 커버 시나리오          |
| ----------------------------- | ---------------------- |
| AC1 (진입 → 첫 단어)          | 정상#1, 경계#1         |
| AC2 (붕괴 제거·분산)          | 정상#2, 경계#1, 경계#2 |
| AC3 (순서 진행·단조)          | 정상#4, 경계#3         |
| AC4 (앵커 정확도·폴백 무회귀) | 정상#3, 예외#1, 예외#2 |
