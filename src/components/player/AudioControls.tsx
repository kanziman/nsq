'use client';

import { Button } from '@/components/ui/button';

interface AudioControlsProps {
  isPlaying: boolean;
  onToggle: () => void;
}

export default function AudioControls({
  isPlaying,
  onToggle,
}: AudioControlsProps): React.ReactElement {
  return (
    <Button
      variant="primary"
      size="icon"
      className="rounded-full"
      aria-label={isPlaying ? '일시정지' : '재생'}
      onClick={onToggle}
    >
      {isPlaying ? '⏸' : '▶'}
    </Button>
  );
}
