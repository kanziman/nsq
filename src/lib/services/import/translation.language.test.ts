/**
 * #126: createOpenRouterTranslator 언어 라우팅(ja→ko / en→ko) + 화자 접두사 제거 일반화.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Segment } from '@/lib/types';
import { createOpenRouterTranslator } from './translation';

function seg(text: string, speaker = 'SPEAKER'): Segment {
  return { id: 's1', start: 0, end: 1, speaker, text };
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

function systemPromptOf(fetchFn: unknown): string {
  const [, init] = (fetchFn as { mock: { calls: [string, RequestInit][] } })
    .mock.calls[0];
  const body = JSON.parse(init.body as string) as {
    messages: { role: string; content: string }[];
  };
  return body.messages.find((m) => m.role === 'system')?.content ?? '';
}

describe('createOpenRouterTranslator (language routing)', () => {
  // [정상] ja → 일본어→한국어 시스템 프롬프트
  it("should use a Japanese→Korean system prompt when language is 'ja'", async () => {
    const fetchFn = fetchWithContent('["안녕하세요"]');
    const translator = createOpenRouterTranslator(
      { apiKey: 'k', fetchFn },
      'ja',
    );
    await translator([seg('こんにちは')]);

    const system = systemPromptOf(fetchFn);
    expect(system).toContain('일본어');
    expect(system).toContain('한국어');
    expect(system).not.toContain('영어 대사');
  });

  // [정상] 언어 생략 → 기존 영→한 프롬프트 유지(회귀)
  it('should keep the existing English→Korean system prompt when language is omitted', async () => {
    const fetchFn = fetchWithContent('["안녕"]');
    const translator = createOpenRouterTranslator({ apiKey: 'k', fetchFn });
    await translator([seg('Hello')]);

    const system = systemPromptOf(fetchFn);
    expect(system).toContain('영어 대사');
    expect(system).toContain('한국어');
  });

  // [정상] 임의 화자 접두사([SPEAKER]) 되받음 제거
  it('should strip arbitrary bracketed speaker prefixes echoed by the model', async () => {
    const translator = createOpenRouterTranslator(
      { apiKey: 'k', fetchFn: fetchWithContent('["[SPEAKER] 안녕하세요"]') },
      'ja',
    );
    await expect(translator([seg('こんにちは')])).resolves.toEqual([
      '안녕하세요',
    ]);
  });

  // [경계] 번호 + 레거시 화자 접두사 제거 유지(회귀)
  it('should still strip numbered + legacy speaker prefixes', async () => {
    const translator = createOpenRouterTranslator({
      apiKey: 'k',
      fetchFn: fetchWithContent('["1. [DUBNER] 반갑습니다"]'),
    });
    await expect(
      translator([seg('Nice to meet you', 'DUBNER')]),
    ).resolves.toEqual(['반갑습니다']);
  });

  // [경계] 화자 키가 아닌 정당한 대괄호 서두([웃음] 등)는 보존
  it('should preserve legitimate bracketed content that is not a batch speaker key', async () => {
    const translator = createOpenRouterTranslator(
      { apiKey: 'k', fetchFn: fetchWithContent('["[웃음] 정말 반가워요"]') },
      'ja',
    );
    await expect(
      translator([seg('本当に嬉しいです', 'SPEAKER')]),
    ).resolves.toEqual(['[웃음] 정말 반가워요']);
  });

  // [예외] 언어와 무관하게 HTTP 오류 → throw
  it('should throw on HTTP error regardless of language', async () => {
    const translator = createOpenRouterTranslator(
      {
        apiKey: 'k',
        fetchFn: vi.fn(
          async () => new Response('err', { status: 500 }),
        ) as unknown as typeof fetch,
      },
      'ja',
    );
    await expect(translator([seg('こんにちは')])).rejects.toThrow(/500/);
  });
});
