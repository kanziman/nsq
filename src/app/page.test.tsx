// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// 홈은 디자인 쇼케이스로 무거운 플레이어를 포함 → 모킹해 링크만 검증.
vi.mock('@/components/player/shadowing-player', () => ({
  ShadowingPlayer: () => null,
}));

import HomePage from './page';

afterEach(cleanup);

describe('HomePage', () => {
  it("should render an '임포트하기' link to /import", () => {
    render(<HomePage />);
    const link = screen.getByRole('link', { name: /임포트하기/ });
    expect(link).toHaveAttribute('href', '/import');
  });
});
