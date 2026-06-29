// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import EpisodeCard from './EpisodeCard';
import type { Episode } from '@/lib/types';

const COMPLETED_EPISODE: Episode = {
  id: 'vid123',
  title: 'Editorial Shadowing Guide',
  duration: 320, // 5분 20초
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
  title: 'Processing Next.js Audio',
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

const FAILED_EPISODE: Episode = {
  id: 'vid789',
  title: 'Failed Alignment Podcast',
  duration: 0,
  youtubeUrl: 'https://youtube.com/watch?v=vid789',
  addedAt: '2026-06-29T10:20:00Z',
  importState: {
    videoId: 'vid789',
    status: 'failed',
    progress: 80,
    currentStep: 'align',
    error: 'Patience diff anchoring matched only 0.40 (threshold 0.85)',
    updatedAt: '2026-06-29T10:22:00Z',
  },
};

const mockOnDelete = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('EpisodeCard Component', () => {
  it('should render title, thumbnail and duration when status is completed', () => {
    render(<EpisodeCard episode={COMPLETED_EPISODE} onDelete={mockOnDelete} />);

    expect(screen.getByText('Editorial Shadowing Guide')).toBeInTheDocument();
    expect(screen.getByText('05:20')).toBeInTheDocument();
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute(
      'src',
      expect.stringContaining('i.ytimg.com/vi/vid123'),
    );
  });

  it('should render progress bar and step name when status is downloading', () => {
    render(
      <EpisodeCard episode={IN_PROGRESS_EPISODE} onDelete={mockOnDelete} />,
    );

    expect(screen.getByText('Processing Next.js Audio')).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText(/YouTube 다운로드 중/i)).toBeInTheDocument();
  });

  it('should render failed badge and error tooltip when status is failed', () => {
    render(<EpisodeCard episode={FAILED_EPISODE} onDelete={mockOnDelete} />);

    expect(screen.getByText('Failed Alignment Podcast')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(
      screen.getByText(/Patience diff anchoring matched only 0.40/i),
    ).toBeInTheDocument();
  });

  it('should navigate to player page on click when completed', () => {
    render(<EpisodeCard episode={COMPLETED_EPISODE} onDelete={mockOnDelete} />);

    // 카드 루트 링크가 여러 개 생기거나 삭제 버튼의 링크와 분리하기 위해 play-link 검증
    const link = screen.getByRole('link', { name: /학습하기/i });
    expect(link).toHaveAttribute('href', '/episodes/vid123');
  });

  it('should NOT navigate on click when in progress', () => {
    render(
      <EpisodeCard episode={IN_PROGRESS_EPISODE} onDelete={mockOnDelete} />,
    );

    const link = screen.queryByRole('link', { name: /학습하기/i });
    expect(link).toBeNull();
  });

  it('should navigate to retry import page on click retry button when failed', () => {
    render(<EpisodeCard episode={FAILED_EPISODE} onDelete={mockOnDelete} />);

    const retryLink = screen.getByRole('link', { name: /재시도/i });
    expect(retryLink).toHaveAttribute('href', '/import?videoId=vid789');
  });

  // -------------------------------------------------------------
  // 삭제 (DELETE / AlertDialog) 검증 케이스 추가
  // -------------------------------------------------------------
  it('should show AlertDialog modal when delete button is clicked', () => {
    render(<EpisodeCard episode={COMPLETED_EPISODE} onDelete={mockOnDelete} />);

    const deleteBtn = screen.getByRole('button', { name: /삭제/i });
    fireEvent.click(deleteBtn);

    expect(
      screen.getByText(/에피소드를 삭제하시겠습니까/i),
    ).toBeInTheDocument();
  });

  it('should call onDelete prop and close modal when confirm delete is clicked', async () => {
    render(<EpisodeCard episode={COMPLETED_EPISODE} onDelete={mockOnDelete} />);

    const deleteBtn = screen.getByRole('button', { name: /삭제/i });
    fireEvent.click(deleteBtn);

    const confirmBtn = screen.getByRole('button', { name: /진짜 삭제/i });
    fireEvent.click(confirmBtn);

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockOnDelete).toHaveBeenCalledWith('vid123');
    // 다이얼로그 모달 문구가 지워졌는지 비동기적으로 대기 검증
    await waitFor(() => {
      expect(screen.queryByText(/에피소드를 삭제하시겠습니까/i)).toBeNull();
    });
  });

  it('should close modal without calling onDelete when cancel is clicked', () => {
    render(<EpisodeCard episode={COMPLETED_EPISODE} onDelete={mockOnDelete} />);

    const deleteBtn = screen.getByRole('button', { name: /삭제/i });
    fireEvent.click(deleteBtn);

    const cancelBtn = screen.getByRole('button', { name: /취소/i });
    fireEvent.click(cancelBtn);

    expect(mockOnDelete).not.toHaveBeenCalled();
    expect(screen.queryByText(/에피소드를 삭제하시겠습니까/i)).toBeNull();
  });

  it('should disable delete button when episode status is downloading', () => {
    render(
      <EpisodeCard episode={IN_PROGRESS_EPISODE} onDelete={mockOnDelete} />,
    );

    const deleteBtn = screen.getByRole('button', { name: /삭제/i });
    expect(deleteBtn).toBeDisabled();
  });
});
