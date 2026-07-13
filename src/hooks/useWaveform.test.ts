// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWaveform } from './useWaveform';

describe('useWaveform', () => {
  const dummySegment = {
    id: 's1',
    start: 1.0,
    end: 3.0,
    audioStart: 1.0,
    speaker: 'S1',
    text: '',
  };

  beforeEach(() => {
    // Web Audio API Mocking
    class MockAudioContext {
      state = 'running';
      close = vi.fn().mockResolvedValue(undefined);
      decodeAudioData = vi.fn().mockImplementation((buffer) => {
        return Promise.resolve({
          getChannelData: () => new Float32Array([0.1, 0.5, 0.9, -0.2, -0.8]),
          sampleRate: 44100,
          length: 5,
        });
      });
    }

    (window as any).AudioContext = MockAudioContext;
    (window as any).webkitAudioContext = MockAudioContext;

    global.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('[정상] should fetch, decode, and return waveform data for a segment', async () => {
    const { result } = renderHook(() =>
      useWaveform('/dummy.mp3', dummySegment),
    );

    await waitFor(() => {
      expect(result.current.waveform).not.toHaveLength(0);
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('[경계] should return empty array if segment is undefined', () => {
    const { result } = renderHook(() => useWaveform('/dummy.mp3', undefined));
    expect(result.current.waveform).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
