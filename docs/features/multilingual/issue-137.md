# Issue #137 — ja 단어 하이라이트 타이밍 부정확 (VTT 실측 wordStarts 미부착)

> phase2-multilingual 후속. ja 자막 전용 에피소드에서 균등분할 하이라이트가 실제 발화와 최대 1.6s 어긋남.
> 데이터(`subtitle.ja.vtt` 인라인 단어 타임스탬프)는 이미 존재하나 소비하지 않음.

## 시그니처 명세

### 1. `getEpisodeSegments(id: string): Promise<Segment[]>` — 시그니처 불변, 내부 일반화

- `meta.json`에서 `language`를 읽어 부재 시 `'en'` 폴백.
- VTT 경로를 `subtitle.en.vtt` → **`subtitle.{language}.vtt`** 로 일반화.
- 세그먼트 단어 수 계산을 언어별로 분기:
  - `en`: `splitWords(seg.text).length` (기존)
  - `ja`: `tokenizeJa(seg.text).filter(t => t.isWord).length`
    (공백 없음 → 토큰 기준. `SegmentText` 렌더 서수 수와 일치해야 `wordStarts` 소비 가능)
- `wordCount === 0`이면 부착 스킵(폴백).
- 나머지(`computeWordStarts`, `audioStart = times[0]`, try/catch 폴백)는 기존과 동일.

### 2. `SegmentText` — Props 불변, ja 하이라이트 경로에 `wordStarts` 우선 소비

```
currentOrdinal =
  segment.wordStarts && segment.wordStarts.length === wordOrdinalByIndex.size
    ? currentWordIndexFromStarts(segment.wordStarts, currentTime)   // 실측 발화 시각
    : findCurrentWordIndex(size, segment.start, segment.end, currentTime) // 균등분할 폴백(B9)
```

en 경로(`splitWords`)는 이미 동일 패턴 존재 → 무변경.

### 에러/폴백 케이스

| 상황                                 | 동작                                     |
| :----------------------------------- | :--------------------------------------- |
| `meta.json` 부재                     | `language='en'` 폴백 (en 회귀 없음, AC3) |
| `subtitle.{lang}.vtt` 부재/malformed | 부착 스킵, 크래시 없음 (AC4)             |
| 구간 토큰 없음                       | 부착 스킵 (AC4)                          |
| ja word 토큰 0개                     | 부착 스킵 → 균등분할 폴백 (AC4)          |

---

## 테스트 시나리오

### getEpisodeSegments (src/lib/services/episodes.ts)

- [정상] getEpisodeSegments — should attach wordStarts from subtitle.ja.vtt inline word times when meta.language is 'ja' (AC1)
- [정상] getEpisodeSegments — should resolve the VTT path from meta.language as subtitle.{language}.vtt
- [정상] getEpisodeSegments — should count ja words via tokenizeJa word tokens (not whitespace split) so wordStarts length matches ja word ordinals
- [정상] getEpisodeSegments — should attach audioStart = first ja VTT inline token time in the segment window (AC1, 덤)
- [정상] getEpisodeSegments — should map wordStarts to the exact VTT inline times [7.01, 8.87, 12.14, 14.1] (AC1/AC2 실측치)
- [경계] getEpisodeSegments — should produce monotonically non-decreasing wordStarts within [start, end) for a merged ja segment (AC1)
- [경계] getEpisodeSegments — should keep en behavior unchanged (reads subtitle.en.vtt) when meta.language is absent (AC3 회귀)
- [경계] getEpisodeSegments — should read subtitle.en.vtt when meta.language is explicitly 'en' (AC3 회귀)
- [경계] getEpisodeSegments — should skip attach for a ja segment whose window has no VTT tokens (AC4)
- [경계] getEpisodeSegments — should skip attach when ja segment text yields zero word tokens (AC4)
- [예외] getEpisodeSegments — should fall back (no wordStarts) when subtitle.{language}.vtt is missing (AC4)
- [예외] getEpisodeSegments — should fall back (no wordStarts, no crash) when subtitle.ja.vtt is malformed (AC4)

### SegmentText (src/components/player/SegmentText.tsx)

- [정상] SegmentText — should highlight ja word by wordStarts (actual utterance time) when segment.wordStarts matches word-token count (AC2)
- [정상] SegmentText — should highlight the later ja word (プラットフォーム-like 1s+ drift case) by wordStarts instead of uniform split (AC2)
- [경계] SegmentText — should fall back to uniform-split ja highlight when segment.wordStarts is absent (B9 폴백 유지, AC4)
- [경계] SegmentText — should fall back to uniform-split ja highlight when wordStarts length !== ja word-token count (AC4)
- [정상] SegmentText — should keep en highlight behavior unchanged for wordStarts vs uniform split (AC3 회귀; 기존 SegmentText.test.tsx가 커버)

### SegmentText 종단간 통합 (src/components/player/SegmentText.ja-integration.test.tsx)

- [정상] e2e — should highlight プラットフォーム at drift time(13.5s) using VTT-derived wordStarts (AC2 실측 드리프트 해소)
- [경계] e2e — should highlight a different (later) word at the same time when falling back to uniform split (AC2 대조)

---

## AC ↔ 시나리오 대조

| AC                                                                     | 커버 시나리오                                                                     |
| :--------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| AC1: ja 세그먼트에 VTT 파생 wordStarts 부착 + [start,end) 내 단조 증가 | getEpisodeSegments attach/audioStart/monotonic                                    |
| AC2: 재생 중 실제 발화 시각 기준 강조(プラットフォーム 1s+ 오차 해소)  | SegmentText wordStarts 강조 + drift 케이스                                        |
| AC3: 기존 en 에피소드 무회귀                                           | getEpisodeSegments en unchanged(x2), SegmentText en unchanged                     |
| AC4: vtt 부재/토큰 없음 → 크래시 없이 균등분할 폴백                    | getEpisodeSegments missing/malformed/no-token/zero-word, SegmentText fallback(x2) |

모든 AC가 1개 이상 시나리오로 커버됨.
