// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ImportState } from '@/lib/types';

vi.mock('@/hooks/use-import-status', () => ({
  useImportStatus: vi.fn(),
}));

import { ImportMonitor, retryPlanFor } from './ImportMonitor';
import { useImportStatus } from '@/hooks/use-import-status';

const mockHook = vi.mocked(useImportStatus);
const restart = vi.fn();

function setState(state: ImportState | null, error: string | null = null) {
  mockHook.mockReturnValue({ state, error, loading: false, restart });
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('ImportMonitor', () => {
  it('should render timeline and matchRate on completed', () => {
    setState({
      videoId: 'v',
      status: 'completed',
      progress: 100,
      currentStep: 'completed',
      matchRate: 0.91,
      updatedAt: '',
    });
    render(<ImportMonitor videoId="v" />);
    // 타임라인 존재(정합 단계 완료)
    expect(screen.getByText('정합').getAttribute('data-state')).toBe('done');
    // matchRate 표시(91%)
    expect(screen.getByText(/91/)).toBeInTheDocument();
  });

  it('should not render the matchRate section when matchRate is undefined on completed', () => {
    setState({
      videoId: 'v',
      status: 'completed',
      progress: 100,
      currentStep: 'completed',
      updatedAt: '',
    });
    render(<ImportMonitor videoId="v" />);
    expect(screen.queryByText(/정합 품질/)).not.toBeInTheDocument();
  });

  it('should show fallback error text when failed has no error field', () => {
    setState({
      videoId: 'v',
      status: 'failed',
      progress: 40,
      currentStep: 'subtitle',
      updatedAt: '',
    });
    render(<ImportMonitor videoId="v" />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      '임포트에 실패했습니다.',
    );
  });

  it('should show the error message on failed', () => {
    setState({
      videoId: 'v',
      status: 'failed',
      progress: 90,
      currentStep: 'alignment',
      error: 'matchRate 0.5 < 0.85',
      matchRate: 0.5,
      updatedAt: '',
    });
    render(<ImportMonitor videoId="v" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/0\.5/);
  });
});

describe('retryPlanFor', () => {
  it("should return retryStep 'all' / '전체 재시도' when currentStep is 'download'", () => {
    expect(retryPlanFor('download')).toEqual({
      retryStep: 'all',
      label: '전체 재시도',
    });
  });

  it("should return retryStep 'all' / '전체 재시도' when currentStep is 'subtitle'", () => {
    expect(retryPlanFor('subtitle')).toEqual({
      retryStep: 'all',
      label: '전체 재시도',
    });
  });

  it("should return retryStep 'transcript' / '대본·정합 재시도' when currentStep is 'transcript'", () => {
    expect(retryPlanFor('transcript')).toEqual({
      retryStep: 'transcript',
      label: '대본·정합 재시도',
    });
  });

  it("should return retryStep 'transcript' / '대본·정합 재시도' when currentStep is 'alignment'", () => {
    expect(retryPlanFor('alignment')).toEqual({
      retryStep: 'transcript',
      label: '대본·정합 재시도',
    });
  });

  it('should return null when currentStep is unmapped', () => {
    expect(retryPlanFor('completed')).toBeNull();
    expect(retryPlanFor('translating')).toBeNull();
  });
});

describe('ImportMonitor retry', () => {
  function failedState(currentStep: string): ImportState {
    return {
      videoId: 'v',
      status: 'failed',
      progress: 40,
      currentStep,
      error: 'boom',
      youtubeUrl: 'https://youtu.be/v',
      transcriptUrl: 'https://freakonomics.com/x',
      updatedAt: '',
    };
  }

  it("should render only [전체 재시도] button when failed and currentStep is 'download'", () => {
    setState(failedState('download'));
    render(<ImportMonitor videoId="v" />);
    expect(
      screen.getByRole('button', { name: '전체 재시도' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '대본·정합 재시도' }),
    ).not.toBeInTheDocument();
  });

  it("should render [전체 재시도] button when failed and currentStep is 'subtitle'", () => {
    setState(failedState('subtitle'));
    render(<ImportMonitor videoId="v" />);
    expect(
      screen.getByRole('button', { name: '전체 재시도' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '대본·정합 재시도' }),
    ).not.toBeInTheDocument();
  });

  it("should render [대본·정합 재시도] button when failed and currentStep is 'alignment'", () => {
    setState(failedState('alignment'));
    render(<ImportMonitor videoId="v" />);
    expect(
      screen.getByRole('button', { name: '대본·정합 재시도' }),
    ).toBeInTheDocument();
  });

  it("should render [대본·정합 재시도] button when failed and currentStep is 'transcript'", () => {
    setState(failedState('transcript'));
    render(<ImportMonitor videoId="v" />);
    expect(
      screen.getByRole('button', { name: '대본·정합 재시도' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '전체 재시도' }),
    ).not.toBeInTheDocument();
  });

  it("should POST /api/import with retryStep 'all' and state URLs when [전체 재시도] clicked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ videoId: 'v', status: 'downloading' }, 202),
      );
    vi.stubGlobal('fetch', fetchMock);
    setState(failedState('download'));
    render(<ImportMonitor videoId="v" />);

    await userEvent.click(screen.getByRole('button', { name: '전체 재시도' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/import');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      youtubeUrl: 'https://youtu.be/v',
      transcriptUrl: 'https://freakonomics.com/x',
      retryStep: 'all',
    });
  });

  it("should POST /api/import with retryStep 'transcript' when [대본·정합 재시도] clicked", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ videoId: 'v', status: 'downloading' }, 202),
      );
    vi.stubGlobal('fetch', fetchMock);
    setState(failedState('alignment'));
    render(<ImportMonitor videoId="v" />);

    await userEvent.click(
      screen.getByRole('button', { name: '대본·정합 재시도' }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).retryStep).toBe('transcript');
  });

  it('should call restart() to resume polling after a 202 retry response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ videoId: 'v', status: 'downloading' }, 202),
      );
    vi.stubGlobal('fetch', fetchMock);
    setState(failedState('alignment'));
    render(<ImportMonitor videoId="v" />);

    await userEvent.click(
      screen.getByRole('button', { name: '대본·정합 재시도' }),
    );

    await waitFor(() => expect(restart).toHaveBeenCalled());
  });

  it("should not render any retry button when status is 'completed'", () => {
    setState({
      videoId: 'v',
      status: 'completed',
      progress: 100,
      currentStep: 'completed',
      matchRate: 0.9,
      updatedAt: '',
    });
    render(<ImportMonitor videoId="v" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should not render retry button when failed but currentStep is unmapped', () => {
    setState(failedState('translating'));
    render(<ImportMonitor videoId="v" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should not call restart() when retry POST does not return 202', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'boom' }, 500));
    vi.stubGlobal('fetch', fetchMock);
    setState(failedState('alignment'));
    render(<ImportMonitor videoId="v" />);

    await userEvent.click(
      screen.getByRole('button', { name: '대본·정합 재시도' }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(restart).not.toHaveBeenCalled();
  });
});
