# Issue #49 — 세그먼트 단위 이동 + 경계 park

> Slice 1 (마지막) · 의존성: #48 · 흡수: `player-boundary`
> AC1 ⏮/⏭ 인접 이동 / AC2 세그먼트 클릭 seek+재생 / AC3 경계 공유 시 누수 없이 park

---

## 1. 시그니처 명세

### ① `src/lib/utils/audio.ts` (확장)

```ts
export const BOUNDARY_PARK_BACKOFF_SEC = 0.05;
export interface AudioManager {
  // ...기존
  playSegment(start: number, end: number): void;
  // start로 seek 후 재생, currentTime이 (end - BACKOFF)에 도달하면 pause + 그 지점에 park
  // (인접 세그먼트 end===start 누수 방지)
}
```

### ② `src/hooks/useShadowingPlayer.ts` (확장)

```ts
interface UseShadowingPlayerResult {
  // ...기존
  next(): void; // 다음 세그먼트 start로 seek (재생상태 보존), 마지막에서 클램프
  prev(): void; // 이전 세그먼트 start로 seek, 0에서 클램프
  goToSegment(index: number): void; // 해당 세그먼트 start로 seek + play (클릭)
}
```

### ③ `src/components/player/AudioControls.tsx` (확장)

```ts
interface AudioControlsProps {
  // ...기존
  onPrev: () => void;
  onNext: () => void;
}
// ⏮(aria-label "이전 세그먼트") / ⏭("다음 세그먼트") 버튼 추가
```

### ④ `src/components/player/ScriptView.tsx`

- 변경 없음 — 기존 `onSegmentClick`(클릭 시 index 전달) 그대로 활용

### ⑤ `src/components/player/shadowing-player.tsx` (수정)

- AudioControls에 `onPrev={prev}`/`onNext={next}` 전달
- ScriptView에 `onSegmentClick={goToSegment}` 전달

---

## 2. 테스트 시나리오

### `createAudioManager` (audio.ts)

- [정상] playSegment should seek to start and play
- [정상] playSegment should pause and park at (end - BACKOFF) when reaching boundary
- [경계] playSegment should not bleed into next segment when end === next.start

### `useShadowingPlayer`

- [정상] next() should seek to next segment start
- [정상] prev() should seek to previous segment start
- [경계] next() at last segment should stay (clamp)
- [경계] prev() at first segment should stay (clamp)
- [정상] goToSegment(i) should seek to segment start and play

### `AudioControls`

- [정상] should call onPrev/onNext when ⏮/⏭ clicked

### `ShadowingPlayer` (integration)

- [정상] clicking a segment should seek to its start and start playback
- [정상] ⏭ should advance highlight to the next segment

---

## 3. AC ↔ 시나리오

| AC                          | 커버                                                                                         |
| :-------------------------- | :------------------------------------------------------------------------------------------- |
| **AC1** ⏮/⏭ 인접 이동     | useShadowingPlayer(next/prev) + AudioControls(onPrev/onNext) + ShadowingPlayer(⏭ 강조 전진) |
| **AC2** 클릭 seek+재생      | useShadowingPlayer(goToSegment) + ShadowingPlayer(클릭→seekTo+play)                          |
| **AC3** 경계 누수 없이 park | createAudioManager(playSegment park, end===start 누수 방지)                                  |
