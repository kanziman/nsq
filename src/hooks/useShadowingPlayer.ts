import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioManager, type AudioManager } from '@/lib/utils/audio';
import type { Segment } from '@/lib/types';

export interface UseShadowingPlayerArgs {
  episodeId: string;
  segments: Segment[];
}
export interface UseShadowingPlayerResult {
  isPlaying: boolean;
  currentSegmentIndex: number;
  currentTime: number;
  play(): void;
  pause(): void;
  toggle(): void;
  seekTo(time: number): void;
}

/** start <= t 인 마지막 세그먼트 인덱스. t가 첫 세그먼트 시작 이전이면 -1. */
function computeSegmentIndex(segments: Segment[], t: number): number {
  let idx = -1;
  for (let i = 0; i < segments.length; i++) {
    if (t >= segments[i].start) {
      idx = i;
    } else {
      break;
    }
  }
  return idx;
}

export function useShadowingPlayer({
  episodeId,
  segments,
}: UseShadowingPlayerArgs): UseShadowingPlayerResult {
  const managerRef = useRef<AudioManager | null>(null);
  const isPlayingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);

  // 콜백에서 최신 segments를 참조하기 위한 ref (effect 재구독 방지)
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  useEffect(() => {
    const manager = createAudioManager(`/api/episodes/${episodeId}/audio`);
    managerRef.current = manager;

    const offTime = manager.onTimeUpdate((t) => {
      setCurrentTime(t);
      setCurrentSegmentIndex(computeSegmentIndex(segmentsRef.current, t));
    });
    // 연속 재생: 세그먼트 경계에서 멈추지 않고, 오디오 종료 시에만 정지
    const offEnded = manager.onEnded(() => {
      isPlayingRef.current = false;
      setIsPlaying(false);
    });

    return () => {
      offTime();
      offEnded();
      manager.destroy();
      managerRef.current = null;
    };
  }, [episodeId]);

  const play = useCallback(() => {
    managerRef.current?.play();
    isPlayingRef.current = true;
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    managerRef.current?.pause();
    isPlayingRef.current = false;
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      play();
    }
  }, [play, pause]);

  const seekTo = useCallback((time: number) => {
    managerRef.current?.seekTo(time);
    setCurrentTime(time);
    setCurrentSegmentIndex(computeSegmentIndex(segmentsRef.current, time));
  }, []);

  return {
    isPlaying,
    currentSegmentIndex,
    currentTime,
    play,
    pause,
    toggle,
    seekTo,
  };
}
