import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Episode } from '@/lib/types';

// --- 협력자(서비스) 테스트 더블 ---
vi.mock('@/lib/services/episodes', () => ({
  getEpisodes: vi.fn(),
}));

import { GET } from './route';
import { getEpisodes } from '@/lib/services/episodes';

const mockGetEpisodes = vi.mocked(getEpisodes);

function makeRequest(): Request {
  return new Request('http://localhost/api/episodes', {
    method: 'GET',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/episodes', () => {
  // ------------------------------ 정상 ------------------------------
  it('should return 200 OK with empty array when no episodes exist in local storage', async () => {
    mockGetEpisodes.mockResolvedValue([]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([]);
  });

  it('should return 200 OK with episodes containing import state when episodes exist', async () => {
    const mockEpisodes: Episode[] = [
      {
        id: 'vid123',
        title: 'Episode 1',
        duration: 300,
        youtubeUrl: 'https://youtube.com/watch?v=vid123',
        addedAt: '2026-06-29T10:00:00Z',
        importState: {
          videoId: 'vid123',
          status: 'completed',
          progress: 100,
          currentStep: 'completed',
          updatedAt: '2026-06-29T10:05:00Z',
        },
      },
      {
        id: 'vid456',
        title: 'Episode: vid456 (임포트 중)',
        duration: 0,
        youtubeUrl: 'https://youtube.com/watch?v=vid456',
        addedAt: '2026-06-29T10:10:00Z',
        importState: {
          videoId: 'vid456',
          status: 'downloading',
          progress: 20,
          currentStep: 'download',
          updatedAt: '2026-06-29T10:11:00Z',
        },
      },
    ];
    mockGetEpisodes.mockResolvedValue(mockEpisodes);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(mockEpisodes);
  });

  // ------------------------------ 예외 ------------------------------
  it('should return 500 Internal Server Error when getEpisodes throws an exception', async () => {
    mockGetEpisodes.mockRejectedValue(new Error('disk failure'));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: 'disk failure',
    });
  });
});
