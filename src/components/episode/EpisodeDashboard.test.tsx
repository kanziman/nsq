// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
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
  it('should render skeleton while fetching episodes initially', async () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));

    render(<EpisodeDashboard />);
    expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument();
  });

  it('should render empty state with link to /import when no episodes exist', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    render(<EpisodeDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/등록된 에피소드가 없습니다/i),
      ).toBeInTheDocument();
    });
    const link = screen.getByRole('link', { name: /첫 에피소드 임포트하기/i });
    expect(link).toHaveAttribute('href', '/import');
  });

  it('should render episode cards when episodes exist', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [COMPLETED_EPISODE],
    } as Response);

    render(<EpisodeDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/EpisodeCard Stub - Episode 1/i),
      ).toBeInTheDocument();
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

    render(<EpisodeDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/EpisodeCard Stub - Episode 2/i),
      ).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should stop polling interval when all episodes transition to completed/failed', async () => {
    // 1차: 진행중 상태 반환 -> 폴링 가동됨
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [IN_PROGRESS_EPISODE],
    } as Response);

    // 2차 및 그 이후: 완료 상태 반환 -> 폴링 중단 유도
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [COMPLETED_EPISODE],
    } as Response);

    render(<EpisodeDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/EpisodeCard Stub - Episode 2/i),
      ).toBeInTheDocument();
    });

    // 1차 폴링 유발 (3초 경과) -> 완료 데이터 획득
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(
        screen.getByText(/EpisodeCard Stub - Episode 1/i),
      ).toBeInTheDocument();
    });

    // 추가 3초 경과 -> 폴링 중단으로 인해 추가 fetch가 일어나지 않아야 함
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2); // 여전히 2회 유지
  });

  it('should render error state with retry button when API request fails', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('API failure'));

    render(<EpisodeDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/에피소드를 불러오는데 에러가 발생했습니다/i),
      ).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /다시 시도/i });
    expect(retryBtn).toBeInTheDocument();

    // 다시 시도 누르기 전 Mock API 응답 리로드용 정상 설정
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [COMPLETED_EPISODE],
    } as Response);

    await act(async () => {
      retryBtn.click();
    });

    await waitFor(() => {
      expect(
        screen.getByText(/EpisodeCard Stub - Episode 1/i),
      ).toBeInTheDocument();
    });
  });
});
