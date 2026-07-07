/**
 * #129: getTutorResponse 언어별 페르소나 분기(ja 문법 튜터).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTutorResponse } from './tutor';
import { streamText } from 'ai';

vi.mock('ai', () => ({
  streamText: vi.fn().mockImplementation(async () => ({
    textStream: new ReadableStream({
      start(controller) {
        controller.enqueue('Mock');
        controller.close();
      },
    }),
  })),
}));

function systemOf(): string {
  const call = vi.mocked(streamText).mock.calls[0][0] as { system?: string };
  return call.system ?? '';
}

describe('getTutorResponse (language)', () => {
  beforeEach(() => {
    vi.mocked(streamText).mockClear();
  });

  // [정상] ja → 일본어 학습 튜터(문법 설명, 한국어 답변) 페르소나
  it("should use Japanese-learning tutor persona when language is 'ja'", async () => {
    await getTutorResponse('General', '이 문장 문법 알려줘', undefined, 'ja');
    const system = systemOf();
    expect(system).toMatch(/Japanese|일본어/i);
    expect(system).toMatch(/grammar|문법/i);
    expect(system).toMatch(/Korean|한국어/i);
    expect(system).not.toMatch(/English tutor/i);
  });

  // [정상] 언어 생략 → 기존 영어 튜터 페르소나 유지(회귀)
  it('should keep the existing English tutor persona when language is omitted', async () => {
    await getTutorResponse('General', 'Hello');
    expect(systemOf()).toContain('English tutor');
  });

  // [정상] ja 컨텍스트(원문+번역) 주입
  it('should append ja segment context to the system prompt when provided', async () => {
    await getTutorResponse(
      'General',
      '무슨 뜻이야?',
      { text: '今日はいい天気ですね。', translation: '오늘은 날씨가 좋네요.' },
      'ja',
    );
    const system = systemOf();
    expect(system).toContain('今日はいい天気ですね。');
    expect(system).toContain('오늘은 날씨가 좋네요.');
  });

  // [경계] General 외 화자 페르소나에도 ja 분기 적용
  it('should apply ja persona to non-General speaker prompts as well', async () => {
    await getTutorResponse('SPEAKER', '質問です', undefined, 'ja');
    const system = systemOf();
    expect(system).toContain('SPEAKER');
    expect(system).toMatch(/Japanese|일본어/i);
    expect(system).not.toMatch(/learning English/i);
  });
});
