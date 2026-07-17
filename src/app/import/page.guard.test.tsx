// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// 환경 판정은 케이스별로 제어 (기본 로컬).
vi.mock('@/lib/utils/env', () => ({
  isProductionDeploy: vi.fn(() => false),
}));
// 클라이언트 임포트 UI는 마커로 대체해 라우팅/폼 의존성 제거.
vi.mock('@/components/import/ImportClient', () => ({
  ImportClient: () => <div data-testid="import-client">import-client</div>,
}));

import ImportPage from './page';
import { isProductionDeploy } from '@/lib/utils/env';

const mockIsProd = vi.mocked(isProductionDeploy);

afterEach(() => {
  cleanup();
  mockIsProd.mockReturnValue(false);
});

describe('ImportPage production guard', () => {
  it('should render the client import UI when not production deploy', () => {
    mockIsProd.mockReturnValue(false);
    render(<ImportPage />);
    expect(screen.getByTestId('import-client')).toBeInTheDocument();
  });

  it('should render a local-only notice when production deploy', () => {
    mockIsProd.mockReturnValue(true);
    render(<ImportPage />);
    expect(screen.getByText(/로컬 개발 환경에서만/)).toBeInTheDocument();
    expect(screen.queryByTestId('import-client')).toBeNull();
  });
});
