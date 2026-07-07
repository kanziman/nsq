/**
 * #129: POST /api/tutor — language 수용·전달.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services/tutor', () => ({
  getTutorResponse: vi.fn(),
}));

import { POST } from './route';
import { getTutorResponse } from '@/lib/services/tutor';

const mockTutor = vi.mocked(getTutorResponse);

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/tutor', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function emptyStream(): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTutor.mockResolvedValue(emptyStream());
});

describe('POST /api/tutor (language)', () => {
  // [정상] language 'ja' 전달
  it("should forward language to getTutorResponse when body has language 'ja'", async () => {
    const res = await POST(
      makeRequest({
        speakerId: 'General',
        message: '문법 질문',
        language: 'ja',
      }),
    );
    expect(res.status).toBe(200);
    expect(mockTutor).toHaveBeenCalledWith(
      'General',
      '문법 질문',
      undefined,
      'ja',
    );
  });

  // [정상] 부재 시 'en' 기본(회귀)
  it("should default language to 'en' when omitted", async () => {
    await POST(makeRequest({ speakerId: 'General', message: 'Hello' }));
    expect(mockTutor).toHaveBeenCalledWith('General', 'Hello', undefined, 'en');
  });

  // [예외] 지원하지 않는 language → 400
  it('should return 400 when language is unsupported', async () => {
    const res = await POST(
      makeRequest({ speakerId: 'General', message: 'x', language: 'xx' }),
    );
    expect(res.status).toBe(400);
    expect(mockTutor).not.toHaveBeenCalled();
  });
});
