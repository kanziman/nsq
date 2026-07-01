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
  getDuration: ReturnType<typeof vi.fn>;
  seekTo: ReturnType<typeof vi.fn>;
  playSegment: ReturnType<typeof vi.fn>;
  onTimeUpdate: ReturnType<typeof vi.fn>;
  onEnded: ReturnType<typeof vi.fn>;
  setPlaybackRate: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  _time?: (t: number) => void;
  _end?: () => void;
};
let lastManager: FakeManager;

vi.mock('@/lib/utils/audio', () => ({
  BOUNDARY_PARK_BACKOFF_SEC: 0.05,
  DEFAULT_PLAYBACK_RATE: 1,
  PLAYBACK_RATE_PRESETS: [0.5, 0.75, 1, 1.25, 1.5, 2],
  createAudioManager: vi.fn(() => {
    const m: FakeManager = {
      play: vi.fn(),
      pause: vi.fn(),
      getCurrentTime: vi.fn(() => 0),
      getDuration: vi.fn(() => 15),
      seekTo: vi.fn(),
      playSegment: vi.fn(),
      onTimeUpdate: vi.fn((cb: (t: number) => void) => {
        m._time = cb;
        return () => {};
      }),
      onEnded: vi.fn((cb: () => void) => {
        m._end = cb;
        return () => {};
      }),
      setPlaybackRate: vi.fn(),
      destroy: vi.fn(),
    };
    lastManager = m;
    return m;
  }),
}));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

import { ShadowingPlayer } from './shadowing-player';
import { SPEAKER_COLORS } from '@/lib/constants/speakers';

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

  it('[정상] should pass episode.duration as total time to the progress bar', () => {
    render(<ShadowingPlayer episode={EPISODE} segments={SEGMENTS} />);
    // episode.duration = 15 → formatTime → "00:15"
    expect(screen.getByText('00:15')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: '탐색' })).toBeInTheDocument();
  });

  it('[정상] seek via slider should call manager.seekTo and update highlight (AC2)', () => {
    render(<ShadowingPlayer episode={EPISODE} segments={SEGMENTS} />);
    const slider = screen.getByRole('slider', { name: '탐색' });
    act(() => {
      fireEvent.change(slider, { target: { value: '5' } });
    });
    expect(lastManager.seekTo).toHaveBeenCalledWith(5);
    const active = document.querySelector('[data-active="true"]');
    expect(active?.textContent).toContain('second line');
  });

  it('[정상] seek should trigger scrollIntoView on the active segment (AC2)', () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    render(<ShadowingPlayer episode={EPISODE} segments={SEGMENTS} />);
    spy.mockClear();
    act(() => {
      fireEvent.change(screen.getByRole('slider', { name: '탐색' }), {
        target: { value: '5' },
      });
    });
    expect(spy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('[정상] seek in paused state should not auto-start playback (AC2)', () => {
    render(<ShadowingPlayer episode={EPISODE} segments={SEGMENTS} />);
    act(() => {
      fireEvent.change(screen.getByRole('slider', { name: '탐색' }), {
        target: { value: '5' },
      });
    });
    expect(screen.getByRole('button', { name: '재생' })).toBeInTheDocument();
  });

  it('[정상] timeupdate should refresh current time display (AC3)', () => {
    render(<ShadowingPlayer episode={EPISODE} segments={SEGMENTS} />);
    act(() => lastManager._time!(6));
    expect(screen.getByText('00:06')).toBeInTheDocument();
  });

  it('[정상] clicking a segment should seek to its start and start playback', () => {
    render(<ShadowingPlayer episode={EPISODE} segments={SEGMENTS} />);
    act(() => {
      fireEvent.click(screen.getByText('second line'));
    });
    expect(lastManager.seekTo).toHaveBeenCalledWith(5); // s2.start
    expect(lastManager.play).toHaveBeenCalled();
  });

  it('[정상] ⏭ should advance highlight to the next segment', () => {
    render(<ShadowingPlayer episode={EPISODE} segments={SEGMENTS} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '다음 세그먼트' }));
    });
    const active = document.querySelector('[data-active="true"]');
    expect(active?.textContent).toContain('first line'); // -1 → 0
  });

  it('[정상] shift+click should extend selection across the range', () => {
    render(<ShadowingPlayer episode={EPISODE} segments={SEGMENTS} />);
    act(() => {
      fireEvent.click(screen.getByText('first line')); // 단일 선택 idx0
    });
    act(() => {
      fireEvent.click(screen.getByText('second line'), { shiftKey: true }); // 확장 idx1
    });
    expect(document.querySelectorAll('[data-selected="true"]')).toHaveLength(2);
  });

  it('[정상] enabling loop should start playback and keep selection highlighted', () => {
    render(<ShadowingPlayer episode={EPISODE} segments={SEGMENTS} />);
    act(() => {
      fireEvent.click(screen.getByText('first line')); // 선택 idx0
    });
    lastManager.play.mockClear();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '구간 반복' }));
    });
    expect(lastManager.play).toHaveBeenCalled();
    expect(
      document.querySelectorAll('[data-selected="true"]').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('[정상] selecting a speed preset should update the badge and call manager (AC1)', () => {
    render(<ShadowingPlayer episode={EPISODE} segments={SEGMENTS} />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '재생 속도 1.5x' }));
    });
    expect(lastManager.setPlaybackRate).toHaveBeenCalledWith(1.5);
    expect(screen.getByRole('status')).toHaveTextContent('1.5x');
  });

  it('[정상] toggling a speaker off should dim its segments in the script (AC2)', () => {
    render(<ShadowingPlayer episode={EPISODE} segments={SEGMENTS} />);
    act(() => {
      fireEvent.click(
        screen.getByRole('button', {
          name: `${SPEAKER_COLORS.DUBNER.name} 화자 필터`,
        }),
      );
    });
    const dimmed = document.querySelectorAll('[data-dimmed="true"]');
    expect(dimmed).toHaveLength(1);
    expect(dimmed[0].textContent).toContain('second line');
  });

  it('[정상] disabling all present speakers should show a notice and clear dim (AC3)', () => {
    render(<ShadowingPlayer episode={EPISODE} segments={SEGMENTS} />);
    act(() => {
      fireEvent.click(
        screen.getByRole('button', {
          name: `${SPEAKER_COLORS.DUCKWORTH.name} 화자 필터`,
        }),
      );
    });
    act(() => {
      fireEvent.click(
        screen.getByRole('button', {
          name: `${SPEAKER_COLORS.DUBNER.name} 화자 필터`,
        }),
      );
    });
    expect(screen.getByRole('alert').textContent).toContain(
      '선택한 화자의 대사가 없어',
    );
    expect(document.querySelectorAll('[data-dimmed="true"]')).toHaveLength(0);
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
