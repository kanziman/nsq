import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Episode, ImportState } from '@/lib/types';

// --- 협력자(서비스) 테스트 더블 ---
vi.mock('@/lib/services/episodes', () => ({
  getEpisodeById: vi.fn(),
  deleteEpisode: vi.fn(),
}));

import { DELETE } from './route';
import { getEpisodeById, deleteEpisode } from '@/lib/services/episodes';

const mockGetById = vi.mocked(getEpisodeById);
const mockDelete = vi.mocked(deleteEpisode);

const TEST_ID = 'vid123';

function makeRequest(): Request {
  return new Request(`http://localhost/api/episodes/${TEST_ID}`, {
    method: 'DELETE',
  });
}

function makeContext(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

function makeEpisodeWithStatus(status: ImportState['status']): Episode {
  return {
    id: TEST_ID,
    title: 'Test Episode',
    duration: 300,
    youtubeUrl: 'https://youtube.com/watch?v=vid123',
    addedAt: new Date().toISOString(),
    importState: {
      videoId: TEST_ID,
      status,
      progress: 50,
      currentStep: 'download',
      updatedAt: new Date().toISOString(),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DELETE /api/episodes/[id]', () => {
  // ------------------------------ 정상 ------------------------------
  it('should return 200 OK and call deleteEpisode when episode status is completed', async () => {
    mockGetById.mockResolvedValue(makeEpisodeWithStatus('completed'));
    mockDelete.mockResolvedValue(undefined);

    const res = await DELETE(makeRequest(), makeContext(TEST_ID));
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith(TEST_ID);
  });

  it('should return 200 OK and call deleteEpisode when episode status is failed', async () => {
    mockGetById.mockResolvedValue(makeEpisodeWithStatus('failed'));
    mockDelete.mockResolvedValue(undefined);

    const res = await DELETE(makeRequest(), makeContext(TEST_ID));
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith(TEST_ID);
  });

  // ------------------------------ 예외 ------------------------------
  it('should return 409 Conflict and NOT call deleteEpisode when episode is in progress (downloading)', async () => {
    mockGetById.mockResolvedValue(makeEpisodeWithStatus('downloading'));

    const res = await DELETE(makeRequest(), makeContext(TEST_ID));
    expect(res.status).toBe(409);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('should return 404 Not Found when episode does not exist', async () => {
    mockGetById.mockResolvedValue(null);

    const res = await DELETE(makeRequest(), makeContext(TEST_ID));
    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('should return 500 Internal Server Error when getEpisodeById throws exception', async () => {
    mockGetById.mockRejectedValue(new Error('database error'));

    const res = await DELETE(makeRequest(), makeContext(TEST_ID));
    expect(res.status).toBe(500);
    expect(mockDelete).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual({
      error: 'database error',
    });
  });
});
