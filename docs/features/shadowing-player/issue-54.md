# Issue #54 — 키보드 단축키

> Slice 2 · 의존성: #4, #5, #6 · 흡수: `player-keyboard-shortcuts`
> AC1 Space 재생/정지 / AC2 ←/→ 세그먼트(R 반복, +/- 속도) / AC3 입력 포커스 시 비활성

---

## 1. 시그니처 명세

### ① `src/hooks/useKeyboardShortcuts.ts` (NEW)

```ts
export interface KeyboardShortcutHandlers {
  onTogglePlay: () => void; // Space
  onPrev: () => void; // ArrowLeft
  onNext: () => void; // ArrowRight
  onToggleLoop: () => void; // R / r
  onSpeedUp: () => void; // + / =
  onSpeedDown: () => void; // -
}
export interface UseKeyboardShortcutsOptions {
  enabled?: boolean; // 기본 true
}
export function useKeyboardShortcuts(
  handlers: KeyboardShortcutHandlers,
  options?: UseKeyboardShortcutsOptions,
): void;
// window 'keydown' 구독. 최신 handlers는 ref로 참조(재구독 방지).
// e.target이 INPUT/TEXTAREA/SELECT/contentEditable면 무시 (AC3).
// Space는 preventDefault (페이지 스크롤 방지).
// enabled=false면 리스너 미부착.
```

### ② `src/components/player/shadowing-player.tsx` (수정)

- `useKeyboardShortcuts` 배선: onTogglePlay=toggle, onPrev=prev, onNext=next, onToggleLoop=toggleLoop
- onSpeedUp/onSpeedDown: `PLAYBACK_RATE_PRESETS` 인덱스에서 ±1 스텝 후 `setPlaybackRate`

---

## 2. 테스트 시나리오

### `useKeyboardShortcuts`

- [정상] Space should call onTogglePlay and preventDefault (AC1)
- [정상] ArrowLeft/ArrowRight should call onPrev/onNext (AC2)
- [정상] r/R should call onToggleLoop (AC2)
- [정상] +/=/- should call onSpeedUp/onSpeedDown (AC2)
- [예외] key inside an input should be ignored (AC3)
- [예외] key inside a textarea should be ignored (AC3)
- [예외] key inside a select should be ignored (AC3)
- [예외] key inside a contenteditable should be ignored (AC3)
- [경계] unmapped key should call nothing
- [경계] enabled=false should not attach the listener
- [경계] should detach the listener on unmount

### `ShadowingPlayer` (integration)

- [정상] Space should toggle playback via keyboard (AC1)
- [정상] +/- should step playbackRate through presets (AC2)

---

## 3. AC ↔ 시나리오

| AC                         | 커버                                                        |
| :------------------------- | :---------------------------------------------------------- |
| **AC1** Space 재생/정지    | Space→onTogglePlay+preventDefault, integration Space toggle |
| **AC2** ←/→·R·+/-          | Arrow/R/±→handlers, integration ± steps presets             |
| **AC3** 입력 포커스 비활성 | input/textarea 포커스 시 무시                               |
