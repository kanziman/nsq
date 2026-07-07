import { describe, it, expect, vi } from 'vitest';
import type { Segment } from '@/lib/types';
import { createOpenRouterSentenceBuilder } from './sentence-builder';

function cue(i: number, text: string): Segment {
  return { id: `cue-${i + 1}`, start: i, end: i + 1, speaker: 'SPEAKER', text };
}

const CUES = [cue(0, '今日は'), cue(1, 'いい天気')];

function fetchWithContent(content: string) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof fetch;
}

describe('createOpenRouterSentenceBuilder', () => {
  // [정상] 유효 JSON 파티션 응답 → 그룹 반환
  it('should return sentence groups when response is a valid JSON partition', async () => {
    const builder = createOpenRouterSentenceBuilder({
      apiKey: 'k',
      fetchFn: fetchWithContent('[{"text":"今日はいい天気。","cueCount":2}]'),
    });
    await expect(builder(CUES)).resolves.toEqual([
      { text: '今日はいい天気。', cueCount: 2 },
    ]);
  });

  // [정상] 문맥 힌트가 user 메시지에 포함
  it('should include context hint in the user message when provided', async () => {
    const fetchFn = fetchWithContent('[{"text":"S","cueCount":2}]');
    const builder = createOpenRouterSentenceBuilder({ apiKey: 'k', fetchFn });
    await builder(CUES, '이전 문장 힌트');

    const [, init] = (
      fetchFn as unknown as { mock: { calls: [string, RequestInit][] } }
    ).mock.calls[0];
    const body = JSON.parse(init.body as string) as {
      messages: { role: string; content: string }[];
    };
    const user = body.messages.find((m) => m.role === 'user');
    expect(user?.content).toContain('이전 문장 힌트');
  });

  // [경계] 파티션 합 불일치 → 빈 배열(스킵 신호)
  it('should return empty array when response partition mismatches input cue count', async () => {
    const builder = createOpenRouterSentenceBuilder({
      apiKey: 'k',
      fetchFn: fetchWithContent('[{"text":"S","cueCount":5}]'),
    });
    await expect(builder(CUES)).resolves.toEqual([]);
  });

  // [경계] JSON 파싱 불가 → 빈 배열
  it('should return empty array when response is not parseable JSON', async () => {
    const builder = createOpenRouterSentenceBuilder({
      apiKey: 'k',
      fetchFn: fetchWithContent('죄송합니다, 문장으로 병합했습니다.'),
    });
    await expect(builder(CUES)).resolves.toEqual([]);
  });

  // [예외] 키 부재/HTTP 오류 → throw
  it('should throw when API key is missing or HTTP status is not ok', async () => {
    const noKey = createOpenRouterSentenceBuilder({
      apiKey: '',
      fetchFn: fetchWithContent('[]'),
    });
    await expect(noKey(CUES)).rejects.toThrow(/OPENROUTER_API_KEY/);

    const http500 = createOpenRouterSentenceBuilder({
      apiKey: 'k',
      fetchFn: vi.fn(
        async () => new Response('err', { status: 500 }),
      ) as unknown as typeof fetch,
    });
    await expect(http500(CUES)).rejects.toThrow(/500/);
  });
});
