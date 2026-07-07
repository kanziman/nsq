/**
 * @vitest-environment jsdom
 * #129: TutorChat이 POST 바디에 language를 포함한다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TutorChat } from './TutorChat';

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    body: { getReader: () => ({ read: async () => ({ done: true }) }) },
  } as unknown as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function send(text: string): Promise<void> {
  const input = screen.getByPlaceholderText(/메시지를 입력하세요/i);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input);
}

describe('TutorChat (language)', () => {
  // [정상] language prop 'ja' → 바디 포함
  it("should include language in the POST body when language prop is 'ja'", async () => {
    const fetchMock = stubFetch();
    render(<TutorChat language="ja" />);
    await send('この文法は？');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ language: 'ja' });
  });

  // [정상] prop 생략 → 'en' 기본(회귀)
  it("should default language to 'en' in the POST body when prop omitted", async () => {
    const fetchMock = stubFetch();
    render(<TutorChat />);
    await send('Hello');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ language: 'en' });
  });
});
