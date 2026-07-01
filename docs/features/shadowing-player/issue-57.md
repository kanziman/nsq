# Issue #57 — VTT 단어 강조 (재생 중 현재 단어 이동)

> Slice 3 · 의존성: #2 · 흡수 유틸: `utils-vtt-parser`(기존 `parseVtt` 재사용)
> AC1 VTT 있으면 현재 단어 개별 강조 + 진행에 따라 이동 / AC2 VTT 부재·실패 시 세그먼트 레벨 폴백(에러 없음)

---

## 1. 시그니처 명세

### ① `src/lib/utils/words.ts` (NEW)

```ts
import type { Segment, VttToken } from '@/lib/types';

// 토큰을 [start, end) 시간 범위로 각 세그먼트 words에 매핑. 매칭 없으면 words 미부여.
export function mapWordsToSegments(
  segments: Segment[],
  tokens: VttToken[],
): Segment[];

// 현재 시간에 해당하는 단어 인덱스(start<=t 인 마지막 단어). words 없으면 -1.
export function findCurrentWordIndex(
  words: VttToken[] | undefined,
  t: number,
): number;
```

### ② `src/lib/services/episodes.ts` (수정)

- `getEpisodeSegments`: `subtitle.en.vtt` 존재 시 `parseVtt()` → `mapWordsToSegments()` 적용.
- 파일 부재/파싱 실패 시 segments 원본 반환(폴백, throw 없음).

### ③ `src/components/player/ScriptView.tsx` / `FocusPanel.tsx` (수정)

```ts
// currentTime?: number prop 추가
// 활성 세그먼트(ScriptView) 또는 현재 세그먼트(FocusPanel)가 words를 가지면
//   단어별 <span data-current-word={j===cur || undefined}>로 렌더, 현재 단어 강조
// words 없으면 기존 plain text 렌더(폴백, AC2)
```

### ④ `src/components/player/shadowing-player.tsx` (수정)

- `currentTime`를 ScriptView와 FocusPanel에 전달.

---

## 2. 테스트 시나리오

### `words.ts`

- [정상] mapWordsToSegments should assign tokens within a segment's time range
- [경계] mapWordsToSegments should leave words undefined when no token matches
- [정상] findCurrentWordIndex should return the last word with start <= t
- [경계] findCurrentWordIndex should return -1 before the first word or when words undefined

### `ScriptView` (단어 강조)

- [정상] active segment with words should render word spans and mark the current word (AC1)
- [경계] segment without words should fall back to plain text (AC2)

### `FocusPanel` (단어 강조)

- [정상] segment with words should mark the current word by currentTime (AC1)
- [경계] segment without words should render plain text (AC2)

### `episodes.getEpisodeSegments`

- [경계] should return raw segments when no VTT file exists (AC2)
- [예외] should fall back to raw segments when subtitle.en.vtt is malformed (AC2)
- [정상] should map VTT words into segments when subtitle.en.vtt exists (AC1)

---

## 3. AC ↔ 시나리오

| AC                          | 커버                                                                                      |
| :-------------------------- | :---------------------------------------------------------------------------------------- |
| **AC1** 현재 단어 강조·이동 | words(mapWordsToSegments, findCurrentWordIndex), ScriptView·FocusPanel(data-current-word) |
| **AC2** VTT 부재·실패 폴백  | words(no-match undefined), episodes(no VTT → raw), components(plain text 폴백)            |
