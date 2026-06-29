import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Episode, ImportState } from '@/lib/types';
import { Readable } from 'node:stream';

// --- 협력자 테스트 더블 ---
vi.mock('@/lib/services/episodes', () => ({
  getEpisodeById: vi.fn(),
}));

vi.mock('node:fs', () => ({
  createReadStream: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  stat: vi.fn(),
}));

import { GET } from './route';
import { getEpisodeById } from '@/lib/services/episodes';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';

const mockGetById = vi.mocked(getEpisodeById);
const mockCreateReadStream = vi.mocked(fs.createReadStream);
const mockExistsSync = vi.mocked(fs.existsSync);
const mockStat = vi.mocked(fsPromises.stat);

const TEST_ID = 'vid123';
const FILE_SIZE = 1000;

function makeRequest(range?: string): Request {
  const headers: Record<string, string> = {};
  if (range) {
    headers['range'] = range;
  }
  return new Request(`http://localhost/api/episodes/${TEST_ID}/audio`, {
    method: 'GET',
    headers,
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
      progress: 100,
      currentStep: 'completed',
      updatedAt: new Date().toISOString(),
    },
  };
}

// 가상의 Readable Stream 반환 도우미
function makeMockStream() {
  return Readable.from(['audio data chunk']) as unknown as fs.ReadStream;
}

beforeEach(() => {
  vi.clearAllMocks();
  // 기본적 설정: 에피소드 존재(완료 상태), 오디오 파일 디스크에 존재, 파일 크기 1000바이트
  mockGetById.mockResolvedValue(makeEpisodeWithStatus('completed'));
  mockExistsSync.mockReturnValue(true);
  mockStat.mockResolvedValue({ size: FILE_SIZE } as any);
  mockCreateReadStream.mockReturnValue(makeMockStream());
});

describe('GET /api/episodes/[id]/audio', () => {
  // ------------------------------ 정상 ------------------------------
  it('should return 200 OK with full audio stream and correct headers when Range is absent', async () => {
    const res = await GET(makeRequest(), makeContext(TEST_ID));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Length')).toBe(String(FILE_SIZE));
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    expect(mockCreateReadStream).toHaveBeenCalledWith(
      expect.stringContaining(`${TEST_ID}/audio.mp3`),
    );
  });

  it('should return 206 Partial Content with chunk stream and range headers when Range is present', async () => {
    const res = await GET(makeRequest('bytes=0-99'), makeContext(TEST_ID));
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Length')).toBe('100');
    expect(res.headers.get('Content-Range')).toBe(`bytes 0-99/${FILE_SIZE}`);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(mockCreateReadStream).toHaveBeenCalledWith(
      expect.stringContaining(`${TEST_ID}/audio.mp3`),
      expect.objectContaining({ start: 0, end: 99 }),
    );
  });

  // ------------------------------ 예외 ------------------------------
  it('should return 409 Conflict when episode is in progress (downloading)', async () => {
    mockGetById.mockResolvedValue(makeEpisodeWithStatus('downloading'));

    const res = await GET(makeRequest(), makeContext(TEST_ID));
    expect(res.status).toBe(409);
    expect(mockCreateReadStream).not.toHaveBeenCalled();
  });

  it('should return 404 Not Found when episode does not exist', async () => {
    mockGetById.mockResolvedValue(null);

    const res = await GET(makeRequest(), makeContext(TEST_ID));
    expect(res.status).toBe(404);
    expect(mockCreateReadStream).not.toHaveBeenCalled();
  });

  it('should return 404 Not Found when audio.mp3 file does not exist on disk', async () => {
    mockExistsSync.mockReturnValue(false);

    const res = await GET(makeRequest(), makeContext(TEST_ID));
    expect(res.status).toBe(404);
    expect(mockCreateReadStream).not.toHaveBeenCalled();
  });

  it('should return 416 Range Not Satisfiable when range values are out of file bounds', async () => {
    const res = await GET(
      makeRequest(`bytes=${FILE_SIZE + 50}-`),
      makeContext(TEST_ID),
    );
    expect(res.status).toBe(416);
    expect(res.headers.get('Content-Range')).toBe(`bytes */${FILE_SIZE}`);
    expect(mockCreateReadStream).not.toHaveBeenCalled();
  });

  it('should return 500 Internal Server Error when filesystem check throws exception', async () => {
    mockStat.mockRejectedValue(new Error('disk read crash'));

    const res = await GET(makeRequest(), makeContext(TEST_ID));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: 'disk read crash',
    });
  });
});
