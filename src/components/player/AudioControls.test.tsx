// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AudioControls from './AudioControls';

afterEach(cleanup);

const baseProps = {
  isPlaying: false,
  onToggle: vi.fn(),
  currentTime: 65,
  duration: 320,
  onSeek: vi.fn(),
  onPrev: vi.fn(),
  onNext: vi.fn(),
  isLooping: false,
  onToggleLoop: vi.fn(),
  repeatCount: 0,
  canLoop: true,
};

describe('AudioControls', () => {
  it('[정상] should render play control and call onToggle on click when paused', () => {
    const onToggle = vi.fn();
    render(<AudioControls {...baseProps} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: '재생' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('[정상] should reflect playing state (aria-label 일시정지) when isPlaying', () => {
    render(<AudioControls {...baseProps} isPlaying={true} />);
    expect(
      screen.getByRole('button', { name: '일시정지' }),
    ).toBeInTheDocument();
  });

  it('[정상] should render current/total time via formatTime', () => {
    render(<AudioControls {...baseProps} currentTime={65} duration={320} />);
    expect(screen.getByText('01:05')).toBeInTheDocument();
    expect(screen.getByText('05:20')).toBeInTheDocument();
  });

  it('[정상] should call onSeek with new value when range changes', () => {
    const onSeek = vi.fn();
    render(<AudioControls {...baseProps} onSeek={onSeek} />);
    const slider = screen.getByRole('slider', { name: '탐색' });
    fireEvent.change(slider, { target: { value: '100' } });
    expect(onSeek).toHaveBeenCalledWith(100);
  });

  it('[정상] should call onPrev/onNext when ⏮/⏭ clicked', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<AudioControls {...baseProps} onPrev={onPrev} onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: '이전 세그먼트' }));
    fireEvent.click(screen.getByRole('button', { name: '다음 세그먼트' }));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('[정상] loop toggle should call onToggleLoop', () => {
    const onToggleLoop = vi.fn();
    render(<AudioControls {...baseProps} onToggleLoop={onToggleLoop} />);
    fireEvent.click(screen.getByRole('button', { name: '구간 반복' }));
    expect(onToggleLoop).toHaveBeenCalledTimes(1);
  });

  it('[정상] should show repeat count badge when looping', () => {
    render(<AudioControls {...baseProps} isLooping={true} repeatCount={3} />);
    expect(screen.getByText('3회')).toBeInTheDocument();
  });

  it('[경계] loop toggle should be disabled when canLoop is false', () => {
    render(<AudioControls {...baseProps} canLoop={false} />);
    expect(screen.getByRole('button', { name: '구간 반복' })).toBeDisabled();
  });
});
