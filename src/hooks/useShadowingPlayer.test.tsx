// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Segment } from '@/lib/types';

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
      getDuration: vi.fn(() => 300),
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

  it('[정상] currentTime should update from timeupdate', () => {
    const { result } = setup();
    act(() => lastManager._time!(8));
    expect(result.current.currentTime).toBe(8);
  });

  it('[정상] seekTo should call manager.seekTo and update currentTime/index', () => {
    const { result } = setup();
    act(() => result.current.seekTo(11));
    expect(lastManager.seekTo).toHaveBeenCalledWith(11);
    expect(result.current.currentTime).toBe(11);
    expect(result.current.currentSegmentIndex).toBe(2);
  });

  it('[정상] next() should seek to next segment start', () => {
    const { result } = setup();
    act(() => lastManager._time!(6)); // idx 1
    act(() => result.current.next());
    expect(lastManager.seekTo).toHaveBeenLastCalledWith(10);
    expect(result.current.currentSegmentIndex).toBe(2);
  });

  it('[정상] prev() should seek to previous segment start', () => {
    const { result } = setup();
    act(() => lastManager._time!(6)); // idx 1
    act(() => result.current.prev());
    expect(lastManager.seekTo).toHaveBeenLastCalledWith(0);
    expect(result.current.currentSegmentIndex).toBe(0);
  });

  it('[경계] next() at last segment should clamp', () => {
    const { result } = setup();
    act(() => lastManager._time!(12)); // idx 2 (last)
    act(() => result.current.next());
    expect(result.current.currentSegmentIndex).toBe(2);
  });

  it('[경계] prev() at first segment should clamp', () => {
    const { result } = setup();
    act(() => lastManager._time!(2)); // idx 0
    act(() => result.current.prev());
    expect(result.current.currentSegmentIndex).toBe(0);
  });

  it('[정상] goToSegment(i) should seek to segment start and play', () => {
    const { result } = setup();
    act(() => result.current.goToSegment(2));
    expect(lastManager.seekTo).toHaveBeenCalledWith(10);
    expect(lastManager.play).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.currentSegmentIndex).toBe(2);
  });

  it('[경계] next() should preserve playing state (no pause)', () => {
    const { result } = setup();
    act(() => result.current.play());
    act(() => lastManager._time!(2));
    act(() => result.current.next());
    expect(result.current.isPlaying).toBe(true);
    expect(lastManager.pause).not.toHaveBeenCalled();
  });

  it('[경계] goToSegment out-of-range should be a no-op', () => {
    const { result } = setup();
    act(() => result.current.goToSegment(99));
    act(() => result.current.goToSegment(-1));
    expect(lastManager.seekTo).not.toHaveBeenCalled();
    expect(lastManager.play).not.toHaveBeenCalled();
  });

  it('[정상] selectSegment should set single selection {i,i}', () => {
    const { result } = setup();
    act(() => result.current.selectSegment(1));
    expect(result.current.selection).toEqual({ start: 1, end: 1 });
  });

  it('[정상] extendSelectionTo should set sorted range from anchor', () => {
    const { result } = setup();
    act(() => result.current.selectSegment(2));
    act(() => result.current.extendSelectionTo(0));
    expect(result.current.selection).toEqual({ start: 0, end: 2 });
  });

  it('[정상] toggleLoop should enable looping, reset count, seek to range start', () => {
    const { result } = setup();
    act(() => result.current.selectSegment(1));
    act(() => result.current.extendSelectionTo(2)); // range {1,2}
    act(() => result.current.toggleLoop());
    expect(result.current.isLooping).toBe(true);
    expect(result.current.repeatCount).toBe(0);
    expect(lastManager.seekTo).toHaveBeenLastCalledWith(5); // segs[1].start
  });

  it('[경계] toggleLoop with no selection should be a no-op', () => {
    const { result } = setup();
    act(() => result.current.toggleLoop());
    expect(result.current.isLooping).toBe(false);
  });

  it('[정상] while looping, reaching range end should loop back and increment count', () => {
    const { result } = setup();
    act(() => result.current.selectSegment(0));
    act(() => result.current.extendSelectionTo(1)); // range {0,1}, end = segs[1].end = 10
    act(() => result.current.toggleLoop());
    lastManager.seekTo.mockClear();
    act(() => lastManager._time!(9.96)); // >= 10 - 0.05
    expect(lastManager.seekTo).toHaveBeenCalledWith(0); // back to segs[0].start
    expect(result.current.repeatCount).toBe(1);
  });

  it('[정상] repeatCount should accumulate across multiple loop-backs', () => {
    const { result } = setup();
    act(() => result.current.selectSegment(0));
    act(() => result.current.extendSelectionTo(1));
    act(() => result.current.toggleLoop());
    act(() => lastManager._time!(9.96));
    act(() => lastManager._time!(9.96));
    act(() => lastManager._time!(9.96));
    expect(result.current.repeatCount).toBe(3);
  });

  it('[경계] extendSelectionTo without prior anchor selects a single segment', () => {
    const { result } = setup();
    act(() => result.current.extendSelectionTo(2));
    expect(result.current.selection).toEqual({ start: 2, end: 2 });
  });

  it('[경계] toggleLoop off should not seek and should preserve isPlaying', () => {
    const { result } = setup();
    act(() => result.current.selectSegment(0));
    act(() => result.current.extendSelectionTo(1));
    act(() => result.current.toggleLoop()); // on → plays
    expect(result.current.isPlaying).toBe(true);
    lastManager.seekTo.mockClear();
    act(() => result.current.toggleLoop()); // off
    expect(lastManager.seekTo).not.toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(true);
  });

  it('[정상] toggleLoop off should stop looping (AC3)', () => {
    const { result } = setup();
    act(() => result.current.selectSegment(0));
    act(() => result.current.extendSelectionTo(1));
    act(() => result.current.toggleLoop()); // on
    act(() => result.current.toggleLoop()); // off
    expect(result.current.isLooping).toBe(false);
    lastManager.seekTo.mockClear();
    act(() => lastManager._time!(9.96));
    expect(lastManager.seekTo).not.toHaveBeenCalled();
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

  it('[정상] playbackRate should default to 1', () => {
    const { result } = setup();
    expect(result.current.playbackRate).toBe(1);
  });

  it('[정상] setPlaybackRate should update state and call manager (AC1)', () => {
    const { result } = setup();
    act(() => result.current.setPlaybackRate(1.5));
    expect(result.current.playbackRate).toBe(1.5);
    expect(lastManager.setPlaybackRate).toHaveBeenLastCalledWith(1.5);
  });

  it('[정상] setPlaybackRate then next() should keep the selected rate (AC2)', () => {
    const { result } = setup();
    act(() => result.current.setPlaybackRate(1.5));
    act(() => lastManager._time!(6));
    act(() => result.current.next());
    expect(result.current.playbackRate).toBe(1.5);
  });

  it('[경계] next() should not reset playbackRate on the manager (AC2)', () => {
    const { result } = setup();
    act(() => result.current.setPlaybackRate(1.5));
    lastManager.setPlaybackRate.mockClear();
    act(() => result.current.next());
    expect(lastManager.setPlaybackRate).not.toHaveBeenCalled();
  });

  it('[정상] while looping, loop-back should preserve playbackRate (AC2)', () => {
    const { result } = setup();
    act(() => result.current.setPlaybackRate(1.5));
    act(() => result.current.selectSegment(0));
    act(() => result.current.extendSelectionTo(1));
    act(() => result.current.toggleLoop());
    lastManager.setPlaybackRate.mockClear();
    act(() => lastManager._time!(9.96)); // 루프 백 트리거
    expect(result.current.playbackRate).toBe(1.5);
    expect(lastManager.setPlaybackRate).not.toHaveBeenCalled();
  });

  it('[정상] switching episode should re-apply the selected playbackRate (AC2)', () => {
    const { result, rerender } = renderHook(
      ({ episodeId }) => useShadowingPlayer({ episodeId, segments: SEGMENTS }),
      { initialProps: { episodeId: 'vid' } },
    );
    act(() => result.current.setPlaybackRate(0.75));
    lastManager.setPlaybackRate.mockClear();
    rerender({ episodeId: 'vid2' }); // 새 manager 생성
    expect(lastManager.setPlaybackRate).toHaveBeenCalledWith(0.75);
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
