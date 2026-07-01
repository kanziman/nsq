'use client';

import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/utils/time';

interface AudioControlsProps {
  isPlaying: boolean;
  onToggle: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onPrev: () => void;
  onNext: () => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  repeatCount: number;
  canLoop: boolean;
}

export default function AudioControls({
  isPlaying,
  onToggle,
  currentTime,
  duration,
  onSeek,
  onPrev,
  onNext,
  isLooping,
  onToggleLoop,
  repeatCount,
  canLoop,
}: AudioControlsProps): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondaryOnDark"
        size="icon"
        aria-label="이전 세그먼트"
        onClick={onPrev}
      >
        ⏮
      </Button>
      <Button
        variant="primary"
        size="icon"
        className="rounded-full"
        aria-label={isPlaying ? '일시정지' : '재생'}
        onClick={onToggle}
      >
        {isPlaying ? '⏸' : '▶'}
      </Button>
      <Button
        variant="secondaryOnDark"
        size="icon"
        aria-label="다음 세그먼트"
        onClick={onNext}
      >
        ⏭
      </Button>

      <span className="font-mono text-xs text-on-dark-soft">
        {formatTime(currentTime)}
      </span>

      <input
        type="range"
        aria-label="탐색"
        min={0}
        max={duration || 0}
        step={0.1}
        value={currentTime}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer accent-primary"
      />

      <span className="font-mono text-xs text-on-dark-soft">
        {formatTime(duration)}
      </span>

      <Button
        variant={isLooping ? 'primary' : 'secondaryOnDark'}
        size="sm"
        aria-label="구간 반복"
        aria-pressed={isLooping}
        disabled={!canLoop}
        onClick={onToggleLoop}
      >
        🔁{isLooping ? <span className="ml-1">{repeatCount}회</span> : null}
      </Button>
    </div>
  );
}
