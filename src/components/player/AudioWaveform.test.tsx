// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AudioWaveform from './AudioWaveform';

afterEach(cleanup);

describe('AudioWaveform', () => {
  const dummyWaveform = [0.1, 0.5, 0.8, 0.3, 0.2];

  it('[정상] should render canvas for waveform visualization', () => {
    render(
      <AudioWaveform
        waveform={dummyWaveform}
        currentTime={1.0}
        segmentStart={0.0}
        segmentEnd={2.0}
        onSeek={vi.fn()}
      />,
    );
    // Canvas 기반이므로 presentation role의 canvas 요소가 렌더링되어야 함
    const canvas = screen.getByRole('presentation');
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('[정상] should reflect progress via aria-valuenow', () => {
    // segment 길이 2.0초, 현재 1.0초 → 50%
    render(
      <AudioWaveform
        waveform={dummyWaveform}
        currentTime={1.0}
        segmentStart={0.0}
        segmentEnd={2.0}
        onSeek={vi.fn()}
      />,
    );
    const slider = screen.getByRole('slider', { name: '오디오 파형' });
    expect(slider).toHaveAttribute('aria-valuenow', '50');
  });

  it('[정상] clicking should call onSeek with calculated time', () => {
    const onSeek = vi.fn();
    render(
      <AudioWaveform
        waveform={dummyWaveform}
        currentTime={1.0}
        segmentStart={0.0}
        segmentEnd={2.0}
        onSeek={onSeek}
      />,
    );
    const container = screen.getByRole('slider', { name: '오디오 파형' });
    fireEvent.click(container, { clientX: 50 });
    expect(onSeek).toHaveBeenCalled();
  });

  it('[경계] should render container even if waveform is empty', () => {
    render(
      <AudioWaveform
        waveform={[]}
        currentTime={0}
        segmentStart={0}
        segmentEnd={0}
        onSeek={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('slider', { name: '오디오 파형' }),
    ).toBeInTheDocument();
  });
});
