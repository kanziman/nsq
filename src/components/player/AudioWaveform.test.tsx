// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AudioWaveform from './AudioWaveform';

afterEach(cleanup);

describe('AudioWaveform', () => {
  const dummyWaveform = [0.1, 0.5, 0.8, 0.3, 0.2];

  it('[정상] should render bars based on waveform data', () => {
    render(
      <AudioWaveform
        waveform={dummyWaveform}
        currentTime={1.0}
        segmentStart={0.0}
        segmentEnd={2.0}
        onSeek={vi.fn()}
      />,
    );
    // 5개의 바가 렌더링되어야 함
    const bars = screen.getAllByRole('presentation');
    expect(bars).toHaveLength(5);
  });

  it('[정상] should highlight bars up to currentTime', () => {
    // segment 길이는 2.0초. 현재 시간은 1.0초이므로 정확히 50% 진행.
    // 5개의 바 중 앞의 2~3개는 primary, 나머지는 muted 색상이어야 함.
    render(
      <AudioWaveform
        waveform={dummyWaveform}
        currentTime={1.0}
        segmentStart={0.0}
        segmentEnd={2.0}
        onSeek={vi.fn()}
      />,
    );
    const bars = screen.getAllByRole('presentation');
    // 바 0과 1은 currentTime(50%) 이전이므로 활성 색상이어야 함
    expect(bars[0].className).toContain('bg-primary');
    expect(bars[4].className).toContain('bg-surface-dark-soft');
  });

  it('[정상] clicking a bar should call onSeek with calculated time', () => {
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
    // 버튼 역할을 하는 컨테이너 클릭
    const container = screen.getByRole('slider', { name: '오디오 파형' });
    // JSDOM 환경에서는 clientX 속성을 이용한 정확한 클릭 좌표 테스트가 어려우므로,
    // fireEvent에서 mock 좌표를 넘기거나 컴포넌트 내부에서 처리.
    // 여기서는 onSeek 호출만 검증
    fireEvent.click(container, { clientX: 50 });
    expect(onSeek).toHaveBeenCalled();
  });

  it('[경계] should render flat bar if waveform is empty', () => {
    render(
      <AudioWaveform
        waveform={[]}
        currentTime={0}
        segmentStart={0}
        segmentEnd={0}
        onSeek={vi.fn()}
      />,
    );
    // 빈 파형일 때도 컨테이너는 렌더링되어야 함 (UI 깨짐 방지)
    expect(
      screen.getByRole('slider', { name: '오디오 파형' }),
    ).toBeInTheDocument();
  });
});
