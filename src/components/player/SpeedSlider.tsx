import React from 'react';
import { Button } from '@/components/ui/button';
import { MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE } from '@/lib/utils/audio';
import { Minus, Plus } from 'lucide-react';

export interface SpeedSliderProps {
  playbackRate: number;
  onSetPlaybackRate: (rate: number) => void;
}

export default function SpeedSlider({
  playbackRate,
  onSetPlaybackRate,
}: SpeedSliderProps) {
  const step = 0.05;

  const handleDecrease = () => {
    if (playbackRate <= MIN_PLAYBACK_RATE) return;
    const newRate = Math.max(MIN_PLAYBACK_RATE, playbackRate - step);
    onSetPlaybackRate(Number(newRate.toFixed(2)));
  };

  const handleIncrease = () => {
    if (playbackRate >= MAX_PLAYBACK_RATE) return;
    const newRate = Math.min(MAX_PLAYBACK_RATE, playbackRate + step);
    onSetPlaybackRate(Number(newRate.toFixed(2)));
  };

  const handleReset = () => {
    onSetPlaybackRate(1.0);
  };

  return (
    <div className="flex items-center gap-[12px] bg-surface-dark-soft p-[8px] rounded-full">
      <Button
        variant="textLink"
        size="icon"
        className="w-6 h-6 rounded-full text-on-dark-soft hover:text-on-dark hover:bg-surface-dark-elevated no-underline hover:no-underline"
        aria-label="속도 감소"
        onClick={handleDecrease}
      >
        <Minus className="w-3.5 h-3.5" />
      </Button>
      <input
        type="range"
        aria-label="재생 속도 조절"
        min={MIN_PLAYBACK_RATE}
        max={MAX_PLAYBACK_RATE}
        step={step}
        value={playbackRate}
        onChange={(e) => onSetPlaybackRate(Number(e.target.value))}
        onDoubleClick={handleReset}
        className="h-1 w-[80px] cursor-pointer appearance-none rounded-full bg-surface-dark-elevated accent-primary [&::-webkit-slider-runnable-track]:bg-surface-dark-elevated [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
      />
      <Button
        variant="textLink"
        size="icon"
        className="w-6 h-6 rounded-full text-on-dark-soft hover:text-on-dark hover:bg-surface-dark-elevated no-underline hover:no-underline"
        aria-label="속도 증가"
        onClick={handleIncrease}
      >
        <Plus className="w-3.5 h-3.5" />
      </Button>
      <button
        onClick={handleReset}
        className="font-mono text-xs text-primary font-medium min-w-[40px] text-center hover:opacity-80"
        aria-label="현재 속도 (클릭 시 1.0배속으로 초기화)"
      >
        {playbackRate.toFixed(2)}x
      </button>
    </div>
  );
}
