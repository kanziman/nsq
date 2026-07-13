# Issue #4: 세그먼트 파형 시각화

## 1. 구현 대상 (컴포넌트 및 로직)

- **`src/hooks/useWaveform.ts`** (NEW)
  - `audioUrl`과 `segment`를 받아 Web Audio API를 이용해 파형 데이터(숫자 배열)를 생성.
  - 디코딩된 `AudioBuffer`는 에피소드 단위로 캐싱(혹은 `audioUrl` 단위).
- **`src/components/player/AudioWaveform.tsx`** (NEW)
  - `waveform` 배열, `currentTime`, `segmentStart`, `segmentEnd`, `onSeek` prop을 받음.
  - 배열을 순회하며 막대(div)를 렌더링.
  - 현재 시간에 해당하는 바깥쪽 진행률을 바탕으로 `primary`(과거) / `surface-dark-soft`(미래) 색상 구분.
  - 클릭 시 해당 비율을 기반으로 `onSeek` 호출.
- **`src/components/player/AudioControls.tsx`**
  - 기존 시크바와 재생 버튼 사이에 `AudioWaveform` 배치 (현재 세그먼트가 있을 경우에만, 또는 빈 상태로).
- **`src/components/player/shadowing-player.tsx`**
  - `useWaveform` 훅을 호출하여 오디오 파형 데이터 획득, `AudioControls`에 주입.

## 2. 테스트 시나리오

[정상] useWaveform — should fetch and decode audio data
[경계] useWaveform — should return empty array if decode fails or segment is invalid
[정상] AudioWaveform — should render bars based on waveform data
[정상] AudioWaveform — should highlight bars up to currentTime
[정상] AudioWaveform — clicking a bar should call onSeek with calculated time
[경계] AudioWaveform — should render placeholder or flat bar if waveform is empty
[정상] AudioControls — should render AudioWaveform component
[정상] shadowing-player — should pass correct waveform data to AudioControls
