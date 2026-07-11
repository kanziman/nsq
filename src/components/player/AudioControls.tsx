'use client';

import { Play, Pause, SkipBack, SkipForward, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/utils/time';
import SpeedSlider from './SpeedSlider';

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
  playbackRate: number;
  onSetPlaybackRate: (rate: number) => void;
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
  playbackRate,
  onSetPlaybackRate,
}: AudioControlsProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-[24px]">
      {/* 1단: 재생 타임라인 슬라이더 및 타임코드 */}
      <div className="flex items-center gap-[12px]">
        <span className="font-mono text-xs text-on-dark-soft min-w-[36px] text-right">
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
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-surface-dark-soft accent-primary [&::-webkit-slider-runnable-track]:bg-surface-dark-soft [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
        />
        <span className="font-mono text-xs text-on-dark-soft min-w-[36px]">
          {formatTime(duration)}
        </span>
      </div>

      {/* 2단: 플레이어 제어 버튼부 (xxl: 48px 이상의 물리 여백 리듬감 확보를 위해 mt-md 추가) */}
      <div className="flex flex-wrap items-center justify-between gap-[16px] mt-[12px]">
        {/* 좌측: 이전 / 재생-일시정지 / 다음 */}
        <div className="flex items-center gap-[12px]">
          <Button
            variant="secondaryOnDark"
            size="icon"
            aria-label="이전 세그먼트"
            onClick={onPrev}
          >
            <SkipBack className="h-4 w-4 text-on-dark" strokeWidth={1.5} />
          </Button>
          <Button
            variant="primary"
            size="icon"
            className="rounded-full h-10 w-10 flex items-center justify-center"
            aria-label={isPlaying ? '일시정지' : '재생'}
            onClick={onToggle}
          >
            {isPlaying ? (
              <Pause
                className="h-5 w-5 text-primary-foreground"
                strokeWidth={1.5}
              />
            ) : (
              <Play
                className="h-5 w-5 text-primary-foreground"
                strokeWidth={1.5}
              />
            )}
          </Button>
          <Button
            variant="secondaryOnDark"
            size="icon"
            aria-label="다음 세그먼트"
            onClick={onNext}
          >
            <SkipForward className="h-4 w-4 text-on-dark" strokeWidth={1.5} />
          </Button>
        </div>

        {/* 우측: 구간반복 제어 및 배속 조절 */}
        <div className="flex items-center gap-[16px]">
          <Button
            variant={isLooping ? 'primary' : 'secondaryOnDark'}
            size="sm"
            aria-label="구간 반복"
            aria-pressed={isLooping}
            disabled={!canLoop}
            onClick={onToggleLoop}
            className="flex items-center gap-[8px]"
          >
            <Repeat className="h-4 w-4" strokeWidth={1.5} />
            {isLooping ? (
              <span className="text-xs">{repeatCount}회 반복 중</span>
            ) : (
              <span className="text-xs">구간 반복</span>
            )}
          </Button>

          <SpeedSlider
            playbackRate={playbackRate}
            onSetPlaybackRate={onSetPlaybackRate}
          />
        </div>
      </div>
    </div>
  );
}
