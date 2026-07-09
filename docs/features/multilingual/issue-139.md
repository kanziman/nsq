# Issue #139 — ja 하이라이트 정합: 위치-비례 → 대본↔VTT 앵커 정렬+보간

> #137로 ja wordStarts를 부착했으나, 자동자막(ASR) 오인식 + 초장문 세그먼트에서 위치-비례 매핑이
> 최대 ~3s 드리프트. 실측: sent-14(AT9LpLribrM, 25.86s), マザー 실제 ~107.5s vs 매핑 110.7s.

## 시그니처 명세

### 1. 신규 `computeWordStartsAligned` (src/lib/utils/words.ts)

```ts
export function computeWordStartsAligned(
  officialWords: string[], // 대본 단어 표면형(en: splitWords, ja: tokenizeJa word tokens)
  start: number,
  end: number,
  vttTokens: { word: string; start: number }[], // 구간 내 VTT 토큰(표면형+시각), 시각 오름차순
): number[]; // officialWords.length 길이, [start, end) 단조 비감소
```

알고리즘:

1. `officialWords`가 비면 `[]`.
2. LCS(경량 DP)로 `officialWords`와 `vttTokens[].word`의 **표면형 최장 공통 부분수열**을 앵커 `(wordIdx, tokenTime)` 오름차순으로 추출.
3. 앵커 0개 → `computeWordStarts(len, start, end, vttTokens.map(t => t.start))` 폴백(기존 위치-비례/균등분할).
4. 앵커 단어는 `tokenTime` 고정. 앵커 사이/전/후 비앵커 단어는 인접 앵커(및 경계 `start`/`end`) 사이 인덱스 비례 **선형 보간**.
5. `word[0]`은 `start`에 앵커(첫 강조 사각 제거 — 기존 계약 유지). 결과는 `[start, end)` 내 단조 비감소.

> **AC1 주의(설계 특례)**: "앵커 단어 = 매칭 VTT 실측 시각"은 `word[0]`을 **제외**한다. `word[0]`은 그 자체가 앵커여도 `seg.start`로 덮어써 첫 강조 사각을 없앤다. 실 파이프라인은 `seg.start === 첫 VTT 토큰 시각`(문장 복원이 첫 큐 시작을 세그먼트 시작으로 사용)이라 이 특례는 무손실이다.

### 2. `getEpisodeSegments` 통합 (src/lib/services/episodes.ts) — 시그니처 불변

- 구간 토큰을 `.map(t => t.start)` 대신 **표면형까지** 전달(`winTokens: VttToken[]`).
- `officialWords`: ja → `tokenizeJa(text).filter(t => t.isWord).map(t => t.text)`, en → `splitWords(text)`.
- `computeWordStarts(...)` → `computeWordStartsAligned(officialWords, seg.start, seg.end, winTokens)`.
- `audioStart = winTokens[0].start` 불변. `officialWords.length === 0`이면 스킵.

### 3. `SegmentText` — 무변경 (이미 wordStarts 소비)

### 에러/폴백 케이스

| 상황                    | 동작                                              |
| :---------------------- | :------------------------------------------------ |
| 앵커 0개(전량 불일치)   | 기존 `computeWordStarts`(위치-비례/균등분할) 폴백 |
| `vttTokens` 빈 배열     | 균등분할 폴백                                     |
| `officialWords` 빈 배열 | `[]` (호출측 wordCount===0 스킵과 정합)           |
| 중복/공통 토큰(の·は)   | LCS in-order 일관 매칭, 단조성 유지               |

---

## 테스트 시나리오

### computeWordStartsAligned (src/lib/utils/words.ts)

- [정상] computeWordStartsAligned — should set each anchored word's start exactly to its matched VTT token time when all surface forms match (AC1)
- [정상] computeWordStartsAligned — should reproduce the #137 fixture times [7.01, 8.87, 12.14, 14.1] for シェア/する/プラットフォーム/風 (AC5 회귀)
- [정상] computeWordStartsAligned — should linearly interpolate non-anchor words between two adjacent anchors by index (AC2)
- [경계] computeWordStartsAligned — should interpolate pre-first-anchor words from segment start to the first anchor with word[0] === start (AC2)
- [경계] computeWordStartsAligned — should interpolate post-last-anchor words from the last anchor toward segment end (AC2)
- [경계] computeWordStartsAligned — should keep wordStarts monotonically non-decreasing within [start, end) (AC2/AC5)
- [정상] computeWordStartsAligned — should place a katakana word (between anchors) closer to its true time than positional computeWordStarts (AC3)
- [예외] computeWordStartsAligned — should anchor consistently in-order despite repeated common tokens (の/は) and stay monotonic (AC4)
- [경계] computeWordStartsAligned — should fall back to positional computeWordStarts when there are no surface-form anchors (AC4)
- [경계] computeWordStartsAligned — should fall back to uniform split when vttTokens is empty (AC4)
- [경계] computeWordStartsAligned — should return [] when officialWords is empty (AC4)
- [경계] computeWordStartsAligned — should anchor word[0] to segment start even when word[0] itself is an exact anchor (AC1 특례 못박기)
- [경계] computeWordStartsAligned — should stay monotonic and bounded under partial anchoring (en punctuation mismatch) (AC5)

### getEpisodeSegments 통합 (src/lib/services/episodes.ts)

- [정상] getEpisodeSegments — should attach anchored wordStarts giving ja words exact VTT utterance times via surface-form match (AC1/AC3)
- [정상] getEpisodeSegments — should reduce katakana drift vs positional for a sent-14-style segment (AC3 실 버그 클래스)
- [경계] getEpisodeSegments — should keep en episodes unchanged when transcript exactly matches subtitle.en.vtt (exact anchors → same wordStarts) (AC5 회귀)
- [경계] getEpisodeSegments — should degrade to positional fallback when window tokens do not surface-match the transcript (AC4)

---

## AC ↔ 시나리오 대조

| AC                                                      | 커버 시나리오                                                          |
| :------------------------------------------------------ | :--------------------------------------------------------------------- |
| AC1: 앵커 단어 wordStart = 매칭 VTT 실측 시각           | anchored exact time (aligned + getEpisodeSegments 통합)                |
| AC2: 앵커 사이 비앵커 단어 인덱스 비례 선형 보간 + 단조 | interpolate between/pre/post + monotonic                               |
| AC3: 가타카나 단어 오차가 위치-비례 대비 감소           | katakana closer-than-positional                                        |
| AC4: 앵커 없음/토큰 없음 → 크래시 없이 폴백             | no-anchor fallback, empty tokens, empty words, 중복 토큰, 통합 degrade |
| AC5: 기존 en·#137 ja 무회귀, [start,end) 단조 비감소    | #137 fixture 재현, en unchanged, monotonic                             |

모든 AC가 1개 이상 시나리오로 커버됨.
