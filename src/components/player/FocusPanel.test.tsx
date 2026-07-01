// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import FocusPanel from './FocusPanel';
import { SPEAKER_COLORS } from '@/lib/constants/speakers';
import { isRecordingSupported, startRecording } from '@/lib/utils/recorder';
import type { Segment } from '@/lib/types';

vi.mock('@/lib/utils/recorder', () => ({
  isRecordingSupported: vi.fn(() => true),
  startRecording: vi.fn(),
}));

const mockSupported = vi.mocked(isRecordingSupported);
const mockStart = vi.mocked(startRecording);

beforeEach(() => {
  vi.clearAllMocks();
  mockSupported.mockReturnValue(true);
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

const SEG: Segment = {
  id: 'f1',
  start: 65,
  end: 70,
  speaker: 'DUCKWORTH',
  text: 'Focus on this line.',
};

describe('FocusPanel', () => {
  it('[정상] should render the segment text and speaker name (AC1)', () => {
    render(<FocusPanel segment={SEG} onReplay={vi.fn()} />);
    expect(screen.getByText('Focus on this line.')).toBeInTheDocument();
    expect(screen.getByText(SPEAKER_COLORS.DUCKWORTH.name)).toBeInTheDocument();
    expect(screen.getByText('01:05')).toBeInTheDocument();
  });

  it('[정상] replay button should call onReplay', () => {
    const onReplay = vi.fn();
    render(<FocusPanel segment={SEG} onReplay={onReplay} />);
    fireEvent.click(screen.getByRole('button', { name: '다시 듣기' }));
    expect(onReplay).toHaveBeenCalledTimes(1);
  });

  it('[경계] null segment should render a placeholder without crashing', () => {
    expect(() =>
      render(<FocusPanel segment={null} onReplay={vi.fn()} />),
    ).not.toThrow();
    expect(screen.queryByText('Focus on this line.')).toBeNull();
  });

  it('[정상] should show an enabled record button when supported (AC1)', () => {
    render(<FocusPanel segment={SEG} onReplay={vi.fn()} />);
    expect(screen.getByRole('button', { name: '녹음' })).toBeEnabled();
  });

  it('[예외] should disable record and show notice when unsupported (AC3)', () => {
    mockSupported.mockReturnValue(false);
    render(<FocusPanel segment={SEG} onReplay={vi.fn()} />);
    expect(screen.getByRole('button', { name: '녹음' })).toBeDisabled();
    expect(screen.getByText(/지원되지 않/)).toBeInTheDocument();
  });

  it('[정상] recording then stopping should reveal playback audio (AC1)', async () => {
    const stop = vi.fn().mockResolvedValue(new Blob(['x']));
    mockStart.mockResolvedValue({ stop });
    const { container } = render(
      <FocusPanel segment={SEG} onReplay={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '녹음' }));
    // 녹음 중 → 정지 버튼 노출
    const stopBtn = await screen.findByRole('button', { name: '정지' });
    fireEvent.click(stopBtn);
    await waitFor(() =>
      expect(container.querySelector('audio')).toBeInTheDocument(),
    );
    expect(container.querySelector('audio')?.getAttribute('src')).toBe(
      'blob:mock',
    );
  });

  it('[예외] permission denial should show a notice and not crash (AC3)', async () => {
    mockStart.mockRejectedValue(new Error('NotAllowedError'));
    render(<FocusPanel segment={SEG} onReplay={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '녹음' }));
    expect(await screen.findByText(/권한/)).toBeInTheDocument();
  });

  it('[정상] while recording, the record button is replaced by stop (mutual exclusive)', async () => {
    mockStart.mockResolvedValue({
      stop: vi.fn().mockResolvedValue(new Blob()),
    });
    render(<FocusPanel segment={SEG} onReplay={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '녹음' }));
    await screen.findByRole('button', { name: '정지' });
    expect(screen.queryByRole('button', { name: '녹음' })).toBeNull();
  });

  it('[정상] a second recording should revoke the previous blob URL (AC2)', async () => {
    mockStart.mockResolvedValue({
      stop: vi.fn().mockResolvedValue(new Blob()),
    });
    (URL.createObjectURL as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce('blob:one')
      .mockReturnValueOnce('blob:two');
    const { container } = render(
      <FocusPanel segment={SEG} onReplay={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '녹음' }));
    fireEvent.click(await screen.findByRole('button', { name: '정지' }));
    await waitFor(() =>
      expect(container.querySelector('audio')?.getAttribute('src')).toBe(
        'blob:one',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: '녹음' }));
    fireEvent.click(await screen.findByRole('button', { name: '정지' }));
    await waitFor(() =>
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:one'),
    );
  });

  it('[정상] unmount should revoke the object URL (AC2)', async () => {
    const stop = vi.fn().mockResolvedValue(new Blob(['x']));
    mockStart.mockResolvedValue({ stop });
    const { container, unmount } = render(
      <FocusPanel segment={SEG} onReplay={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '녹음' }));
    fireEvent.click(await screen.findByRole('button', { name: '정지' }));
    await waitFor(() =>
      expect(container.querySelector('audio')).toBeInTheDocument(),
    );
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });
});
