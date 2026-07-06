# Issue #85 — VTT 자동자막 큐 선두 단어 캡처

> 배경: `parseYoutubeAutoCaptions`가 인라인 `<ts><c>word</c>`만 캡처해 각 큐의 선두 단어(타임스탬프 없는 첫 단어)를 누락(~299개, 5%). 단어 강조 말미 잔차 + 정합 앵커 희소의 원인.
> AC1 선두 단어를 큐 시작 시각으로 캡처 / AC2 롤링 중복 없음 / AC3 표준 VTT 경로 무영향

---

## 1. 시그니처 명세

### `src/lib/services/import/vtt/parse.ts` (내부 수정)

공개 API(`parseVtt(vtt: string): VttToken[]`)는 불변. 내부 `parseYoutubeAutoCaptions`만 확장한다.

```ts
// YouTube 자동자막 큐 구조:
//   00:00:43.239 --> 00:00:45.270           (타이밍 라인)
//   have a terrible temper and when it       (캐리 라인: 인라인 태그 없음 → 무시)
//   erupts<00:00:43.600><c> it's</c>...      (활성 라인: 선두 단어 "erupts" = 큐 시작 43.239)
//
// 처리: 큐 블록별로 (1) 인라인 태그가 있는 활성 라인의 선두 단어(첫 '<' 이전 텍스트, 단일 단어)를
// 큐 시작 시각으로 추가하고, (2) 기존 인라인 단어를 캡처한다. 모두 타임스탬프 기준 dedupe.
```

- 선두 단어가 공백을 포함하는 다중 단어면(파일 극초반 등 드묾) 캡처하지 않는다(회귀 없음, 기존과 동일).

---

## 2. 테스트 시나리오

### `parseVtt` (YouTube 자동자막 경로)

- [정상] should include each cue's leading word at the cue start time (AC1)
- [정상] should still capture inline-timestamped words (회귀 방지)
- [정상] should place the leading word before its cue's inline words in time order
- [경계] should not duplicate a word carried over in a later cue's plain carry line (AC2)
- [경계] should skip a multi-word leading segment (공백 포함 시 미캡처)
- [경계] standard (manual) VTT without inline timings should be unchanged (AC3)

### 효과(수동 검증, 유닛 아님)

- 재정합 시 토큰 수가 공식 단어 수에 근접(누락 대폭 감소), matchRate ≥ 0.85 유지.

---

## 3. AC ↔ 시나리오

| AC                            | 커버                                           |
| :---------------------------- | :--------------------------------------------- |
| **AC1** 선두 단어 큐시작 캡처 | leading word at cue start, time-order 시나리오 |
| **AC2** 롤링 중복 없음        | carry line dedupe 시나리오                     |
| **AC3** 표준 VTT 무영향       | standard manual VTT unchanged 시나리오         |
