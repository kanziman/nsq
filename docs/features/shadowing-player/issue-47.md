# Issue #47 — 오디오 연속 재생 + 현재 세그먼트 강조

> Slice 1 · 의존성: #46 · 흡수 유틸: `utils-audio`(audio.ts 1차)
> AC1 연속재생(경계서 안 멈춤) / AC2 재생 중 현재 세그먼트 강조 / AC3 ended 정지+마지막 강조

---

## 1. 시그니처 명세

### ① `src/lib/utils/audio.ts`

```ts
export interface AudioManager {
  play(): void;
  pause(): void;
  getCurrentTime(): number;
  onTimeUpdate(cb: (currentTime: number) => void): () => void; // unsubscribe 반환
  onEnded(cb: () => void): () => void; // unsubscribe 반환
  destroy(): void;
}
// element 미주입 시 new Audio(src). 테스트는 fake element 주입(DI).
export function createAudioManager(
  src: string,
  element?: HTMLAudioElement,
): AudioManager;
```

### ② `src/hooks/useShadowingPlayer.ts`

```ts
interface UseShadowingPlayerArgs {
  episodeId: string;
  segments: Segment[];
}
interface UseShadowingPlayerResult {
  isPlaying: boolean;
  currentSegmentIndex: number; // 재생 전/첫 세그먼트 이전 -1
  play(): void;
  pause(): void;
  toggle(): void;
}
export function useShadowingPlayer(
  args: UseShadowingPlayerArgs,
): UseShadowingPlayerResult;
// 내부: createAudioManager(`/api/episodes/${episodeId}/audio`) 소유(useRef)
//   onTimeUpdate → currentTime로 currentSegmentIndex 산출(start<=t인 마지막 세그먼트, t<첫 start면 -1)
//   경계에서 pause 호출하지 않음(연속재생). onEnded → isPlaying=false, 마지막 인덱스 유지. cleanup: destroy
```

### ③ `src/components/player/AudioControls.tsx`

```ts
interface AudioControlsProps {
  isPlaying: boolean;
  onToggle: () => void;
}
export default function AudioControls(
  props: AudioControlsProps,
): React.ReactElement;
// 재생/정지 토글 버튼(aria-label: 재생|일시정지), onToggle 호출
```

### ④ `src/components/player/shadowing-player.tsx` (재작성)

```ts
interface ShadowingPlayerProps {
  episode: Episode;
  segments: Segment[];
}
export function ShadowingPlayer(
  props: ShadowingPlayerProps,
): React.ReactElement; // 'use client'
// useShadowingPlayer 연결 → 상단 dark 플레이어(AudioControls) + 하단 ScriptView(currentSegmentIndex)
```

### ⑤ `src/components/player/ScriptView.tsx` (수정)

- `React.memo`로 감싸 고빈도 리렌더 격리 (currentSegmentIndex 강조 동작은 #46에 이미 구현됨, 검증 추가)

### ⑥ `src/app/episodes/[id]/page.tsx` (수정)

- 인라인 ScriptView/스켈레톤 → `<ShadowingPlayer episode={episode} segments={segments} />`로 교체(좌측), 우측 튜터 골격 유지

---

## 2. 테스트 시나리오

### `createAudioManager` (audio.ts)

- [정상] should delegate play()/pause() to the element
- [정상] onTimeUpdate should invoke cb with currentTime on 'timeupdate' event
- [정상] onEnded should invoke cb on 'ended' event
- [정상] getCurrentTime should return element.currentTime
- [경계] unsubscribe returned by onTimeUpdate should remove the listener
- [정상] destroy should pause and detach listeners

### `useShadowingPlayer` (hook)

- [정상] play() should set isPlaying true and call manager.play
- [정상] pause() should set isPlaying false and call manager.pause
- [정상] toggle() should flip play/pause
- [정상] currentSegmentIndex should track currentTime via timeupdate (AC2)
- [경계] currentSegmentIndex should be -1 before first segment start
- [정상] should NOT call manager.pause when crossing segment boundaries (continuous, AC1)
- [정상] on ended should set isPlaying false and retain last segment index (AC3)

### `AudioControls`

- [정상] should render play control and call onToggle on click when paused
- [정상] should reflect playing state (aria-label 일시정지) when isPlaying

### `ShadowingPlayer` (integration, audio mocked)

- [정상] should render segments through ScriptView
- [정상] clicking play should start playback (manager.play, AC1)
- [정상] timeupdate should mark the current segment active (AC2)

### `ScriptView`

- [정상] should mark segment at currentSegmentIndex as active (data-active)

---

## 3. AC ↔ 시나리오 교차 대조

| AC                               | 커버                                                                                                |
| :------------------------------- | :-------------------------------------------------------------------------------------------------- |
| **AC1** 연속재생(경계서 안 멈춤) | useShadowingPlayer(no pause on boundary) + ShadowingPlayer(play) + createAudioManager(play)         |
| **AC2** 현재 세그먼트 강조       | useShadowingPlayer(timeupdate index) + ScriptView(data-active) + ShadowingPlayer(timeupdate active) |
| **AC3** ended 정지+마지막 강조   | useShadowingPlayer(ended → isPlaying false, index retained)                                         |
