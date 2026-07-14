/**
 * #151: 파형 색을 디자인 토큰에서 해석 — 하드코딩 하늘색/순백 제거.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { hexToRgb, resolveWaveformPalette } from './waveform-colors';

describe('hexToRgb', () => {
  it('should convert #cc785c to [204, 120, 92]', () => {
    expect(hexToRgb('#cc785c')).toEqual([204, 120, 92]);
  });

  it('should accept 3-digit shorthand and values with or without leading #', () => {
    expect(hexToRgb('#abc')).toEqual([170, 187, 204]);
    expect(hexToRgb('cc785c')).toEqual([204, 120, 92]);
  });
});

describe('resolveWaveformPalette', () => {
  it('should read accent/base/dot from provided CSS var values', () => {
    const vars: Record<string, string> = {
      '--color-primary': '#cc785c',
      '--color-on-dark-soft': '#a09d96',
      '--color-on-dark': '#faf9f5',
    };
    const p = resolveWaveformPalette((name) => vars[name] ?? '');
    expect(p.accent).toEqual([204, 120, 92]);
    expect(p.base).toEqual([160, 157, 150]);
    expect(p.dot).toBe('#faf9f5');
  });

  it('should fall back to design-system coral (not sky-blue) when vars are absent', () => {
    const p = resolveWaveformPalette(() => '');
    expect(p.accent).toEqual([204, 120, 92]); // #cc785c 코랄
    // 과거 하늘색 [99,179,237]이 아니어야 한다.
    expect(p.accent).not.toEqual([99, 179, 237]);
  });

  it('should fall back to cream dot (#faf9f5), not pure white', () => {
    const p = resolveWaveformPalette(() => '');
    expect(p.dot).toBe('#faf9f5');
    expect(p.dot).not.toBe('#fff');
  });
});

describe('AudioWaveform source (하드코딩 가드)', () => {
  it('should not contain hardcoded sky-blue or pure-white color literals', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/components/player/AudioWaveform.tsx'),
      'utf-8',
    );
    expect(src).not.toMatch(/99,\s*179,\s*237/);
    expect(src).not.toMatch(/#63b3ed/i);
    expect(src).not.toMatch(/100,\s*120,\s*160/);
    expect(src).not.toMatch(/'#fff'/);
  });
});
