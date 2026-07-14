# issue-151 — AudioWaveform 하드코딩 색상 → 디자인 토큰

> `AudioWaveform.tsx` canvas draw가 하늘색/슬레이트를 하드코딩(11곳). CLAUDE.md 색 정책 위반 + warm-canvas 테마 불일치. 색을 디자인 토큰(코랄/뉴트럴/크림)에서 해석하도록 전환.

## 근본 원인

canvas 2D 컨텍스트는 CSS 변수를 직접 못 읽어 색이 리터럴로 박혀 있음(`rgba(99,179,237,…)` 하늘색, `rgba(100,120,160,…)` 슬레이트, `#fff`, `#63b3ed`).

## 시그니처 (신규 순수 유틸)

```ts
// src/lib/utils/waveform-colors.ts
export function hexToRgb(hex: string): [number, number, number];

export interface WaveformPalette {
  accent: [number, number, number]; // 코랄 — 재생/진행/플레이헤드
  base: [number, number, number]; // 뉴트럴 — 미재생 파형/중앙선
  dot: string; // 플레이헤드 도트 외곽(크림, ≠#fff)
}

// read(name): CSS 변수 값(hex) 반환 함수(prod에선 getComputedStyle 래핑).
export function resolveWaveformPalette(
  read: (name: string) => string,
): WaveformPalette;
```

### 동작 계약

- `hexToRgb`: `#cc785c`→`[204,120,92]`. `#`유무·3자리 축약(`#abc`) 허용.
- `resolveWaveformPalette`: `--color-primary`(accent)·`--color-on-dark-soft`(base)·`--color-on-dark`(dot)을 읽어 반환. 값 부재('')면 디자인 시스템 폴백: accent `#cc785c`(코랄), base `#a09d96`(뉴트럴), dot `#faf9f5`(크림). **하늘색·순백 폴백 없음.**
- `AudioWaveform.draw`: 리터럴 대신 `resolveWaveformPalette`로 얻은 팔레트를 `rgba(${accent}, α)` 형태로 합성. draw 시점 해석이라 테마 변수 변경이 반영됨.

## 테스트 시나리오

### [정상]

- [정상] hexToRgb — should convert #cc785c to [204, 120, 92] — **AC2**
- [정상] resolveWaveformPalette — should read accent/base/dot from provided CSS var values — **AC3**
- [정상] resolveWaveformPalette — accent fallback should be design-system coral [204,120,92], not sky-blue, when vars are absent — **AC2**

### [경계]

- [경계] hexToRgb — should accept 3-digit shorthand and values with/without leading # — **AC2**
- [경계] resolveWaveformPalette — dot fallback should be cream (#faf9f5), not pure white — **AC2**

### [예외 / 가드]

- [가드] AudioWaveform source — draw 경로에 하드코딩 하늘색(99,179,237 / #63b3ed)·순백(#fff) 리터럴이 없다 — **AC1**
- [정상] AudioWaveform — should render without crashing (smoke) — **AC4**

## AC ↔ 시나리오 교차 대조

| AC                         | 커버 시나리오                  |
| -------------------------- | ------------------------------ |
| AC1 (하드코딩 리터럴 제거) | 가드#1                         |
| AC2 (코랄 accent·대비)     | 정상#1, 정상#3, 경계#1, 경계#2 |
| AC3 (테마 변수 반영)       | 정상#2                         |
| AC4 (렌더 무회귀)          | 정상#4(smoke)                  |
