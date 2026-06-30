# Issue #48 — 자동 스크롤 + 진행바 seek

> Slice 1 · 의존성: #47 · 흡수 유틸: `utils-audio`(seek/duration 확장)
> AC1 자동 스크롤 / AC2 진행바 seek / AC3 현재·전체 시간 실시간 갱신

---

## 1. 시그니처 명세

### ① `src/lib/utils/audio.ts` (확장)

```ts
export interface AudioManager {
  // ...기존
  seekTo(time: number): void; // el.currentTime = time
  getDuration(): number; // el.duration (메타 로드 전 NaN 가능)
}
```

### ② `src/hooks/useShadowingPlayer.ts` (확장)

```ts
interface UseShadowingPlayerResult {
  // ...기존
  currentTime: number; // timeupdate로 갱신
  seekTo(time: number): void; // manager.seekTo + 인덱스/currentTime 즉시 갱신
}
// onTimeUpdate 핸들러가 setCurrentTime(t)도 수행
```

### ③ `src/components/player/AudioControls.tsx` (확장)

```ts
interface AudioControlsProps {
  isPlaying: boolean;
  onToggle: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}
// 진행바는 <input type="range" aria-label="탐색"> (a11y + 테스트 용이),
// onChange → onSeek(Number(value)). 좌/우에 formatTime(currentTime)/formatTime(duration) 표시
```

### ④ `src/components/player/ScriptView.tsx` (수정)

- 현재 세그먼트 element ref + `useEffect([currentSegmentIndex])`에서
  `scrollIntoView({ behavior: 'smooth', block: 'center' })` 호출

### ⑤ `src/components/player/shadowing-player.tsx` (수정)

- 훅의 `currentTime`/`seekTo`를 AudioControls에 전달, `duration`은 `episode.duration`(meta) 사용

---

## 2. 테스트 시나리오

### `createAudioManager` (audio.ts)

- [정상] seekTo should set element.currentTime
- [정상] getDuration should return element.duration

### `useShadowingPlayer`

- [정상] currentTime should update from timeupdate
- [정상] seekTo should call manager.seekTo and update currentTime/currentSegmentIndex

### `AudioControls`

- [정상] should render current/total time via formatTime
- [정상] should call onSeek with new value when range changes
- [정상] (기존) play/pause 토글 유지

### `ScriptView`

- [정상] should call scrollIntoView on the active segment when currentSegmentIndex changes
- [경계] should not throw when no active segment (currentSegmentIndex = -1)

### `ShadowingPlayer` (integration)

- [정상] should pass episode.duration as total time to the progress bar

---

## 3. AC ↔ 시나리오

| AC                     | 커버                                                                                            |
| :--------------------- | :---------------------------------------------------------------------------------------------- |
| **AC1** 자동 스크롤    | ScriptView(scrollIntoView on index change)                                                      |
| **AC2** 진행바 seek    | AudioControls(onSeek) + useShadowingPlayer(seekTo→index/currentTime)                            |
| **AC3** 현재/전체 시간 | AudioControls(formatTime display) + useShadowingPlayer(currentTime) + ShadowingPlayer(duration) |
