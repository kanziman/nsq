import { describe, it, expect, vi } from 'vitest';
import { createOpenRouterTranslator } from './translation';
import type { Segment } from '@/lib/types';

function seg(i: number, over: Partial<Segment> = {}): Segment {
  return {
    id: `seg-${i}`,
    start: i,
    end: i + 1,
    speaker: 'DUBNER',
    text: `line ${i}`,
    ...over,
  };
}

// OpenAI 호환 chat completion 응답을 흉내내는 fetch 스텁.
function chatResponse(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createOpenRouterTranslator (import-translation 이슈 #104)', () => {
  it('[정상] AC1: 요청 본문에 각 세그먼트 화자·원문 순서 + 한국어 JSON 배열 지시', async () => {
    const fetchFn = vi.fn(async () =>
      chatResponse(JSON.stringify(['가', '나'])),
    );
    const translator = createOpenRouterTranslator({
      apiKey: 'k',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await translator([
      seg(0, { speaker: 'DUCKWORTH', text: 'Hello there' }),
      seg(1, { speaker: 'DUBNER', text: 'Nice to meet you' }),
    ]);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    const prompt = JSON.stringify(body.messages);
    // 화자와 원문이 순서대로 포함
    expect(prompt).toContain('DUCKWORTH');
    expect(prompt).toContain('Hello there');
    expect(prompt).toContain('DUBNER');
    expect(prompt).toContain('Nice to meet you');
    // 한국어 JSON 배열 지시
    expect(prompt).toMatch(/JSON/i);
    expect(prompt).toMatch(/한국어|Korean/);
    // reasoning effort 최소화 — 지연·비용 절감(모델이 완전 비활성화를 막으므로 low)
    expect(body.reasoning).toEqual({ effort: 'low' });
    // Authorization 헤더
    expect((init.headers as Record<string, string>).Authorization).toContain(
      'k',
    );
  });

  it('[정상] 모델·env 미지정 시 기본 모델은 gemini-2.5-flash', async () => {
    vi.stubEnv('OPENROUTER_MODEL', '');
    const fetchFn = vi.fn(async () => chatResponse(JSON.stringify(['가'])));
    const translator = createOpenRouterTranslator({
      apiKey: 'k',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await translator([seg(0)]);

    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('google/gemini-3.5-flash');
    vi.unstubAllEnvs();
  });

  it('[정상] AC2: 유효한 JSON 배열 응답을 입력과 동일 길이 string[]로 반환', async () => {
    const fetchFn = vi.fn(async () =>
      chatResponse(JSON.stringify(['안녕하세요', '반가워요'])),
    );
    const translator = createOpenRouterTranslator({
      apiKey: 'k',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const out = await translator([seg(0), seg(1)]);
    expect(out).toEqual(['안녕하세요', '반가워요']);
  });

  it('[경계] AC3: 코드펜스로 감싼 응답도 펜스 제거 후 파싱', async () => {
    const fenced = '```json\n["가", "나"]\n```';
    const fetchFn = vi.fn(async () => chatResponse(fenced));
    const translator = createOpenRouterTranslator({
      apiKey: 'k',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const out = await translator([seg(0), seg(1)]);
    expect(out).toEqual(['가', '나']);
  });

  it('[경계] AC4: 응답 길이≠입력이면 빈 배열 반환(이슈1이 스킵)', async () => {
    const fetchFn = vi.fn(async () => chatResponse(JSON.stringify(['하나만'])));
    const translator = createOpenRouterTranslator({
      apiKey: 'k',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const out = await translator([seg(0), seg(1)]);
    expect(out).toEqual([]);
  });

  it('[예외] AC5: HTTP 401/5xx는 예외를 던진다(이슈1 배치 실패 격리)', async () => {
    const fetchFn = vi.fn(async () => chatResponse('', 500));
    const translator = createOpenRouterTranslator({
      apiKey: 'k',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await expect(translator([seg(0)])).rejects.toThrow();
  });

  it('[예외] AC6: apiKey 미설정이면 fetch 호출 없이 즉시 실패', async () => {
    const fetchFn = vi.fn(async () => chatResponse('[]'));
    const translator = createOpenRouterTranslator({
      apiKey: '',
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await expect(translator([seg(0)])).rejects.toThrow();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
