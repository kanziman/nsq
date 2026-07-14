/**
 * #151: AudioWaveform 색을 디자인 토큰(CSS 변수)에서 해석한다.
 * canvas 2D는 CSS 변수를 직접 못 읽으므로, hex 토큰을 읽어 rgb로 변환해 draw에 주입한다.
 */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export interface WaveformPalette {
  accent: [number, number, number]; // 코랄 — 재생/진행/플레이헤드
  base: [number, number, number]; // 뉴트럴 — 미재생 파형/중앙선
  dot: string; // 플레이헤드 도트 외곽(크림, ≠#fff)
}

// CSS 변수 부재 시 디자인 시스템 폴백(warm-canvas: 코랄/뉴트럴/크림).
const FALLBACK = {
  accent: '#cc785c', // --color-primary
  base: '#a09d96', // --color-on-dark-soft
  dot: '#faf9f5', // --color-on-dark
};

/**
 * 파형 팔레트를 디자인 토큰에서 해석. `read(name)`는 CSS 변수 값(hex)을 반환하며,
 * prod에선 getComputedStyle(el).getPropertyValue를 래핑한다. 값이 비면 폴백을 쓴다.
 */
export function resolveWaveformPalette(
  read: (name: string) => string,
): WaveformPalette {
  const accent = read('--color-primary').trim() || FALLBACK.accent;
  const base = read('--color-on-dark-soft').trim() || FALLBACK.base;
  const dot = read('--color-on-dark').trim() || FALLBACK.dot;
  return { accent: hexToRgb(accent), base: hexToRgb(base), dot };
}
