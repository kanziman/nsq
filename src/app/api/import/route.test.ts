import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ImportState } from '@/lib/types';

// --- 협력자(모듈) 테스트 더블 ---
vi.mock('@/lib/utils/youtube', () => ({
  extractVideoId: vi.fn(),
}));
vi.mock('@/lib/services/episodes', () => ({
  getImportState: vi.fn(),
  saveImportState: vi.fn(),
}));
vi.mock('@/lib/services/import-pipeline', () => ({
  runImportPipeline: vi.fn(),
}));

import { POST } from './route';
import { extractVideoId } from '@/lib/utils/youtube';
import { getImportState, saveImportState } from '@/lib/services/episodes';
import { runImportPipeline } from '@/lib/services/import-pipeline';

const mockExtract = vi.mocked(extractVideoId);
const mockGetState = vi.mocked(getImportState);
const mockSaveState = vi.mocked(saveImportState);
const mockRunPipeline = vi.mocked(runImportPipeline);

function makeRequest(body: unknown, rawBody?: string): Request {
  return new Request('http://localhost/api/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: rawBody !== undefined ? rawBody : JSON.stringify(body),
  });
}

const VALID_BODY = {
  youtubeUrl: 'https://www.youtube.com/watch?v=vid123',
  transcriptUrl: 'https://example.com/transcript',
};

function stateWith(status: ImportState['status']): ImportState {
  return {
    videoId: 'vid123',
    status,
    progress: 0,
    currentStep: 'download',
    updatedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // 기본 더블: videoId 추출 성공, 기존 상태 없음, write/pipeline 성공
  mockExtract.mockReturnValue('vid123');
  mockGetState.mockResolvedValue(null);
  mockSaveState.mockResolvedValue(undefined);
  mockRunPipeline.mockResolvedValue(undefined);
});

describe('POST /api/import', () => {
  // ------------------------------ 정상 ------------------------------
  it("should return 202 with { videoId, status: 'downloading' } when youtubeUrl and transcriptUrl are valid", async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({
      videoId: 'vid123',
      status: 'downloading',
    });
  });

  it("should create import-state.json with status 'downloading', progress 0, currentStep 'download' when request is accepted", async () => {
    await POST(makeRequest(VALID_BODY));
    expect(mockSaveState).toHaveBeenCalledTimes(1);
    const [videoIdArg, stateArg] = mockSaveState.mock.calls[0];
    expect(videoIdArg).toBe('vid123');
    expect(stateArg).toMatchObject({
      status: 'downloading',
      progress: 0,
      currentStep: 'download',
    });
    expect(stateArg.updatedAt).toEqual(expect.any(String));
  });

  it('should call runImportPipeline without awaiting (fire-and-forget) after responding 202', async () => {
    // 파이프라인이 영원히 매달려도 라우트는 202로 즉시 응답해야 한다.
    mockRunPipeline.mockReturnValue(new Promise<void>(() => {}));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(202);
    expect(mockRunPipeline).toHaveBeenCalledTimes(1);
    expect(mockRunPipeline).toHaveBeenCalledWith(
      'vid123',
      expect.objectContaining({
        youtubeUrl: VALID_BODY.youtubeUrl,
        transcriptUrl: VALID_BODY.transcriptUrl,
      }),
    );
  });

  it("should return 202 and start fresh when existing state status is 'failed'", async () => {
    mockGetState.mockResolvedValue(stateWith('failed'));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(202);
    expect(mockSaveState).toHaveBeenCalledTimes(1);
  });

  it('should return 202 and start fresh when no existing state exists for videoId', async () => {
    mockGetState.mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(202);
    expect(mockSaveState).toHaveBeenCalledTimes(1);
  });

  // ------------------------------ 경계 ------------------------------
  it('should return 409 for each in-progress status when retryStep is absent', async () => {
    const inProgress: ImportState['status'][] = [
      'downloading',
      'processing_subtitles',
      'processing_transcript',
      'aligning',
    ];
    for (const status of inProgress) {
      vi.clearAllMocks();
      mockExtract.mockReturnValue('vid123');
      mockGetState.mockResolvedValue(stateWith(status));
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status, `status=${status}`).toBe(409);
      expect(mockSaveState, `status=${status}`).not.toHaveBeenCalled();
    }
  });

  it('should return 400 when transcriptUrl is whitespace-only (treated as empty)', async () => {
    const res = await POST(
      makeRequest({ ...VALID_BODY, transcriptUrl: '   ' }),
    );
    expect(res.status).toBe(400);
  });

  it("should bypass 409 and proceed when retryStep is present even though existing state is 'completed'", async () => {
    mockGetState.mockResolvedValue(stateWith('completed'));
    const res = await POST(
      makeRequest({ ...VALID_BODY, retryStep: 'transcript' }),
    );
    expect(res.status).toBe(202);
  });

  // ------------------------------ 예외 ------------------------------
  it('should return 400 and NOT create import-state.json when videoId extraction fails', async () => {
    mockExtract.mockReturnValue(null);
    const res = await POST(
      makeRequest({ ...VALID_BODY, youtubeUrl: 'https://example.com/no-id' }),
    );
    expect(res.status).toBe(400);
    expect(mockSaveState).not.toHaveBeenCalled();
  });

  it('should return 400 when transcriptUrl is an empty string', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, transcriptUrl: '' }));
    expect(res.status).toBe(400);
  });

  it('should return 400 when youtubeUrl is missing or non-string', async () => {
    const missing = await POST(makeRequest({ transcriptUrl: 'https://x/t' }));
    expect(missing.status).toBe(400);
    const nonString = await POST(
      makeRequest({ ...VALID_BODY, youtubeUrl: 123 }),
    );
    expect(nonString.status).toBe(400);
  });

  it('should return 400 when transcriptUrl is missing or non-string', async () => {
    const missing = await POST(
      makeRequest({ youtubeUrl: VALID_BODY.youtubeUrl }),
    );
    expect(missing.status).toBe(400);
    const nonString = await POST(
      makeRequest({ ...VALID_BODY, transcriptUrl: 123 }),
    );
    expect(nonString.status).toBe(400);
  });

  it('should return 400 when request body is not valid JSON', async () => {
    const res = await POST(makeRequest(undefined, '{ not valid json'));
    expect(res.status).toBe(400);
  });

  it("should return 409 with current status when existing state is 'completed' and retryStep is absent", async () => {
    mockGetState.mockResolvedValue(stateWith('completed'));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({ status: 'completed' });
  });

  it("should return 409 with { error, videoId, status } when existing state is in progress ('downloading') and retryStep is absent", async () => {
    mockGetState.mockResolvedValue(stateWith('downloading'));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({
      videoId: 'vid123',
      status: 'downloading',
    });
    expect(body.error).toEqual(expect.any(String));
  });

  it('should return 500 when saveImportState throws unexpectedly', async () => {
    mockSaveState.mockRejectedValue(new Error('disk full'));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.any(String),
    });
  });
});
