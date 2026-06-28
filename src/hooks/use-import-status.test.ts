// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useImportStatus } from './use-import-status';

function res(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useImportStatus', () => {
  it('should poll and expose state, stopping on completed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        res({
          videoId: 'v',
          status: 'aligning',
          progress: 90,
          currentStep: 'alignment',
          updatedAt: '',
        }),
      )
      .mockResolvedValue(
        res({
          videoId: 'v',
          status: 'completed',
          progress: 100,
          currentStep: 'completed',
          matchRate: 0.9,
          updatedAt: '',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useImportStatus('v', 20));
    await waitFor(() => expect(result.current.state?.status).toBe('completed'));

    const callsAtComplete = fetchMock.mock.calls.length;
    await delay(70);
    // 터미널 상태이므로 추가 폴링 없음.
    expect(fetchMock.mock.calls.length).toBe(callsAtComplete);
    const [firstUrl] = fetchMock.mock.calls[0] as [string];
    expect(firstUrl).toBe('/api/import?videoId=v');
  });

  it('should stop polling when status becomes failed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        res({
          videoId: 'v',
          status: 'aligning',
          progress: 90,
          currentStep: 'alignment',
          updatedAt: '',
        }),
      )
      .mockResolvedValue(
        res({
          videoId: 'v',
          status: 'failed',
          progress: 90,
          currentStep: 'alignment',
          error: 'boom',
          updatedAt: '',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useImportStatus('v', 20));
    await waitFor(() => expect(result.current.state?.status).toBe('failed'));
    const countAtFailed = fetchMock.mock.calls.length;
    await delay(70);
    expect(fetchMock.mock.calls.length).toBe(countAtFailed);
  });

  it('should not update state after unmount', async () => {
    let resolveFetch: () => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((r) => {
        resolveFetch = () =>
          r(
            res({
              videoId: 'v',
              status: 'aligning',
              progress: 50,
              currentStep: 'alignment',
              updatedAt: '',
            }),
          );
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { unmount, result } = renderHook(() => useImportStatus('v', 20));
    unmount();
    resolveFetch();
    await delay(30);
    // cancelled=true이므로 setState 미호출(에러 없이 완료).
    expect(result.current.state).toBeNull();
  });

  it('should not poll when videoId is null', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useImportStatus(null, 20));
    await delay(60);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should expose error on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(res({ error: 'not found' }, 404)),
    );
    const { result } = renderHook(() => useImportStatus('v', 20));
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });
});
