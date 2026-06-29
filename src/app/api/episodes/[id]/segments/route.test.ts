import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Episode, ImportState, Segment } from '@/lib/types';

vi.mock('@/lib/services/episodes', () => ({
  getEpisodeById: vi.fn(),
  getEpisodeSegments: vi.fn(),
}));

import { GET } from './route';
import { getEpisodeById, getEpisodeSegments } from '@/lib/services/episodes';

const mockGetById = vi.mocked(getEpisodeById);
const mockGetSegments = vi.mocked(getEpisodeSegments);

const TEST_ID = 'vid123';

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}
function makeRequest() {
  return new Request(`http://localhost/api/episodes/${TEST_ID}/segments`);
}
function episodeWithStatus(status: ImportState['status']): Episode {
  return {
    id: TEST_ID,
    title: 'Test',
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
  { id: 's1', start: 0, end: 2, speaker: 'DUCKWORTH', text: 'hello' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/episodes/[id]/segments', () => {
  it('[정상] should return 200 with Segment[] when episode is completed', async () => {
    mockGetById.mockResolvedValue(episodeWithStatus('completed'));
    mockGetSegments.mockResolvedValue(SAMPLE);
    const res = await GET(makeRequest(), makeContext(TEST_ID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(SAMPLE);
  });

  it('[경계] should return 200 with [] when completed episode has no segments', async () => {
    mockGetById.mockResolvedValue(episodeWithStatus('completed'));
    mockGetSegments.mockResolvedValue([]);
    const res = await GET(makeRequest(), makeContext(TEST_ID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([]);
  });

  it('[예외] should return 404 when episode does not exist', async () => {
    mockGetById.mockResolvedValue(null);
    const res = await GET(makeRequest(), makeContext(TEST_ID));
    expect(res.status).toBe(404);
  });

  it('[예외] should return 409 when import is in progress', async () => {
    mockGetById.mockResolvedValue(episodeWithStatus('downloading'));
    const res = await GET(makeRequest(), makeContext(TEST_ID));
    expect(res.status).toBe(409);
  });

  it.each([
    'processing_subtitles',
    'processing_transcript',
    'aligning',
    'translating',
  ] as const)(
    '[예외] should return 409 for in-progress status "%s"',
    async (status) => {
      mockGetById.mockResolvedValue(episodeWithStatus(status));
      const res = await GET(makeRequest(), makeContext(TEST_ID));
      expect(res.status).toBe(409);
    },
  );

  it('[경계] should return 200 for failed status (not in-progress)', async () => {
    mockGetById.mockResolvedValue(episodeWithStatus('failed'));
    mockGetSegments.mockResolvedValue(SAMPLE);
    const res = await GET(makeRequest(), makeContext(TEST_ID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(SAMPLE);
  });
});
