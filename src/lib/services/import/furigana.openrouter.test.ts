import { describe, it, expect, vi } from 'vitest';
import type { Segment } from '@/lib/types';
import { createOpenRouterFuriganaAnnotator } from './furigana';

function seg(text: string): Segment {
  return { id: 's1', start: 0, end: 2, speaker: 'SPEAKER', text };
}

function fetchWithContent(content: string) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  ) as unknown as typeof fetch;
}

describe('createOpenRouterFuriganaAnnotator', () => {
  // [정상] 유효 JSON 루비 행렬 파싱
  it('should parse a valid JSON ruby matrix', async () => {
    const annotator = createOpenRouterFuriganaAnnotator({
      apiKey: 'k',
      fetchFn: fetchWithContent(
        '[[{"text":"天気","rt":"てんき"},{"text":"です"}]]',
      ),
    });
    await expect(annotator([seg('天気です')])).resolves.toEqual([
      [{ text: '天気', rt: 'てんき' }, { text: 'です' }],
    ]);
  });

  // [경계] 길이 불일치·파싱 불가 → 빈 배열(스킵 신호)
  it('should return empty array on length mismatch or unparseable response', async () => {
    const mismatch = createOpenRouterFuriganaAnnotator({
      apiKey: 'k',
      fetchFn: fetchWithContent('[[{"text":"a"}],[{"text":"b"}]]'),
    });
    await expect(mismatch([seg('天気です')])).resolves.toEqual([]);

    const garbage = createOpenRouterFuriganaAnnotator({
      apiKey: 'k',
      fetchFn: fetchWithContent('후리가나를 달았습니다!'),
    });
    await expect(garbage([seg('天気です')])).resolves.toEqual([]);
  });

  // [예외] 키 부재/HTTP 오류 → throw
  it('should throw when API key missing or HTTP error', async () => {
    const noKey = createOpenRouterFuriganaAnnotator({
      apiKey: '',
      fetchFn: fetchWithContent('[]'),
    });
    await expect(noKey([seg('天気です')])).rejects.toThrow(
      /OPENROUTER_API_KEY/,
    );

    const http500 = createOpenRouterFuriganaAnnotator({
      apiKey: 'k',
      fetchFn: vi.fn(
        async () => new Response('err', { status: 500 }),
      ) as unknown as typeof fetch,
    });
    await expect(http500([seg('天気です')])).rejects.toThrow(/500/);
  });
});
