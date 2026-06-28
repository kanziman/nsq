// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ImportState } from '@/lib/types';

vi.mock('@/hooks/use-import-status', () => ({
  useImportStatus: vi.fn(),
}));

import { ImportMonitor } from './ImportMonitor';
import { useImportStatus } from '@/hooks/use-import-status';

const mockHook = vi.mocked(useImportStatus);

function setState(state: ImportState | null, error: string | null = null) {
  mockHook.mockReturnValue({ state, error, loading: false });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
