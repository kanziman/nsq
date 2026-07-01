'use client';

import { Button } from '@/components/ui/button';
import { SPEAKER_COLORS, type SpeakerKey } from '@/lib/constants/speakers';

const SPEAKER_KEYS = Object.keys(SPEAKER_COLORS) as SpeakerKey[];

interface SpeakerFilterProps {
  enabledSpeakers: SpeakerKey[];
  onToggleSpeaker: (speaker: SpeakerKey) => void;
}

export default function SpeakerFilter({
  enabledSpeakers,
  onToggleSpeaker,
}: SpeakerFilterProps): React.ReactElement {
  return (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label="화자 필터"
    >
      {SPEAKER_KEYS.map((key) => {
        const enabled = enabledSpeakers.includes(key);
        return (
          <Button
            key={key}
            variant={enabled ? 'primary' : 'secondaryOnDark'}
            size="sm"
            aria-label={`${SPEAKER_COLORS[key].name} 화자 필터`}
            aria-pressed={enabled}
            onClick={() => onToggleSpeaker(key)}
          >
            {SPEAKER_COLORS[key].name}
          </Button>
        );
      })}
    </div>
  );
}
