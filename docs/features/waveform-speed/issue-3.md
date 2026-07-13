# Issue #3: 속도 슬라이더 (0.05 단위)

## 1. 구현 대상 (컴포넌트 및 로직)

- **`src/components/player/SpeedSlider.tsx`** (NEW)
  - `playbackRate`, `onSetPlaybackRate` prop
  - `-` 버튼 (0.05 감소), `+` 버튼 (0.05 증가)
  - `input type="range"` (min 0.5, max 2.0, step 0.05)
  - 현재 속도 텍스트 (클릭 시 1.0x 리셋)
  - 슬라이더 더블클릭 시 1.0x 리셋
- **`src/components/player/AudioControls.tsx`**
  - 기존 프리셋 버튼 그룹을 `SpeedSlider`로 교체
- **`src/components/player/shadowing-player.tsx`**
  - 단축키 `+/-` 입력 시 `stepPlaybackRate`가 프리셋 배열 기반이 아닌 0.05 단위 가감으로 동작하도록 수정
- **`src/lib/utils/audio.ts`**
  - `PLAYBACK_RATE_PRESETS`는 제거하거나 사용하지 않음
  - `MIN_PLAYBACK_RATE = 0.5`, `MAX_PLAYBACK_RATE = 2.0` 상수를 익스포트 (슬라이더에서 사용)

## 2. 테스트 시나리오

[정상] SpeedSlider — should render slider, +/-, and speed text
[정상] SpeedSlider — should increase by 0.05 when + is clicked
[경계] SpeedSlider — should clamp to 0.50x when - is clicked at minimum
[경계] SpeedSlider — should clamp to 2.00x when + is clicked at maximum
[정상] SpeedSlider — should reset to 1.00x when speed text is clicked
[정상] SpeedSlider — should reset to 1.00x when slider is double-clicked
[정상] shadowing-player — should change playback rate by 0.05 on keyboard shortcuts
