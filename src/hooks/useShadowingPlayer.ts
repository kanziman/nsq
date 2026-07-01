import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createAudioManager,
  BOUNDARY_PARK_BACKOFF_SEC,
  type AudioManager,
} from '@/lib/utils/audio';
import type { Segment } from '@/lib/types';

export interface Selection {
  start: number;
  end: number;
}

export interface UseShadowingPlayerArgs {
  episodeId: string;
  segments: Segment[];
}
export interface UseShadowingPlayerResult {
  isPlaying: boolean;
  currentSegmentIndex: number;
  currentTime: number;
  selection: Selection | null;
  isLooping: boolean;
  repeatCount: number;
  play(): void;
  pause(): void;
  toggle(): void;
  seekTo(time: number): void;
  next(): void;
  prev(): void;
  goToSegment(index: number): void;
  selectSegment(index: number): void;
  extendSelectionTo(index: number): void;
  toggleLoop(): void;
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
  const indexRef = useRef(-1);
  const selectionRef = useRef<Selection | null>(null);
  const loopingRef = useRef(false);
  const anchorRef = useRef(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);

  // 콜백에서 최신 segments를 참조하기 위한 ref (effect 재구독 방지)
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const applyIndex = useCallback((i: number) => {
    indexRef.current = i;
    setCurrentSegmentIndex(i);
  }, []);

  useEffect(() => {
    const manager = createAudioManager(`/api/episodes/${episodeId}/audio`);
    managerRef.current = manager;

    const offTime = manager.onTimeUpdate((t) => {
      setCurrentTime(t);
      // A-B 구간 반복: 선택 범위 끝 도달 시 범위 처음으로 되돌리고 카운트 증가
      const sel = selectionRef.current;
      if (loopingRef.current && sel) {
        const segs = segmentsRef.current;
        const endT = segs[sel.end]?.end ?? 0;
        const startT = segs[sel.start]?.start ?? 0;
        if (t >= endT - BOUNDARY_PARK_BACKOFF_SEC) {
          manager.seekTo(startT);
          setCurrentTime(startT);
          applyIndex(sel.start);
          setRepeatCount((c) => c + 1);
          return;
        }
      }
      applyIndex(computeSegmentIndex(segmentsRef.current, t));
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
  }, [episodeId, applyIndex]);

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

  const seekTo = useCallback(
    (time: number) => {
      managerRef.current?.seekTo(time);
      setCurrentTime(time);
      applyIndex(computeSegmentIndex(segmentsRef.current, time));
    },
    [applyIndex],
  );

  const next = useCallback(() => {
    const segs = segmentsRef.current;
    if (segs.length === 0) return;
    const target = Math.min(indexRef.current + 1, segs.length - 1);
    seekTo(segs[Math.max(target, 0)].start);
  }, [seekTo]);

  const prev = useCallback(() => {
    const segs = segmentsRef.current;
    if (segs.length === 0) return;
    const target = Math.max(indexRef.current - 1, 0);
    seekTo(segs[target].start);
  }, [seekTo]);

  const goToSegment = useCallback(
    (index: number) => {
      const segs = segmentsRef.current;
      if (index < 0 || index >= segs.length) return;
      seekTo(segs[index].start);
      play();
    },
    [seekTo, play],
  );

  const selectSegment = useCallback((index: number) => {
    anchorRef.current = index;
    const sel = { start: index, end: index };
    selectionRef.current = sel;
    setSelection(sel);
  }, []);

  const extendSelectionTo = useCallback((index: number) => {
    const anchor = anchorRef.current < 0 ? index : anchorRef.current;
    anchorRef.current = anchor;
    const sel = {
      start: Math.min(anchor, index),
      end: Math.max(anchor, index),
    };
    selectionRef.current = sel;
    setSelection(sel);
  }, []);

  const toggleLoop = useCallback(() => {
    const sel = selectionRef.current;
    if (!sel) return;
    const nextLooping = !loopingRef.current;
    loopingRef.current = nextLooping;
    setIsLooping(nextLooping);
    if (nextLooping) {
      setRepeatCount(0);
      seekTo(segmentsRef.current[sel.start].start);
      play();
    }
  }, [seekTo, play]);

  return {
    isPlaying,
    currentSegmentIndex,
    currentTime,
    selection,
    isLooping,
    repeatCount,
    play,
    pause,
    toggle,
    seekTo,
    next,
    prev,
    goToSegment,
    selectSegment,
    extendSelectionTo,
    toggleLoop,
  };
}
