// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// 홈은 디자인 쇼케이스로 무거운 플레이어를 포함 → 모킹해 링크만 검증.
vi.mock('@/components/player/shadowing-player', () => ({
  ShadowingPlayer: () => null,
}));
// 환경 판정은 케이스별로 제어 (기본 로컬).
vi.mock('@/lib/utils/env', () => ({
  isProductionDeploy: vi.fn(() => false),
}));

import HomePage from './page';
import { isProductionDeploy } from '@/lib/utils/env';

const mockIsProd = vi.mocked(isProductionDeploy);

afterEach(() => {
  cleanup();
  mockIsProd.mockReturnValue(false);
});

describe('HomePage', () => {
  it("should render an '임포트하기' link to /import when not production deploy", () => {
    mockIsProd.mockReturnValue(false);
    render(<HomePage />);
    const link = screen.getByRole('link', { name: /임포트하기/ });
    expect(link).toHaveAttribute('href', '/import');
  });

  it("should NOT render an '임포트하기' link when production deploy", () => {
    mockIsProd.mockReturnValue(true);
    render(<HomePage />);
    expect(screen.queryByRole('link', { name: /임포트하기/ })).toBeNull();
  });
});
