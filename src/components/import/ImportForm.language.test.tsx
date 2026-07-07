// @vitest-environment jsdom
/**
 * #124: ImportForm 언어 선택(en/ja) + 자막 전용 제출.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportForm } from './ImportForm';

const YT = 'https://www.youtube.com/watch?v=abc123';
const TR = 'https://freakonomics.com/podcast/x';
const SUBMIT = /임포트|제출|시작/;

function jsonResponse(status: number, body: unknown) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ImportForm (language)', () => {
  // [정상] 언어 세그먼티드 버튼, 기본 EN 선택
  it("should render language segmented buttons with 'EN' selected by default", () => {
    render(<ImportForm />);
    const en = screen.getByRole('button', { name: /^EN$/i });
    const ja = screen.getByRole('button', { name: /^JA$/i });
    expect(en).toHaveAttribute('aria-pressed', 'true');
    expect(ja).toHaveAttribute('aria-pressed', 'false');
  });

  // [정상] JA 선택 시 대본 입력 숨김
  it("should hide transcript input when 'JA' is selected", async () => {
    render(<ImportForm />);
    expect(screen.getByLabelText(/대본|transcript/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^JA$/i }));
    expect(screen.queryByLabelText(/대본|transcript/i)).not.toBeInTheDocument();
  });

  // [정상] ja 제출: language 포함, transcriptUrl 제외
  it('should POST body with language and without transcriptUrl when ja import is submitted', async () => {
    const fetchMock = jsonResponse(202, {
      videoId: 'abc123',
      status: 'downloading',
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ImportForm />);
    await userEvent.click(screen.getByRole('button', { name: /^JA$/i }));
    await userEvent.type(screen.getByLabelText(/youtube/i), YT);
    await userEvent.click(screen.getByRole('button', { name: SUBMIT }));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, opts] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(opts.body as string);
    expect(body).toMatchObject({ youtubeUrl: YT, language: 'ja' });
    expect(body).not.toHaveProperty('transcriptUrl');
  });

  // [정상] en + 대본 제출: 기존 바디 + language 'en' (회귀)
  it("should POST body including transcriptUrl and language 'en' when en + transcript provided", async () => {
    const fetchMock = jsonResponse(202, {
      videoId: 'abc123',
      status: 'downloading',
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ImportForm />);
    await userEvent.type(screen.getByLabelText(/youtube/i), YT);
    await userEvent.type(screen.getByLabelText(/대본|transcript/i), TR);
    await userEvent.click(screen.getByRole('button', { name: SUBMIT }));

    const [, opts] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(opts.body as string)).toMatchObject({
      youtubeUrl: YT,
      transcriptUrl: TR,
      language: 'en',
    });
  });

  // [정상] JA 전환 후 EN 복귀 시 대본 입력 복원(값 초기화)
  it('should restore an empty transcript input when switching back to EN after JA', async () => {
    render(<ImportForm />);
    await userEvent.type(screen.getByLabelText(/대본|transcript/i), TR);
    await userEvent.click(screen.getByRole('button', { name: /^JA$/i }));
    await userEvent.click(screen.getByRole('button', { name: /^EN$/i }));
    expect(screen.getByLabelText(/대본|transcript/i)).toHaveValue('');
  });

  // [예외] API 400 → 인라인 에러 표시(ja 경로)
  it('should show error and keep form when API returns 400 for ja submit', async () => {
    vi.stubGlobal('fetch', jsonResponse(400, { error: 'bad language' }));
    render(<ImportForm />);
    await userEvent.click(screen.getByRole('button', { name: /^JA$/i }));
    await userEvent.type(screen.getByLabelText(/youtube/i), YT);
    await userEvent.click(screen.getByRole('button', { name: SUBMIT }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/bad language/);
  });
});
