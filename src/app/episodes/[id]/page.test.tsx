// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { Episode, ImportState, Segment } from '@/lib/types';

vi.mock('@/lib/services/episodes', () => ({
  getEpisodeById: vi.fn(),
  getEpisodeSegments: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error('REDIRECT:' + path);
  }),
}));
// 라우팅/리다이렉트 검증에 집중 — 오디오 매니저는 가볍게 모킹
vi.mock('@/lib/utils/audio', () => ({
  BOUNDARY_PARK_BACKOFF_SEC: 0.05,
  DEFAULT_PLAYBACK_RATE: 1,
  PLAYBACK_RATE_PRESETS: [0.5, 0.75, 1, 1.25, 1.5, 2],
  createAudioManager: vi.fn(() => ({
    play: vi.fn(),
    pause: vi.fn(),
    getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 0),
    seekTo: vi.fn(),
    playSegment: vi.fn(),
    setPlaybackRate: vi.fn(),
    onTimeUpdate: vi.fn(() => () => {}),
    onEnded: vi.fn(() => () => {}),
    destroy: vi.fn(),
  })),
}));

import EpisodePlayerPage from './page';
import { getEpisodeById, getEpisodeSegments } from '@/lib/services/episodes';

const mockGetById = vi.mocked(getEpisodeById);
const mockGetSegments = vi.mocked(getEpisodeSegments);

const TEST_ID = 'vid123';
function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}
function episodeWithStatus(status: ImportState['status']): Episode {
  return {
    id: TEST_ID,
    title: 'Test Episode',
    duration: 300,
    youtubeUrl: 'https://youtube.com/watch?v=vid123',
    addedAt: new Date().toISOString(),
    importState: {
      videoId: TEST_ID,
      status,
      progress: status === 'completed' ? 100 : 50,
      currentStep: status,
      updatedAt: new Date().toISOString(),
    },
  };
}
const SAMPLE: Segment[] = [
  {
    id: 's1',
    start: 0,
    end: 2,
    speaker: 'DUCKWORTH',
    text: 'Sample line one.',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('EpisodePlayerPage (RSC)', () => {
  it('[정상] should render ScriptView with segments when completed and has segments', async () => {
    mockGetById.mockResolvedValue(episodeWithStatus('completed'));
    mockGetSegments.mockResolvedValue(SAMPLE);
    render(await EpisodePlayerPage(makeParams(TEST_ID)));
    expect(screen.getByText('Sample line one.')).toBeInTheDocument();
  });

  it('[예외] should redirect to / when episode does not exist', async () => {
    mockGetById.mockResolvedValue(null);
    mockGetSegments.mockResolvedValue([]);
    await expect(EpisodePlayerPage(makeParams(TEST_ID))).rejects.toThrow(
      'REDIRECT:/',
    );
  });

  it('[예외] should redirect to / when status is not completed', async () => {
    mockGetById.mockResolvedValue(episodeWithStatus('downloading'));
    mockGetSegments.mockResolvedValue(SAMPLE);
    await expect(EpisodePlayerPage(makeParams(TEST_ID))).rejects.toThrow(
      'REDIRECT:/',
    );
  });

  it('[경계] should redirect to / when segments.length === 0', async () => {
    mockGetById.mockResolvedValue(episodeWithStatus('completed'));
    mockGetSegments.mockResolvedValue([]);
    await expect(EpisodePlayerPage(makeParams(TEST_ID))).rejects.toThrow(
      'REDIRECT:/',
    );
  });

  it('[예외] should redirect to / when status is failed', async () => {
    mockGetById.mockResolvedValue(episodeWithStatus('failed'));
    mockGetSegments.mockResolvedValue(SAMPLE);
    await expect(EpisodePlayerPage(makeParams(TEST_ID))).rejects.toThrow(
      'REDIRECT:/',
    );
  });

  it('[경계] should redirect to / when importState is undefined', async () => {
    mockGetById.mockResolvedValue({
      id: TEST_ID,
      title: 'No State',
      duration: 0,
      youtubeUrl: 'https://youtube.com/watch?v=vid123',
      addedAt: new Date().toISOString(),
    });
    mockGetSegments.mockResolvedValue(SAMPLE);
    await expect(EpisodePlayerPage(makeParams(TEST_ID))).rejects.toThrow(
      'REDIRECT:/',
    );
  });
});
