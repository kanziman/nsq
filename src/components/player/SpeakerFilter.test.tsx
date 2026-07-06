// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SpeakerFilter from './SpeakerFilter';
import { SPEAKER_COLORS } from '@/lib/constants/speakers';

afterEach(cleanup);

const label = (key: keyof typeof SPEAKER_COLORS) =>
  `${SPEAKER_COLORS[key].name} 화자 필터`;

describe('SpeakerFilter', () => {
  it('[정상] should render a toggle button per speaker with aria-pressed reflecting enabled', () => {
    render(
      <SpeakerFilter
        speakers={['DUCKWORTH', 'DUBNER', 'BOTH', 'NARRATOR']}
        enabledSpeakers={['DUCKWORTH', 'BOTH']}
        onToggleSpeaker={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: label('DUCKWORTH') }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: label('DUBNER') }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: label('BOTH') })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('button', { name: label('NARRATOR') }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('[정상] clicking a speaker button should call onToggleSpeaker with that key', () => {
    const onToggleSpeaker = vi.fn();
    render(
      <SpeakerFilter
        speakers={['DUCKWORTH', 'DUBNER', 'BOTH', 'NARRATOR']}
        enabledSpeakers={['DUCKWORTH', 'DUBNER', 'BOTH', 'NARRATOR']}
        onToggleSpeaker={onToggleSpeaker}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: label('DUBNER') }));
    expect(onToggleSpeaker).toHaveBeenCalledWith('DUBNER');
  });

  it('[정상] 전달된 화자만 렌더하고, 알려지지 않은 화자는 키를 이름으로 표시(멀티 팟캐스트)', () => {
    render(
      <SpeakerFilter
        speakers={['HOST_A', 'GUEST_B']}
        enabledSpeakers={['HOST_A']}
        onToggleSpeaker={vi.fn()}
      />,
    );
    // NSQ 전용 화자(Angela 등)는 렌더되지 않는다.
    expect(
      screen.queryByRole('button', { name: label('DUCKWORTH') }),
    ).toBeNull();
    // 임의 화자 키가 이름으로 노출된다.
    expect(
      screen.getByRole('button', { name: 'HOST_A 화자 필터' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'GUEST_B 화자 필터' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});
