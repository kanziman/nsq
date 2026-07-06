// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SegmentText } from './SegmentText';
import type { Segment } from '@/lib/types';

afterEach(() => cleanup());

const base: Segment = {
  id: 's1',
  start: 0,
  end: 9,
  speaker: 'DUCKWORTH',
  text: 'a b c',
};

describe('SegmentText', () => {
  it('[정상] should highlight by wordStarts timing when present (AC1)', () => {
    // wordStarts=[0,5,8] → t=6 이면 인덱스 1('b') 강조 (균등분할이면 t=6→인덱스 2가 됨)
    const seg: Segment = { ...base, wordStarts: [0, 5, 8] };
    const { container } = render(
      <SegmentText segment={seg} highlightWords currentTime={6} />,
    );
    const current = container.querySelectorAll('[data-current-word="true"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe('b');
  });

  it('[경계] should fall back to even distribution when wordStarts is absent (AC2)', () => {
    // wordStarts 없음, [0,9) 3단어 균등 → t=6 이면 인덱스 2('c')
    const { container } = render(
      <SegmentText segment={base} highlightWords currentTime={6} />,
    );
    const current = container.querySelectorAll('[data-current-word="true"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe('c');
  });

  it('[정상] should always render the official text, never VTT words (AC3)', () => {
    const seg: Segment = {
      ...base,
      text: 'I run an educational non-profit called Character Lab.',
      wordStarts: [0, 1, 2, 3, 4, 5, 6, 7],
    };
    const { container } = render(
      <SegmentText segment={seg} highlightWords currentTime={3} />,
    );
    expect(container.querySelector('p')?.textContent).toBe(seg.text);
  });

  it('[경계] should fall back to even distribution when wordStarts length mismatches word count (stale data)', () => {
    // 단어 3개인데 wordStarts 길이 2 → 부정합이므로 균등분할 폴백. [0,9) t=6 → 'c'
    const seg: Segment = { ...base, wordStarts: [0, 1] };
    const { container } = render(
      <SegmentText segment={seg} highlightWords currentTime={6} />,
    );
    const current = container.querySelectorAll('[data-current-word="true"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe('c');
  });

  it('[경계] should highlight nothing when currentTime precedes the first wordStart', () => {
    // wordStarts=[2,5,8], t=1 (<2) → currentWordIndexFromStarts=-1 → 강조 없음
    const seg: Segment = { ...base, wordStarts: [2, 5, 8] };
    const { container } = render(
      <SegmentText segment={seg} highlightWords currentTime={1} />,
    );
    expect(container.querySelectorAll('[data-current-word]')).toHaveLength(0);
    expect(container.querySelector('p')?.textContent).toBe('a b c');
  });

  it('[경계] should render plain text when currentTime is not provided', () => {
    const seg: Segment = { ...base, wordStarts: [0, 5, 8] };
    const { container } = render(<SegmentText segment={seg} highlightWords />);
    expect(container.querySelectorAll('[data-current-word]')).toHaveLength(0);
    expect(container.querySelector('p')?.textContent).toBe('a b c');
  });
});
