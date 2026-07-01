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
        enabledSpeakers={['DUCKWORTH', 'DUBNER', 'BOTH', 'NARRATOR']}
        onToggleSpeaker={onToggleSpeaker}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: label('DUBNER') }));
    expect(onToggleSpeaker).toHaveBeenCalledWith('DUBNER');
  });
});
