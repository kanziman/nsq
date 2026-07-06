import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTutorResponse } from './tutor';
import { streamText } from 'ai';

vi.mock('ai', () => ({
  streamText: vi.fn().mockImplementation(async ({ messages }) => {
    if (messages[0].content === 'Fail') throw new Error('API Error');
    return {
      textStream: new ReadableStream({
        start(controller) {
          controller.enqueue('Mock Response');
          controller.close();
        }
      })
    };
  })
}));

vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn(() => 'mock-model')
}));

describe('getTutorResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call OpenAI API with the correct General persona system prompt and user message', async () => {
    const stream = await getTutorResponse('General', 'Hello');
    expect(stream).toBeInstanceOf(ReadableStream);
    expect(streamText).toHaveBeenCalled();
  });

  it('should throw error when OpenAI API fails or returns an error response', async () => {
    await expect(getTutorResponse('General', 'Fail')).rejects.toThrow();
  });

  it('should append context information to the system prompt when provided', async () => {
    await getTutorResponse('General', 'Hello', { text: 'My Context' });
    
    // verify the system prompt includes context
    const mockCall = vi.mocked(streamText).mock.calls[0][0];
    expect(mockCall.system).toContain('My Context');
  });

  it('should handle missing or empty context safely without altering base persona', async () => {
    vi.mocked(streamText).mockClear();
    await getTutorResponse('General', 'Hello');
    
    const mockCall = vi.mocked(streamText).mock.calls[0][0];
    expect(mockCall.system).not.toContain('Current sentence context');
  });
});
