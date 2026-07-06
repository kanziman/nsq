import { describe, it, expect, vi } from 'vitest';
import { POST } from './route';
import { getTutorResponse } from '@/lib/services/tutor';

vi.mock('@/lib/services/tutor', () => ({
  getTutorResponse: vi.fn(async (speakerId, message, context) => {
    if (message === 'Fail') throw new Error('LLM Error');
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('Mock stream'));
        controller.close();
      }
    });
  })
}));

describe('POST /api/tutor', () => {
  it('should return 200 and stream mock text when valid payload is provided', async () => {
    const req = new Request('http://localhost/api/tutor', {
      method: 'POST',
      body: JSON.stringify({ speakerId: 'General', message: 'Hello' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
  });

  it('should handle very long message string without throwing internal error', async () => {
    const req = new Request('http://localhost/api/tutor', {
      method: 'POST',
      body: JSON.stringify({ speakerId: 'General', message: 'A'.repeat(5000) }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('should return 400 Bad Request when message is empty', async () => {
    const req = new Request('http://localhost/api/tutor', {
      method: 'POST',
      body: JSON.stringify({ speakerId: 'General', message: '' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 Bad Request when speakerId is not General', async () => {
    const req = new Request('http://localhost/api/tutor', {
      method: 'POST',
      body: JSON.stringify({ speakerId: 'Angela', message: 'Hello' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return 500 Internal Server Error when LLM service throws an error', async () => {
    const req = new Request('http://localhost/api/tutor', {
      method: 'POST',
      body: JSON.stringify({ speakerId: 'General', message: 'Fail' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it('should accept context in payload and pass it to getTutorResponse', async () => {
    const mockContext = { text: 'Context text' };
    const req = new Request('http://localhost/api/tutor', {
      method: 'POST',
      body: JSON.stringify({ speakerId: 'General', message: 'Hello', context: mockContext }),
    });
    await POST(req);
    expect(getTutorResponse).toHaveBeenCalledWith('General', 'Hello', mockContext);
  });

  it('should return 400 Bad Request if context object is malformed', async () => {
    const req = new Request('http://localhost/api/tutor', {
      method: 'POST',
      // passing string instead of object for context
      body: JSON.stringify({ speakerId: 'General', message: 'Hello', context: 'invalid' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
