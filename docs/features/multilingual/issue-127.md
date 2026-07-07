# Issue #127 — [multilingual] 일본어 단어 하이라이트 + 사전 링크

> `/test-scenarios 127` 산출. 승인 게이트는 사용자 상시 정책(추천안 자동 진행)으로 통과 처리.

## 1. 시그니처 명세

### 1-1. 토크나이저 (`src/lib/utils/tokenize.ts`, 신규)

```ts
/** Intl.Segmenter 기반 단어 토큰. isWord=false는 구두점·공백 등 비단어. */
export interface WordToken {
  text: string;
  isWord: boolean;
}

/** 네이버 일본어사전 검색 URL. */
export function naverJaDictUrl(word: string): string; // encodeURIComponent 적용

/**
 * ja 텍스트를 Intl.Segmenter('ja', {granularity:'word'})로 단어 토큰 분해.
 * - 토큰 join === 원문(무손실).
 * - Intl.Segmenter 미지원 환경: 전체 텍스트 1개 단어 토큰 폴백(크래시 없음).
 * - 빈 문자열 → [].
 */
export function tokenizeJa(text: string): WordToken[];
```

### 1-2. SegmentText (`src/components/player/SegmentText.tsx`)

```ts
interface SegmentTextProps {
  segment: Segment;
  highlightWords?: boolean;
  currentTime?: number;
  className?: string;
  language?: LanguageCode; // 신규, 기본 'en' — 기존 회귀 없음
}
```

- **ja 경로**: 항상 `tokenizeJa`로 분해(세그먼트 단위 `useMemo` 메모이제이션 — 재생 틱 재분해 금지).
  - 렌더: 토큰을 순서대로 공백 삽입 없이 출력. 단어 토큰만 클릭 가능 스팬.
  - 하이라이트: `highlightWords && currentTime != null`일 때 단어 토큰 수 기준 균등분할
    (`findCurrentWordIndex` 재사용, `wordStarts` 없음 전제 B9)로 현재 단어 토큰 강조.
  - 클릭: 단어 토큰 클릭 → `window.open(naverJaDictUrl(word), '_blank', 'noopener,noreferrer')`,
    `stopPropagation`으로 세그먼트 클릭(탐색/선택)과 분리.
- **en 경로**: 기존 공백 분해·하이라이트·비클릭 동작 완전 무변경.

### 1-3. 배선 (`ScriptView.tsx`, `FocusPanel.tsx`, `shadowing-player.tsx`)

- `ScriptViewProps.language?: LanguageCode`, `FocusPanelProps.language?: LanguageCode` — `SegmentText`로 전달.
- `ShadowingPlayer`: `episode.language ?? 'en'`을 ScriptView·FocusPanel에 전달.

## 2. 테스트 시나리오

### tokenizeJa (tokenize)

- [x] [정상] tokenizeJa — should split ja text into word tokens covering the original text losslessly
- [x] [정상] tokenizeJa — should mark punctuation as non-word tokens
- [x] [경계] tokenizeJa — should return empty array for empty text
- [x] [예외] tokenizeJa — should fall back to a single word token when Intl.Segmenter is unavailable

### SegmentText (ja)

- [x] [정상] SegmentText — should render ja tokens without inserting spaces when language is 'ja'
- [x] [정상] SegmentText — should highlight exactly one current word token when active and currentTime advances
- [x] [정상] SegmentText — should open naver ja dictionary in a new tab when a word token is clicked
- [x] [정상] SegmentText — should stop click propagation so segment click(seek) is not triggered
- [x] [경계] SegmentText — should keep word tokens clickable without highlight when currentTime is undefined
- [x] [정상] SegmentText — should keep whitespace-based en highlight unchanged (기존 회귀)

### 배선 (ScriptView / ShadowingPlayer)

- [x] [정상] ScriptView — should forward language to SegmentText so ja words are clickable
- [x] [정상] ShadowingPlayer — should derive language from episode.language and enable ja word links

## 3. AC 교차 대조

| AC                                                         | 커버 시나리오                                    |
| :--------------------------------------------------------- | :----------------------------------------------- |
| AC1: 재생 중 현재 단어 토큰 순차 강조(문장 통째 강조 아님) | SegmentText 하이라이트 + tokenizeJa 무손실 분해  |
| AC2: 단어 클릭 → 네이버 일본어사전 새 탭                   | 사전 링크 + 전파 차단 + ScriptView/Player 배선   |
| AC3: en 기존 공백 기반 하이라이트 유지                     | en 회귀 시나리오 + 기존 SegmentText/words 테스트 |
