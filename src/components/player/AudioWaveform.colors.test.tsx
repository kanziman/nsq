// @vitest-environment jsdom
/**
 * #151 AC3/AC4: draw()가 매 렌더 시 팔레트를 해석해 canvas에 코랄 계열 색을 쓰는지
 * 통합 검증. jsdom은 getContext가 null이라, 색 세터를 기록하는 스텁 ctx를 주입해
 * draw 경로를 실제로 실행시킨다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import AudioWaveform from './AudioWaveform';

function makeRecordingCtx() {
  const fills: string[] = [];
  const strokes: string[] = [];
  const grad = { addColorStop: (_o: number, c: string) => fills.push(c) };
  const ctx = {
    scale: () => {},
    clearRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    closePath: () => {},
    fill: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    rect: () => {},
    clip: () => {},
    arc: () => {},
    fillRect: () => {},
    createLinearGradient: () => grad,
    lineWidth: 0,
    set fillStyle(v: string) {
      if (typeof v === 'string') fills.push(v);
    },
    get fillStyle() {
      return '';
    },
    set strokeStyle(v: string) {
      strokes.push(v);
    },
    get strokeStyle() {
      return '';
    },
  };
  return { ctx, fills, strokes };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const PROPS = {
  waveform: [0.2, 0.6, 0.9, 0.4, 0.3],
  currentTime: 2,
  segmentStart: 0,
  segmentEnd: 4,
  onSeek: () => {},
};

describe('AudioWaveform draw palette (#151 AC3/AC4)', () => {
  it('should paint coral accent (not sky-blue) resolved from tokens when drawing', () => {
    const { ctx, fills, strokes } = makeRecordingCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );

    render(<AudioWaveform {...PROPS} />);

    const colors = [...fills, ...strokes].join(' | ');
    // draw가 실제로 실행되어 색을 기록했다(회귀: 경로 실행됨).
    expect(colors.length).toBeGreaterThan(0);
    // 코랄(#cc785c=204,120,92) 폴백이 쓰이고 과거 하늘색이 아니다.
    expect(colors).toContain('204, 120, 92');
    expect(colors).not.toContain('99, 179, 237');
    expect(colors).not.toContain('#63b3ed');
  });

  it('should reflect a CSS variable change in the drawn accent color (draw-time resolution)', () => {
    const { ctx, fills, strokes } = makeRecordingCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    // --color-primary를 초록으로 오버라이드 → draw가 정적 리터럴이 아니라 이 값을 써야 함.
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (name: string) =>
        name === '--color-primary' ? '#00ff00' : '',
    } as unknown as CSSStyleDeclaration);

    render(<AudioWaveform {...PROPS} />);

    const colors = [...fills, ...strokes].join(' | ');
    expect(colors).toContain('0, 255, 0'); // 오버라이드한 accent가 반영됨
    expect(colors).not.toContain('204, 120, 92');
  });
});
