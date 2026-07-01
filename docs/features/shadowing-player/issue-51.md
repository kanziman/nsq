# Issue #51 — 재생 속도 조절

> Slice 2 · 의존성: #2(#49 기반 플레이어) · 흡수: `player-playback-rate`
> AC1 속도 프리셋 선택 → 즉시 적용 + 배지 갱신 / AC2 속도 변경 후 이동·반복 시 선택 속도 유지

---

## 1. 시그니처 명세

### ① `src/lib/utils/audio.ts` (확장)

```ts
interface AudioManager {
  // ...기존
  setPlaybackRate(rate: number): void; // el.playbackRate = clamp(rate, 0.5, 2.0)
}

export const PLAYBACK_RATE_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const DEFAULT_PLAYBACK_RATE = 1;
```

- HTMLMediaElement.playbackRate는 element 속성이라 play/pause/seek/playSegment 전반에 자동 보존된다. 리셋하지 않는 한 AC2가 자연히 충족된다.
- 방어적으로 [0.5, 2.0] 범위로 clamp 한다.

### ② `src/hooks/useShadowingPlayer.ts` (확장)

```ts
interface UseShadowingPlayerResult {
  // ...기존
  playbackRate: number; // 현재 속도 (기본 1)
  setPlaybackRate(rate: number): void; // manager.setPlaybackRate + state 갱신
}
// rateRef로 최신값 보관 → manager 생성 effect에서 재적용(에피소드 전환/재마운트 시 유지)
```

### ③ `src/components/player/AudioControls.tsx` (수정)

```ts
interface AudioControlsProps {
  // ...기존
  playbackRate: number;
  onSetPlaybackRate: (rate: number) => void;
}
// 프리셋 버튼(0.5~2.0x, aria-pressed=현재속도), 현재 속도 배지("1.25x" 형식)
```

### ④ `src/components/player/shadowing-player.tsx` (수정)

- 훅에서 `playbackRate`, `setPlaybackRate` 구조분해 → AudioControls에 전달

---

## 2. 테스트 시나리오

### `audio.ts` / AudioManager

- [정상] setPlaybackRate should set el.playbackRate when valid rate given
- [경계] setPlaybackRate should clamp to 2.0 when rate above max
- [경계] setPlaybackRate should clamp to 0.5 when rate below min
- [정상] playSegment after setPlaybackRate should preserve playbackRate (AC2)

### `useShadowingPlayer`

- [정상] setPlaybackRate should update playbackRate state and call manager (AC1)
- [정상] playbackRate should default to 1
- [정상] setPlaybackRate then next/prev should keep playbackRate on manager (AC2)
- [경계] next() should not reset playbackRate on the manager (AC2)
- [정상] while looping, loop-back should preserve playbackRate (AC2)
- [정상] switching episode should re-apply the selected playbackRate (AC2)

### `AudioControls`

- [정상] preset click should call onSetPlaybackRate with preset value (AC1)
- [정상] current rate should mark active preset (aria-pressed) and show speed badge (AC1)

### `ShadowingPlayer` (integration)

- [정상] selecting speed preset should reflect updated badge

---

## 3. AC ↔ 시나리오

| AC                                   | 커버                                                                                        |
| :----------------------------------- | :------------------------------------------------------------------------------------------ |
| **AC1** 속도 프리셋 즉시 적용 + 배지 | hook(setPlaybackRate state), AudioControls(preset click, aria-pressed + badge), integration |
| **AC2** 이동/반복 시 속도 유지       | audio(playSegment preserves rate), hook(setPlaybackRate then next/prev)                     |
