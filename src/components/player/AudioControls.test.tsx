// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AudioControls from './AudioControls';

afterEach(cleanup);

describe('AudioControls', () => {
  it('[정상] should render play control and call onToggle on click when paused', () => {
    const onToggle = vi.fn();
    render(<AudioControls isPlaying={false} onToggle={onToggle} />);
    const btn = screen.getByRole('button', { name: '재생' });
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('[정상] should reflect playing state (aria-label 일시정지) when isPlaying', () => {
    const onToggle = vi.fn();
    render(<AudioControls isPlaying={true} onToggle={onToggle} />);
    expect(
      screen.getByRole('button', { name: '일시정지' }),
    ).toBeInTheDocument();
  });
});
