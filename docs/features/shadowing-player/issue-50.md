# Issue #50 — 구간 선택 + A-B 구간 반복

> Slice 2 · 의존성: #49 · 흡수: `script-view-segment-select` + `player-ab-repeat`
> AC1 클릭/Shift+클릭 범위 선택 / AC2 루프 ON 반복+카운트 / AC3 루프 OFF 연속재생 복귀

---

## 1. 시그니처 명세

### ① `src/hooks/useShadowingPlayer.ts` (확장)

```ts
interface Selection {
  start: number;
  end: number;
} // 세그먼트 인덱스 범위 (start<=end)
interface UseShadowingPlayerResult {
  // ...기존
  selection: Selection | null;
  isLooping: boolean;
  repeatCount: number;
  selectSegment(index: number): void; // 단일 선택 + 앵커 설정
  extendSelectionTo(index: number): void; // Shift+클릭: 앵커~index 범위
  toggleLoop(): void; // 선택 있을 때만 루프 토글(ON 시 범위 처음으로 seek+play, count 0)
}
// 루프 동작: onTimeUpdate에서 isLooping && currentTime >= segments[selection.end].end - BOUNDARY_PARK_BACKOFF_SEC
//   → seekTo(segments[selection.start].start) + repeatCount++
```

### ② `src/components/player/ScriptView.tsx` (수정)

```ts
interface ScriptViewProps {
  segments: Segment[];
  currentSegmentIndex?: number;
  selection?: { start: number; end: number } | null; // 선택 범위 강조(data-selected)
  onSegmentClick?: (index: number, shiftKey: boolean) => void; // shiftKey 전달
}
```

### ③ `src/components/player/AudioControls.tsx` (수정)

```ts
interface AudioControlsProps {
  // ...기존
  isLooping: boolean;
  onToggleLoop: () => void;
  repeatCount: number;
  canLoop: boolean; // 선택 범위 존재 여부
}
// 루프 토글 버튼(aria-label "구간 반복", aria-pressed), 루프 중 반복 횟수 배지
```

### ④ `src/components/player/shadowing-player.tsx` (수정)

- onSegmentClick: `(i, shift) => shift ? extendSelectionTo(i) : (selectSegment(i), goToSegment(i))`
- ScriptView에 `selection` 전달, AudioControls에 loop props 전달

---

## 2. 테스트 시나리오

### `useShadowingPlayer`

- [정상] selectSegment should set single selection {i,i}
- [정상] extendSelectionTo should set sorted range from anchor
- [정상] toggleLoop should enable looping, reset repeatCount, seek to range start
- [경계] toggleLoop with no selection should be a no-op
- [정상] while looping, reaching range end should seek back to start and increment repeatCount (AC2)
- [정상] toggleLoop off should stop looping (no more loop-back) (AC3)

### `ScriptView`

- [정상] onSegmentClick should receive (index, shiftKey)
- [정상] selection range segments should be marked data-selected

### `AudioControls`

- [정상] loop toggle should call onToggleLoop
- [정상] should show repeat count badge when looping
- [경계] loop toggle disabled when canLoop is false

### `ShadowingPlayer` (integration)

- [정상] shift+click should extend selection (data-selected across range)

---

## 3. AC ↔ 시나리오

| AC                           | 커버                                                                                                        |
| :--------------------------- | :---------------------------------------------------------------------------------------------------------- |
| **AC1** 클릭/Shift 범위 선택 | ScriptView(shiftKey, data-selected) + hook(selectSegment/extendSelectionTo) + ShadowingPlayer(shift extend) |
| **AC2** 루프 반복+카운트     | hook(toggleLoop, loop-back+repeatCount) + AudioControls(badge)                                              |
| **AC3** 루프 OFF 복귀        | hook(toggleLoop off → no loop-back)                                                                         |
