# Issue #52 — 화자 필터링 (자동 스킵 재생)

> Slice 2 · 의존성: #4 · 흡수: `player-speaker-filter`
> AC1 대상만 연속 재생 + 비대상 자동 스킵 / AC2 비대상 dim / AC3 대상 0개 자동 해제 + 안내

---

## 1. 시그니처 명세

### ① `src/hooks/useShadowingPlayer.ts` (확장)

```ts
import type { SpeakerKey } from '@/lib/constants/speakers';

interface UseShadowingPlayerResult {
  // ...기존
  enabledSpeakers: SpeakerKey[]; // 재생 대상 화자 (기본: 전체 4종)
  isSpeakerFilterActive: boolean; // 존재 화자 중 일부만 활성일 때 true
  filterNotice: string | null; // 대상 0개 자동 해제 안내 (AC3)
  toggleSpeaker(speaker: SpeakerKey): void;
  dismissFilterNotice(): void;
}
// onTimeUpdate: 재생 중 현재 세그먼트 speaker가 비활성이면
//   다음 활성 세그먼트 start로 seek (AC1). 뒤에 활성 없으면 pause.
// toggleSpeaker: 토글 결과 대상(존재화자 ∩ 활성) 0개면 → 전체 복원 + filterNotice (AC3)
```

### ② `src/components/player/SpeakerFilter.tsx` (NEW)

```ts
interface SpeakerFilterProps {
  enabledSpeakers: SpeakerKey[];
  onToggleSpeaker: (speaker: SpeakerKey) => void;
}
// SPEAKER_COLORS 순회로 4개 토글 버튼(Angela/Steven/Both/Narrator)
// aria-pressed = 활성 여부, aria-label = `${name} 화자 필터`
```

### ③ `src/components/player/ScriptView.tsx` (수정)

```ts
interface ScriptViewProps {
  // ...기존
  dimmedSpeakers?: SpeakerKey[]; // 해당 speaker 세그먼트 dim (data-dimmed + opacity)
}
```

### ④ `src/components/player/shadowing-player.tsx` (수정)

- 훅에서 `enabledSpeakers`, `isSpeakerFilterActive`, `toggleSpeaker` 등 배선
- `dimmedSpeakers = isSpeakerFilterActive ? ALL_SPEAKERS - enabledSpeakers : []`
- SpeakerFilter 렌더 + filterNotice 안내 표시

---

## 2. 테스트 시나리오

### `useShadowingPlayer`

- [정상] enabledSpeakers should default to all four speakers
- [정상] isSpeakerFilterActive should be false by default
- [정상] toggleSpeaker should remove/add a speaker from enabledSpeakers
- [정상] toggleSpeaker(one off) should mark isSpeakerFilterActive true
- [정상] while playing, entering a disabled-speaker segment should seek to next enabled segment start (AC1)
- [경계] while playing, no enabled segment ahead should pause (AC1)
- [경계] filter skip should not run while paused
- [경계] speaker filter skip should be suppressed while A-B looping (AC1)
- [정상] toggling all present speakers off should auto-restore all + set filterNotice (AC3)
- [정상] dismissFilterNotice should clear filterNotice

### `SpeakerFilter`

- [정상] should render a toggle button per speaker with aria-pressed reflecting enabled
- [정상] clicking a speaker button should call onToggleSpeaker with that key

### `ScriptView`

- [정상] segments whose speaker ∈ dimmedSpeakers should be marked data-dimmed
- [경계] no dimmedSpeakers should mark nothing dimmed

### `ShadowingPlayer` (integration)

- [정상] toggling a speaker off should dim its segments in the script (AC2)

---

## 3. AC ↔ 시나리오

| AC                              | 커버                                                                              |
| :------------------------------ | :-------------------------------------------------------------------------------- |
| **AC1** 대상만 재생 + 자동 스킵 | hook(seek to next enabled while playing, pause when none ahead, no-skip on pause) |
| **AC2** 비대상 dim              | ScriptView(data-dimmed), ShadowingPlayer(integration dim)                         |
| **AC3** 대상 0개 자동 해제+안내 | hook(toggle all off → auto-restore + filterNotice, dismissFilterNotice)           |
