import React from 'react';

export interface AudioWaveformProps {
  waveform: number[];
  currentTime: number;
  segmentStart: number;
  segmentEnd: number;
  onSeek: (time: number) => void;
}

export default function AudioWaveform({
  waveform,
  currentTime,
  segmentStart,
  segmentEnd,
  onSeek,
}: AudioWaveformProps) {
  const duration = segmentEnd - segmentStart;
  const progress = duration > 0 ? (currentTime - segmentStart) / duration : 0;
  const clampedProgress = Math.max(0, Math.min(1, progress));

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    onSeek(segmentStart + ratio * duration);
  };

  // 파형 데이터가 없거나 유효하지 않으면 flat bar 표시
  const displayWaveform =
    waveform.length > 0 ? waveform : new Array(100).fill(0.1);

  return (
    <div
      role="slider"
      aria-label="오디오 파형"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clampedProgress * 100)}
      className="w-full h-12 flex items-end justify-between gap-[1px] cursor-pointer"
      onClick={handleClick}
    >
      {displayWaveform.map((val, idx) => {
        const barRatio = idx / displayWaveform.length;
        const isPast = barRatio <= clampedProgress;
        const height = Math.max(10, val * 100); // 최소 10% 높이

        return (
          <div
            key={idx}
            role="presentation"
            className={`flex-1 rounded-t-sm transition-colors duration-150 ${
              isPast ? 'bg-primary' : 'bg-surface-dark-soft'
            }`}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}
