// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SpeedSlider from './SpeedSlider';

afterEach(cleanup);

describe('SpeedSlider', () => {
  it('[정상] should render slider, +/-, and speed text', () => {
    render(<SpeedSlider playbackRate={1.0} onSetPlaybackRate={vi.fn()} />);
    expect(screen.getByRole('slider')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '속도 감소' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '속도 증가' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1.00x')).toBeInTheDocument();
  });

  it('[정상] should increase by 0.05 when + is clicked', () => {
    const setRate = vi.fn();
    render(<SpeedSlider playbackRate={1.0} onSetPlaybackRate={setRate} />);
    fireEvent.click(screen.getByRole('button', { name: '속도 증가' }));
    expect(setRate).toHaveBeenCalledWith(1.05);
  });

  it('[경계] should clamp to 0.50x when - is clicked at minimum', () => {
    const setRate = vi.fn();
    render(<SpeedSlider playbackRate={0.5} onSetPlaybackRate={setRate} />);
    fireEvent.click(screen.getByRole('button', { name: '속도 감소' }));
    expect(setRate).not.toHaveBeenCalled(); // 0.5 미만으로 내려가지 않으므로 호출되지 않거나 0.5를 유지
  });

  it('[경계] should clamp to 2.00x when + is clicked at maximum', () => {
    const setRate = vi.fn();
    render(<SpeedSlider playbackRate={2.0} onSetPlaybackRate={setRate} />);
    fireEvent.click(screen.getByRole('button', { name: '속도 증가' }));
    expect(setRate).not.toHaveBeenCalled();
  });

  it('[정상] should reset to 1.00x when speed text is clicked', () => {
    const setRate = vi.fn();
    render(<SpeedSlider playbackRate={1.5} onSetPlaybackRate={setRate} />);
    fireEvent.click(screen.getByText('1.50x'));
    expect(setRate).toHaveBeenCalledWith(1.0);
  });

  it('[정상] should reset to 1.00x when slider is double-clicked', () => {
    const setRate = vi.fn();
    render(<SpeedSlider playbackRate={1.5} onSetPlaybackRate={setRate} />);
    fireEvent.doubleClick(screen.getByRole('slider'));
    expect(setRate).toHaveBeenCalledWith(1.0);
  });
});
