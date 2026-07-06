'use client';

import { Button } from '@/components/ui/button';
import { resolveSpeaker } from '@/lib/constants/speakers';

interface SpeakerFilterProps {
  /** 이 에피소드에 실제 등장하는 화자 키 목록(등장 순서). */
  speakers: string[];
  enabledSpeakers: string[];
  onToggleSpeaker: (speaker: string) => void;
}

export default function SpeakerFilter({
  speakers,
  enabledSpeakers,
  onToggleSpeaker,
}: SpeakerFilterProps): React.ReactElement {
  return (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label="화자 필터"
    >
      {speakers.map((key) => {
        const enabled = enabledSpeakers.includes(key);
        const { name } = resolveSpeaker(key);
        return (
          <Button
            key={key}
            variant={enabled ? 'primary' : 'secondaryOnDark'}
            size="sm"
            className="rounded-full"
            aria-label={`${name} 화자 필터`}
            aria-pressed={enabled}
            onClick={() => onToggleSpeaker(key)}
          >
            {name}
          </Button>
        );
      })}
    </div>
  );
}
