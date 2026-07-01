// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ScriptView from './ScriptView';
import { SPEAKER_COLORS } from '@/lib/constants/speakers';
import type { Segment } from '@/lib/types';

const SEGMENTS: Segment[] = [
  { id: 's1', start: 65, end: 70, speaker: 'DUCKWORTH', text: 'Hello there.' },
  { id: 's2', start: 70, end: 75, speaker: 'DUBNER', text: 'How are you?' },
];

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => cleanup());

describe('ScriptView', () => {
  it("[정상] should render each segment's text, speaker name, and timecode", () => {
    render(<ScriptView segments={SEGMENTS} />);
    expect(screen.getByText('Hello there.')).toBeInTheDocument();
    expect(screen.getByText('How are you?')).toBeInTheDocument();
    // 화자명 (Angela / Steven)
    expect(screen.getByText(SPEAKER_COLORS.DUCKWORTH.name)).toBeInTheDocument();
    expect(screen.getByText(SPEAKER_COLORS.DUBNER.name)).toBeInTheDocument();
    // 타임코드 formatTime(65) = "01:05"
    expect(screen.getByText('01:05')).toBeInTheDocument();
  });

  it('[정상] should apply speaker color class per segment', () => {
    const { container } = render(<ScriptView segments={SEGMENTS} />);
    const teal = SPEAKER_COLORS.DUCKWORTH.textClass; // text-accent-teal
    const coral = SPEAKER_COLORS.DUBNER.textClass; // text-primary
    expect(container.querySelector(`.${CSS.escape(teal)}`)).toBeTruthy();
    expect(container.querySelector(`.${CSS.escape(coral)}`)).toBeTruthy();
  });

  it('[경계] should render without error when optional props are omitted', () => {
    expect(() => render(<ScriptView segments={SEGMENTS} />)).not.toThrow();
  });

  it('[정상] onSegmentClick should receive (index, shiftKey)', () => {
    const onSegmentClick = vi.fn();
    render(<ScriptView segments={SEGMENTS} onSegmentClick={onSegmentClick} />);
    fireEvent.click(screen.getByText('Hello there.'));
    expect(onSegmentClick).toHaveBeenLastCalledWith(0, false);
    fireEvent.click(screen.getByText('How are you?'), { shiftKey: true });
    expect(onSegmentClick).toHaveBeenLastCalledWith(1, true);
  });

  it('[정상] selection range segments should be marked data-selected', () => {
    const { container } = render(
      <ScriptView segments={SEGMENTS} selection={{ start: 0, end: 1 }} />,
    );
    expect(container.querySelectorAll('[data-selected="true"]')).toHaveLength(
      2,
    );
  });

  it('[정상] should mark the segment at currentSegmentIndex as active', () => {
    render(<ScriptView segments={SEGMENTS} currentSegmentIndex={1} />);
    const active = document.querySelector('[data-active="true"]');
    expect(active?.textContent).toContain('How are you?');
  });

  it('[정상] should scrollIntoView the active segment when currentSegmentIndex changes', () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { rerender } = render(
      <ScriptView segments={SEGMENTS} currentSegmentIndex={0} />,
    );
    spy.mockClear();
    rerender(<ScriptView segments={SEGMENTS} currentSegmentIndex={1} />);
    expect(spy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('[경계] should not throw when there is no active segment (-1)', () => {
    expect(() =>
      render(<ScriptView segments={SEGMENTS} currentSegmentIndex={-1} />),
    ).not.toThrow();
  });

  it('[경계] should apply color class for BOTH and NARRATOR speakers', () => {
    const segs: Segment[] = [
      { id: 'b1', start: 0, end: 1, speaker: 'BOTH', text: 'Both speak.' },
      { id: 'n1', start: 1, end: 2, speaker: 'NARRATOR', text: 'Narration.' },
    ];
    const { container } = render(<ScriptView segments={segs} />);
    expect(
      container.querySelector(`.${CSS.escape(SPEAKER_COLORS.BOTH.textClass)}`),
    ).toBeTruthy();
    expect(
      container.querySelector(
        `.${CSS.escape(SPEAKER_COLORS.NARRATOR.textClass)}`,
      ),
    ).toBeTruthy();
  });
});
