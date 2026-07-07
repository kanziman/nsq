// @vitest-environment jsdom
/**
 * #124: ImportMonitor 재시도 재접수 바디에 language 컨텍스트 포함.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ImportState } from '@/lib/types';

vi.mock('@/hooks/use-import-status', () => ({
  useImportStatus: vi.fn(),
}));

import { ImportMonitor } from './ImportMonitor';
import { useImportStatus } from '@/hooks/use-import-status';

const mockHook = vi.mocked(useImportStatus);
const restart = vi.fn();

function setState(state: ImportState) {
  mockHook.mockReturnValue({ state, error: null, loading: false, restart });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('ImportMonitor (language retry context)', () => {
  // [정상] 자막 전용(ja) 실패 재시도: language 포함, transcriptUrl 생략
  it("should include language and omit transcriptUrl in retry body when state has language 'ja' and no transcriptUrl", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ videoId: 'v', status: 'downloading' }), {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    setState({
      videoId: 'v',
      status: 'failed',
      progress: 40,
      currentStep: 'subtitle',
      error: 'yt-dlp produced no subtitle',
      youtubeUrl: 'https://youtube.com/watch?v=v',
      language: 'ja',
      updatedAt: '',
    });

    render(<ImportMonitor videoId="v" />);
    await userEvent.click(screen.getByRole('button', { name: /전체 재시도/ }));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, opts] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(opts.body as string);
    expect(body).toMatchObject({
      youtubeUrl: 'https://youtube.com/watch?v=v',
      language: 'ja',
      retryStep: 'all',
    });
    expect(body).not.toHaveProperty('transcriptUrl');
  });

  // [정상] 자막 전용 subtitle 실패 → 전체 재시도(all) 버튼 노출(기존 매핑 재사용)
  it('should show 전체 재시도(all) for failed subtitle step in subtitle-only import', () => {
    setState({
      videoId: 'v',
      status: 'failed',
      progress: 40,
      currentStep: 'subtitle',
      youtubeUrl: 'https://youtube.com/watch?v=v',
      language: 'ja',
      updatedAt: '',
    });
    render(<ImportMonitor videoId="v" />);
    expect(
      screen.getByRole('button', { name: /전체 재시도/ }),
    ).toBeInTheDocument();
  });

  // #125 [정상] building_sentences 상태 라벨 표시
  it("should show '문장 복원 중' when status is 'building_sentences'", () => {
    setState({
      videoId: 'v',
      status: 'building_sentences',
      progress: 92,
      currentStep: 'sentences',
      youtubeUrl: 'https://youtube.com/watch?v=v',
      language: 'ja',
      updatedAt: '',
    });
    render(<ImportMonitor videoId="v" />);
    expect(screen.getByText('문장 복원 중')).toBeInTheDocument();
  });

  // #125 [정상] transcriptUrl 없는 상태 → 타임라인이 자막 전용 단계로 표시
  it('should render subtitle-only timeline steps when state has no transcriptUrl', () => {
    setState({
      videoId: 'v',
      status: 'building_sentences',
      progress: 92,
      currentStep: 'sentences',
      youtubeUrl: 'https://youtube.com/watch?v=v',
      language: 'ja',
      updatedAt: '',
    });
    render(<ImportMonitor videoId="v" />);
    expect(screen.getByText('문장')).toBeInTheDocument();
    expect(screen.queryByText('정합')).not.toBeInTheDocument();
  });

  // [예외] 큐 세그먼트 생성 실패(currentStep 'segments') → 재시도 경로 제공(AC 검증 갭 보완)
  it('should show 전체 재시도(all) for failed segments step in subtitle-only import', () => {
    setState({
      videoId: 'v',
      status: 'failed',
      progress: 90,
      currentStep: 'segments',
      error: 'cue-segments: no cues parsed from subtitle.ja.vtt',
      youtubeUrl: 'https://youtube.com/watch?v=v',
      language: 'ja',
      updatedAt: '',
    });
    render(<ImportMonitor videoId="v" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no cues/);
    expect(
      screen.getByRole('button', { name: /전체 재시도/ }),
    ).toBeInTheDocument();
  });
});
