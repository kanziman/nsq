/**
 * #124: POST /api/import — language 수용 + transcriptUrl 선택화(자막 전용 모드 접수).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const YT = 'https://www.youtube.com/watch?v=vid124';
const TR = 'https://example.com/transcript';

beforeEach(() => {
  vi.clearAllMocks();
  mockExtract.mockReturnValue('vid124');
  mockGetState.mockResolvedValue(null);
  mockSaveState.mockResolvedValue(undefined);
  mockRunPipeline.mockResolvedValue(undefined);
});

describe('POST /api/import (language / subtitle-only)', () => {
  // [정상] ja + 대본 없음 → 202 + 자막 전용 파이프라인 시작
  it("should return 202 and start subtitle-only pipeline when body has youtubeUrl + language 'ja' and no transcriptUrl", async () => {
    const res = await POST(makeRequest({ youtubeUrl: YT, language: 'ja' }));
    expect(res.status).toBe(202);
    expect(mockRunPipeline).toHaveBeenCalledTimes(1);
    const [, urls] = mockRunPipeline.mock.calls[0];
    expect(urls).toMatchObject({ youtubeUrl: YT, language: 'ja' });
    expect(urls.transcriptUrl).toBeUndefined();
  });

  // [정상] 레거시 바디(en 기본값) 회귀
  it("should accept legacy body (youtubeUrl + transcriptUrl, no language) and default language to 'en'", async () => {
    const res = await POST(makeRequest({ youtubeUrl: YT, transcriptUrl: TR }));
    expect(res.status).toBe(202);
    const [, urls] = mockRunPipeline.mock.calls[0];
    expect(urls).toMatchObject({
      youtubeUrl: YT,
      transcriptUrl: TR,
      language: 'en',
    });
  });

  // [경계] 공백 transcriptUrl → 부재 취급, en 자막 전용 허용
  it("should treat blank transcriptUrl as absent and accept subtitle-only import for language 'en'", async () => {
    const res = await POST(
      makeRequest({ youtubeUrl: YT, transcriptUrl: '   ', language: 'en' }),
    );
    expect(res.status).toBe(202);
    const [, urls] = mockRunPipeline.mock.calls[0];
    expect(urls.transcriptUrl).toBeUndefined();
  });

  // [예외] 지원하지 않는 language → 400
  it("should return 400 when language is not 'en' or 'ja'", async () => {
    const res = await POST(
      makeRequest({ youtubeUrl: YT, transcriptUrl: TR, language: 'xx' }),
    );
    expect(res.status).toBe(400);
    expect(mockSaveState).not.toHaveBeenCalled();
    expect(mockRunPipeline).not.toHaveBeenCalled();
  });

  // [예외] ja + transcriptUrl 조합 → 400
  it("should return 400 when language 'ja' is combined with transcriptUrl", async () => {
    const res = await POST(
      makeRequest({ youtubeUrl: YT, transcriptUrl: TR, language: 'ja' }),
    );
    expect(res.status).toBe(400);
    expect(mockRunPipeline).not.toHaveBeenCalled();
  });

  // [정상] 초기 import-state에 language 영속
  it('should persist language in initial import-state when accepted', async () => {
    await POST(makeRequest({ youtubeUrl: YT, language: 'ja' }));
    expect(mockSaveState).toHaveBeenCalledTimes(1);
    const [, state] = mockSaveState.mock.calls[0];
    expect(state.language).toBe('ja');
  });

  // #125 [예외] sentences 재시도는 자막 전용 전용 — transcriptUrl 동시 전달 시 400
  it("should return 400 when retryStep 'sentences' is combined with transcriptUrl", async () => {
    const res = await POST(
      makeRequest({
        youtubeUrl: YT,
        transcriptUrl: TR,
        language: 'en',
        retryStep: 'sentences',
      }),
    );
    expect(res.status).toBe(400);
    expect(mockRunPipeline).not.toHaveBeenCalled();
  });

  // #125 [정상] building_sentences는 진행중 상태 — 신규 임포트 409 차단
  it("should return 409 for a new import when existing status is 'building_sentences'", async () => {
    mockGetState.mockResolvedValue({
      videoId: 'vid124',
      status: 'building_sentences',
      progress: 92,
      currentStep: 'sentences',
      updatedAt: new Date().toISOString(),
    });
    const res = await POST(makeRequest({ youtubeUrl: YT, language: 'ja' }));
    expect(res.status).toBe(409);
    expect(mockRunPipeline).not.toHaveBeenCalled();
  });
});
