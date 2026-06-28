// @vitest-environment jsdom
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

async function fillValid() {
  await userEvent.type(screen.getByLabelText(/youtube/i), YT);
  await userEvent.type(screen.getByLabelText(/대본|transcript/i), TR);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ImportForm', () => {
  it('should disable submit until both urls are valid', async () => {
    render(<ImportForm />);
    const submit = screen.getByRole('button', { name: SUBMIT });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/youtube/i), YT);
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/대본|transcript/i), TR);
    expect(submit).toBeEnabled();
  });

  it('should POST both URLs and call onAccepted(videoId) on 202', async () => {
    const fetchMock = jsonResponse(202, {
      videoId: 'abc123',
      status: 'downloading',
    });
    vi.stubGlobal('fetch', fetchMock);
    const onAccepted = vi.fn();
    render(<ImportForm onAccepted={onAccepted} />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: SUBMIT }));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/import');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body as string)).toMatchObject({
      youtubeUrl: YT,
      transcriptUrl: TR,
    });
    expect(onAccepted).toHaveBeenCalledWith('abc123');
  });

  it('should show an acceptance confirmation on 202', async () => {
    vi.stubGlobal(
      'fetch',
      jsonResponse(202, { videoId: 'abc123', status: 'downloading' }),
    );
    render(<ImportForm />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: SUBMIT }));
    expect(await screen.findByRole('status')).toHaveTextContent(/접수/);
  });

  it('should show inline error on 400', async () => {
    vi.stubGlobal(
      'fetch',
      jsonResponse(400, { error: 'youtubeUrl is required' }),
    );
    render(<ImportForm />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: SUBMIT }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /youtubeUrl is required/,
    );
  });

  it('should show "이미 {status} 상태" inline on 409', async () => {
    vi.stubGlobal(
      'fetch',
      jsonResponse(409, {
        error: 'already',
        videoId: 'abc123',
        status: 'completed',
      }),
    );
    render(<ImportForm />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: SUBMIT }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /이미.*completed.*상태/,
    );
  });

  it('should show the server error text inline on 500', async () => {
    vi.stubGlobal(
      'fetch',
      jsonResponse(500, { error: 'Internal Server Error' }),
    );
    render(<ImportForm />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: SUBMIT }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Internal Server Error/,
    );
  });

  it('should show a fallback inline error on 500 with no error field', async () => {
    vi.stubGlobal('fetch', jsonResponse(500, {}));
    render(<ImportForm />);
    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: SUBMIT }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/실패/);
  });
});
