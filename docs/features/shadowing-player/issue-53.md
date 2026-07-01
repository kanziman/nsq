# Issue #53 — 번역 blur 처리 + 전체 토글

> Slice 2 · 의존성: #1 · 흡수: `script-view-translation-blur`
> AC1 번역 기본 blur / AC2 hover·클릭 시 해당 번역만 선명 / AC3 전체 토글 일괄 표시·숨김

---

## 1. 시그니처 명세

### `src/components/player/ScriptView.tsx` (수정) — 자기완결(내부 상태)

```ts
// 추가 내부 state
const [revealAll, setRevealAll] = useState(false);
const [revealed, setRevealed] = useState<Set<number>>(new Set());

// 번역 존재 세그먼트만 렌더:
//   <p data-translation
//      data-blurred={!(revealAll || revealed.has(i)) || undefined}
//      onClick={(e) => { e.stopPropagation(); toggleRevealed(i); }}
//      className={blur ? 'blur-sm hover:blur-none' : ''} />
// hasTranslation = segments.some(s => s.translation) 일 때만 전체 토글 버튼 렌더:
//   <button aria-label="번역 전체 토글" aria-pressed={revealAll}
//           onClick={() => setRevealAll(v => !v)}>번역 {revealAll ? '숨기기' : '보기'}</button>
```

- **Props 변경 없음** — 번역 표시 상태는 ScriptView 내부에서 관리.
- 개별 번역 클릭은 세그먼트 seek(onSegmentClick)로 전파되지 않도록 `stopPropagation`.
- hover 선명은 CSS(`hover:blur-none`)로 처리(무상태).

---

## 2. 테스트 시나리오

### `ScriptView` (번역)

- [정상] translation should render blurred by default (data-blurred) (AC1)
- [경계] segments without translation should not render a translation node
- [경계] no translation in any segment should not render the global toggle
- [정상] clicking a translation should reveal only that one (AC2)
- [정상] clicking a translation should not trigger onSegmentClick (AC2)
- [정상] blurred translation should carry hover:blur-none class (AC2 hover)
- [정상] global toggle should reveal all translations, toggle again hides all (AC3)
- [경계] global hide should also clear individually revealed items (AC3)
- [정상] global toggle button aria-pressed should reflect revealAll (AC3)

---

## 3. AC ↔ 시나리오

| AC                           | 커버                                                                     |
| :--------------------------- | :----------------------------------------------------------------------- |
| **AC1** 번역 기본 blur       | translation renders blurred by default (data-blurred)                    |
| **AC2** hover·클릭 개별 선명 | click reveals only that one, click no seek(stopPropagation), hover class |
| **AC3** 전체 토글 일괄       | global toggle reveal/hide all, aria-pressed reflects state               |
