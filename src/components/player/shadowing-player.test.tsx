// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from '@testing-library/react';
import type { Episode, Segment } from '@/lib/types';

type FakeManager = {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  getCurrentTime: ReturnType<typeof vi.fn>;
  onTimeUpdate: ReturnType<typeof vi.fn>;
  onEnded: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  _time?: (t: number) => void;
  _end?: () => void;
};
let lastManager: FakeManager;

vi.mock('@/lib/utils/audio', () => ({
  createAudioManager: vi.fn(() => {
    const m: FakeManager = {
      play: vi.fn(),
      pause: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      onTimeUpdate: vi.fn((cb: (t: number) => void) => {
        m._time = cb;
        return () => {};
      }),
      onEnded: vi.fn((cb: () => void) => {
        m._end = cb;
        return () => {};
      }),
      destroy: vi.fn(),
    };
    lastManager = m;
    return m;
  }),
}));

import { ShadowingPlayer } from './shadowing-player';

const EPISODE: Episode = {
  id: 'vid',
  title: 'Test Ep',
  duration: 15,
  youtubeUrl: 'https://youtube.com/watch?v=vid',
  addedAt: new Date().toISOString(),
};
const SEGMENTS: Segment[] = [
  { id: 's1', start: 0, end: 5, speaker: 'DUCKWORTH', text: 'first line' },
  { id: 's2', start: 5, end: 10, speaker: 'DUBNER', text: 'second line' },
];

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('ShadowingPlayer', () => {
  it('[정상] should render segments through ScriptView', () => {
    render(<ShadowingPlayer episode={EPISODE} segments={SEGMENTS} />);
    expect(screen.getByText('first line')).toBeInTheDocument();
    expect(screen.getByText('second line')).toBeInTheDocument();
  });

  it('[정상] clicking play should start playback', () => {
    render(<ShadowingPlayer episode={EPISODE} segments={SEGMENTS} />);
    fireEvent.click(screen.getByRole('button', { name: '재생' }));
    expect(lastManager.play).toHaveBeenCalled();
  });

  it('[정상] timeupdate should mark the current segment active', () => {
    render(<ShadowingPlayer episode={EPISODE} segments={SEGMENTS} />);
    act(() => lastManager._time!(6));
    const active = document.querySelector('[data-active="true"]');
    expect(active?.textContent).toContain('second line');
  });

  it('[정상] should return control to 재생 after ended (AC3 UI)', () => {
    render(<ShadowingPlayer episode={EPISODE} segments={SEGMENTS} />);
    fireEvent.click(screen.getByRole('button', { name: '재생' }));
    expect(
      screen.getByRole('button', { name: '일시정지' }),
    ).toBeInTheDocument();
    act(() => lastManager._end!());
    expect(screen.getByRole('button', { name: '재생' })).toBeInTheDocument();
  });
});
