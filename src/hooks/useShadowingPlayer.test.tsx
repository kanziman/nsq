// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Segment } from '@/lib/types';

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

import { useShadowingPlayer } from './useShadowingPlayer';

const SEGMENTS: Segment[] = [
  { id: 's1', start: 0, end: 5, speaker: 'DUCKWORTH', text: 'a' },
  { id: 's2', start: 5, end: 10, speaker: 'DUBNER', text: 'b' },
  { id: 's3', start: 10, end: 15, speaker: 'BOTH', text: 'c' },
];

function setup() {
  return renderHook(() =>
    useShadowingPlayer({ episodeId: 'vid', segments: SEGMENTS }),
  );
}

beforeEach(() => vi.clearAllMocks());

describe('useShadowingPlayer', () => {
  it('[정상] play() should set isPlaying true and call manager.play', () => {
    const { result } = setup();
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);
    expect(lastManager.play).toHaveBeenCalled();
  });

  it('[정상] pause() should set isPlaying false and call manager.pause', () => {
    const { result } = setup();
    act(() => result.current.play());
    act(() => result.current.pause());
    expect(result.current.isPlaying).toBe(false);
    expect(lastManager.pause).toHaveBeenCalled();
  });

  it('[정상] toggle() should flip play/pause', () => {
    const { result } = setup();
    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(false);
  });

  it('[정상] currentSegmentIndex should track currentTime via timeupdate', () => {
    const { result } = setup();
    act(() => lastManager._time!(6));
    expect(result.current.currentSegmentIndex).toBe(1);
    act(() => lastManager._time!(12));
    expect(result.current.currentSegmentIndex).toBe(2);
  });

  it('[경계] currentSegmentIndex should be -1 before first segment start', () => {
    const { result } = setup();
    expect(result.current.currentSegmentIndex).toBe(-1);
  });

  it('[정상] should NOT call manager.pause when crossing boundaries (continuous)', () => {
    const { result } = setup();
    act(() => result.current.play());
    act(() => lastManager._time!(4.9));
    act(() => lastManager._time!(5.1));
    act(() => lastManager._time!(10.1));
    expect(lastManager.pause).not.toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(true);
  });

  it('[경계] should keep previous segment active during inter-segment gap', () => {
    // spec-fixed §5: gap 구간에서는 직전 세그먼트 강조를 유지(연속 재생)
    const gapSegs: Segment[] = [
      { id: 'g1', start: 0, end: 4, speaker: 'DUCKWORTH', text: 'a' },
      { id: 'g2', start: 6, end: 10, speaker: 'DUBNER', text: 'b' },
    ];
    const { result } = renderHook(() =>
      useShadowingPlayer({ episodeId: 'vid', segments: gapSegs }),
    );
    act(() => lastManager._time!(4.5)); // 4~6 gap 내부
    expect(result.current.currentSegmentIndex).toBe(0);
  });

  it('[정상] on ended should set isPlaying false and retain last segment index', () => {
    const { result } = setup();
    act(() => result.current.play());
    act(() => lastManager._time!(12));
    act(() => lastManager._end!());
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentSegmentIndex).toBe(2);
  });
});
