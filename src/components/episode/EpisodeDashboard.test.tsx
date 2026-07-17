// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  act,
  cleanup,
  fireEvent,
} from '@testing-library/react';
import EpisodeDashboard from './EpisodeDashboard';
import type { Episode } from '@/lib/types';

const COMPLETED_EPISODE: Episode = {
  id: 'vid123',
  title: 'Episode 1',
  duration: 300,
  youtubeUrl: 'https://youtube.com/watch?v=vid123',
  addedAt: '2026-06-29T10:00:00Z',
  importState: {
    videoId: 'vid123',
    status: 'completed',
    progress: 100,
    currentStep: 'completed',
    updatedAt: '2026-06-29T10:05:00Z',
  },
};

const IN_PROGRESS_EPISODE: Episode = {
  id: 'vid456',
  title: 'Episode 2 (임포트 중)',
  duration: 0,
  youtubeUrl: 'https://youtube.com/watch?v=vid456',
  addedAt: '2026-06-29T10:10:00Z',
  importState: {
    videoId: 'vid456',
    status: 'downloading',
    progress: 40,
    currentStep: 'download',
    updatedAt: '2026-06-29T10:11:00Z',
  },
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('EpisodeDashboard Component', () => {
  // S2(#160) AC3 — 목록을 조회 API가 아닌 정적 /episodes/index.json에서 로드한다.
  it('should load episode list from /episodes/index.json', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    await act(async () => {
      render(<EpisodeDashboard isLocal={true} />);
    });

    expect(global.fetch).toHaveBeenCalledWith('/episodes/index.json');
  });

  it('should render skeleton while fetching episodes initially', async () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));

    render(<EpisodeDashboard isLocal={true} />);
    expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument();
  });

  it('should render empty state with link to /import when no episodes exist', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    render(<EpisodeDashboard isLocal={true} />);

    await waitFor(() => {
      expect(
        screen.getByText(/등록된 에피소드가 없습니다/i),
      ).toBeInTheDocument();
    });
    const link = screen.getByRole('link', { name: /첫 에피소드 임포트하기/i });
    expect(link).toHaveAttribute('href', '/import');
  });

  // #169 — 아직 퍼블리시된 에피소드가 없어 index.json이 없을 때(404/HTML)
  // 하드 에러 대신 빈 상태를 렌더한다.
  it('should render empty state (not error) when index.json responds not-ok (404)', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);

    render(<EpisodeDashboard isLocal={true} />);

    await waitFor(() => {
      expect(
        screen.getByText(/등록된 에피소드가 없습니다/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/에피소드를 불러오는데 에러가 발생했습니다/i),
    ).toBeNull();
  });

  it('should render empty state (not error) when index.json returns non-JSON HTML', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token '<'");
      },
    } as unknown as Response);

    render(<EpisodeDashboard isLocal={true} />);

    await waitFor(() => {
      expect(
        screen.getByText(/등록된 에피소드가 없습니다/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/에피소드를 불러오는데 에러가 발생했습니다/i),
    ).toBeNull();
  });

  it('should render episode cards when episodes exist', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [COMPLETED_EPISODE],
    } as Response);

    render(<EpisodeDashboard isLocal={true} />);

    await waitFor(() => {
      expect(screen.getByText('Episode 1')).toBeInTheDocument();
    });
  });

  it('should start polling interval when at least one episode is in progress', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [IN_PROGRESS_EPISODE],
    } as Response);

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [IN_PROGRESS_EPISODE],
    } as Response);

    render(<EpisodeDashboard isLocal={true} />);

    await waitFor(() => {
      expect(screen.getByText('Episode 2 (임포트 중)')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should stop polling interval when all episodes transition to completed/failed', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [IN_PROGRESS_EPISODE],
    } as Response);

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [COMPLETED_EPISODE],
    } as Response);

    render(<EpisodeDashboard isLocal={true} />);

    await waitFor(() => {
      expect(screen.getByText('Episode 2 (임포트 중)')).toBeInTheDocument();
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(screen.getByText('Episode 1')).toBeInTheDocument();
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should render error state with retry button when API request fails', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('API failure'));

    render(<EpisodeDashboard isLocal={true} />);

    await waitFor(() => {
      expect(
        screen.getByText(/에피소드를 불러오는데 에러가 발생했습니다/i),
      ).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /다시 시도/i });
    expect(retryBtn).toBeInTheDocument();

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [COMPLETED_EPISODE],
    } as Response);

    await act(async () => {
      retryBtn.click();
    });

    await waitFor(() => {
      expect(screen.getByText('Episode 1')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------
  // AlertDialog 통합 및 삭제 연동 테스트
  // -------------------------------------------------------------
  it('should delete episode card and update UI when onDelete confirm is clicked', async () => {
    // 1. 초기 조회: 완료된 에피소드 1개 반환
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [COMPLETED_EPISODE],
    } as Response);

    render(<EpisodeDashboard isLocal={true} />);

    await waitFor(() => {
      expect(screen.getByText('Episode 1')).toBeInTheDocument();
    });

    // 2. 삭제 클릭 -> 다이얼로그 모달 오픈
    const deleteBtn = screen.getByRole('button', { name: /삭제/i });
    fireEvent.click(deleteBtn);

    expect(
      screen.getByText(/에피소드를 삭제하시겠습니까/i),
    ).toBeInTheDocument();

    // 3. DELETE API 모의 및 진짜 삭제 클릭
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const confirmBtn = screen.getByRole('button', { name: /진짜 삭제/i });

    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    // DELETE API 호출 확인
    expect(global.fetch).toHaveBeenLastCalledWith('/api/episodes/vid123', {
      method: 'DELETE',
    });

    // 대시보드 리스트에서 에피소드 1이 제거되었는지 확인
    await waitFor(() => {
      expect(screen.queryByText('Episode 1')).toBeNull();
    });
  });

  // -------------------------------------------------------------
  // S3(#162) — 배포(isLocal=false)에서 로컬 전용 동작(폴링·삭제) 비활성화
  // -------------------------------------------------------------
  it('should NOT set up 3s polling interval when isLocal is false even if an episode is in progress', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [IN_PROGRESS_EPISODE],
    } as Response);

    render(<EpisodeDashboard isLocal={false} />);

    await waitFor(() => {
      expect(screen.getByText('Episode 2 (임포트 중)')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // 폴링이 없어야 하므로 추가 호출이 발생하지 않는다.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should NOT render a delete button when isLocal is false', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [COMPLETED_EPISODE],
    } as Response);

    render(<EpisodeDashboard isLocal={false} />);

    await waitFor(() => {
      expect(screen.getByText('Episode 1')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /삭제/i })).toBeNull();
  });
});
