# Issue #55 — 집중 모드 인라인 전환

> Slice 3 · 의존성: #4 · 흡수: `player-mode`
> AC1 집중 진입 시 현재 세그먼트 1개 크게+컨트롤 유지 / AC2 이동 시 FocusPanel 갱신 / AC3 전체 복귀 시 리스트+강조 유지

---

## 1. 시그니처 명세

### ① `src/hooks/useShadowingPlayer.ts` (확장)

```ts
type PlayerMode = 'list' | 'focus';
interface UseShadowingPlayerResult {
  // ...기존
  mode: PlayerMode; // 기본 'list'
  toggleMode(): void; // list <-> focus
}
```

### ② `src/components/player/FocusPanel.tsx` (NEW)

```ts
interface FocusPanelProps {
  segment: Segment | null; // 현재 세그먼트 (없으면 안내)
  onReplay: () => void; // 현재 세그먼트 다시 듣기
}
// 화자명/타임코드 + 텍스트 크게(text-2xl) 표시, "다시 듣기" 버튼(aria-label)
// segment null 시 안내 문구, 크래시 없음
```

### ③ `src/components/player/shadowing-player.tsx` (수정)

- 훅에서 `mode`, `toggleMode` 배선
- 모드 토글 버튼: `mode==='focus' ? '전체 모드' : '집중 모드'` (aria-pressed=focus)
- `mode==='focus'`면 ScriptView 대신 FocusPanel 렌더(AudioControls·SpeakerFilter 등 컨트롤 유지)
- FocusPanel `segment = segments[currentSegmentIndex] ?? null`, `onReplay = () => goToSegment(currentSegmentIndex)`

---

## 2. 테스트 시나리오

### `useShadowingPlayer`

- [정상] mode should default to 'list'
- [정상] toggleMode should switch to focus and back to list

### `FocusPanel`

- [정상] should render the segment text and speaker name large (AC1)
- [정상] replay button should call onReplay
- [경계] null segment should render a placeholder without crashing

### `ShadowingPlayer` (integration)

- [정상] entering focus mode should show only current segment and keep controls (AC1)
- [정상] focus mode should keep the speaker filter controls (AC1)
- [경계] entering focus mode with no current segment shows a placeholder (AC1)
- [정상] moving segment in focus mode should update the panel (AC2)
- [정상] toggling back to list should restore the list with active highlight (AC3)

---

## 3. AC ↔ 시나리오

| AC                                | 커버                                                                 |
| :-------------------------------- | :------------------------------------------------------------------- |
| **AC1** 집중 진입 1개 크게+컨트롤 | FocusPanel(text/speaker), integration(only current + 재생 버튼 유지) |
| **AC2** 이동 시 패널 갱신         | integration(next → panel text 갱신)                                  |
| **AC3** 복귀 시 리스트+강조 유지  | integration(전체 모드 → list + data-active 유지)                     |
