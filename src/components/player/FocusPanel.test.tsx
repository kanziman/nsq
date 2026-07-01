// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import FocusPanel from './FocusPanel';
import { SPEAKER_COLORS } from '@/lib/constants/speakers';
import type { Segment } from '@/lib/types';

afterEach(cleanup);

const SEG: Segment = {
  id: 'f1',
  start: 65,
  end: 70,
  speaker: 'DUCKWORTH',
  text: 'Focus on this line.',
};

describe('FocusPanel', () => {
  it('[정상] should render the segment text and speaker name (AC1)', () => {
    render(<FocusPanel segment={SEG} onReplay={vi.fn()} />);
    expect(screen.getByText('Focus on this line.')).toBeInTheDocument();
    expect(screen.getByText(SPEAKER_COLORS.DUCKWORTH.name)).toBeInTheDocument();
    expect(screen.getByText('01:05')).toBeInTheDocument();
  });

  it('[정상] replay button should call onReplay', () => {
    const onReplay = vi.fn();
    render(<FocusPanel segment={SEG} onReplay={onReplay} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 듣기' }));
    expect(onReplay).toHaveBeenCalledTimes(1);
  });

  it('[경계] null segment should render a placeholder without crashing', () => {
    expect(() =>
      render(<FocusPanel segment={null} onReplay={vi.fn()} />),
    ).not.toThrow();
    expect(screen.queryByText('Focus on this line.')).toBeNull();
  });
});
