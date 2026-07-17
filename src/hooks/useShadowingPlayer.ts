import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createAudioManager,
  BOUNDARY_PARK_BACKOFF_SEC,
  DEFAULT_PLAYBACK_RATE,
  type AudioManager,
} from '@/lib/utils/audio';
import { buildAudioUrl } from '@/lib/utils/audio-url';
import type { Segment } from '@/lib/types';

const EMPTY_TARGET_NOTICE = '선택한 화자의 대사가 없어 필터를 해제했어요.';

// 세그먼트에서 화자 키를 등장 순서대로 중복 없이 추출(멀티 팟캐스트: 임의 화자 허용).
function distinctSpeakers(segments: Segment[]): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const seg of segments) {
    if (!seen.has(seg.speaker)) {
      seen.add(seg.speaker);
      list.push(seg.speaker);
    }
  }
  return list;
}

// 세그먼트 탐색 대상 시각: 실제 첫 발화 단어(audioStart)가 있으면 그것, 없으면 경계(start).
// 경계는 보간값이라 실제 첫 단어보다 이를 수 있어(이전 단어 꼬리), 직접 탐색엔 audioStart를 쓴다.
function segmentSeekTime(seg: Segment): number {
  return seg.audioStart ?? seg.start;
}

export interface Selection {
  start: number;
  end: number;
}

export type PlayerMode = 'list' | 'focus';

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
  playbackRate: number;
  enabledSpeakers: string[];
  presentSpeakers: string[];
  isSpeakerFilterActive: boolean;
  filterNotice: string | null;
  mode: PlayerMode;
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
  setPlaybackRate(rate: number): void;
  toggleSpeaker(speaker: string): void;
  dismissFilterNotice(): void;
  toggleMode(): void;
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
  const rateRef = useRef(DEFAULT_PLAYBACK_RATE);
  const presentSpeakers = useMemo(() => distinctSpeakers(segments), [segments]);
  const enabledSpeakersRef = useRef<string[]>(presentSpeakers);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(DEFAULT_PLAYBACK_RATE);
  const [enabledSpeakers, setEnabledSpeakers] =
    useState<string[]>(presentSpeakers);
  const [filterNotice, setFilterNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<PlayerMode>('list');

  const isSpeakerFilterActive = useMemo(
    () => presentSpeakers.some((s) => !enabledSpeakers.includes(s)),
    [presentSpeakers, enabledSpeakers],
  );

  // 콜백에서 최신 segments를 참조하기 위한 ref (effect 재구독 방지)
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;

  const applyIndex = useCallback((i: number) => {
    indexRef.current = i;
    setCurrentSegmentIndex(i);
  }, []);

  useEffect(() => {
    const manager = createAudioManager(buildAudioUrl(episodeId));
    managerRef.current = manager;
    // 에피소드 전환/재마운트 시에도 선택한 속도를 유지
    manager.setPlaybackRate(rateRef.current);

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
      const segs = segmentsRef.current;
      const idx = computeSegmentIndex(segs, t);
      // 화자 필터: 재생 중 비대상 세그먼트 진입 시 다음 대상으로 스킵, 없으면 정지 (AC1)
      // A-B 루프 중에는 루프 범위가 우선이므로 필터 스킵을 억제한다.
      if (isPlayingRef.current && !loopingRef.current && idx >= 0) {
        const enabled = enabledSpeakersRef.current;
        const seg = segs[idx];
        if (seg && !enabled.includes(seg.speaker)) {
          const nextIdx = segs.findIndex(
            (s, i) => i > idx && enabled.includes(s.speaker),
          );
          if (nextIdx >= 0) {
            manager.seekTo(segs[nextIdx].start);
            setCurrentTime(segs[nextIdx].start);
            applyIndex(nextIdx);
          } else {
            manager.pause();
            isPlayingRef.current = false;
            setIsPlaying(false);
            applyIndex(idx);
          }
          return;
        }
      }
      applyIndex(idx);
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

  // 집중모드에선 selection을 현재 문장과 동기화한다. 집중모드 이동(다음 세그먼트·연속재생)은
  // currentSegmentIndex만 갱신하므로, 이 동기화가 없으면 구간반복이 전체모드에서 마지막으로
  // 클릭한(오래된) 문장을 반복한다. 전체모드에선 사용자의 수동 선택을 보존한다.
  useEffect(() => {
    if (mode !== 'focus' || currentSegmentIndex < 0) return;
    const cur = selectionRef.current;
    if (
      cur &&
      cur.start === currentSegmentIndex &&
      cur.end === currentSegmentIndex
    )
      return;
    const sel = { start: currentSegmentIndex, end: currentSegmentIndex };
    selectionRef.current = sel;
    setSelection(sel);
  }, [mode, currentSegmentIndex]);

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
    seekTo(segmentSeekTime(segs[Math.max(target, 0)]));
  }, [seekTo]);

  const prev = useCallback(() => {
    const segs = segmentsRef.current;
    if (segs.length === 0) return;
    const target = Math.max(indexRef.current - 1, 0);
    seekTo(segmentSeekTime(segs[target]));
  }, [seekTo]);

  const goToSegment = useCallback(
    (index: number) => {
      const segs = segmentsRef.current;
      if (index < 0 || index >= segs.length) return;
      seekTo(segmentSeekTime(segs[index]));
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

  const setPlaybackRate = useCallback((rate: number) => {
    rateRef.current = rate;
    managerRef.current?.setPlaybackRate(rate);
    setPlaybackRateState(rate);
  }, []);

  const toggleSpeaker = useCallback(
    (speaker: string) => {
      const current = enabledSpeakersRef.current;
      const next = current.includes(speaker)
        ? current.filter((s) => s !== speaker)
        : [...current, speaker];
      // 존재 화자 중 대상이 0개면 전체(등장 화자) 복원 + 안내 (AC3)
      const hasTarget = segmentsRef.current.some((seg) =>
        next.includes(seg.speaker),
      );
      if (!hasTarget) {
        enabledSpeakersRef.current = presentSpeakers;
        setEnabledSpeakers(presentSpeakers);
        setFilterNotice(EMPTY_TARGET_NOTICE);
        return;
      }
      enabledSpeakersRef.current = next;
      setEnabledSpeakers(next);
      setFilterNotice(null);
    },
    [presentSpeakers],
  );

  const dismissFilterNotice = useCallback(() => setFilterNotice(null), []);

  const toggleMode = useCallback(
    () => setMode((m) => (m === 'list' ? 'focus' : 'list')),
    [],
  );

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
    playbackRate,
    enabledSpeakers,
    presentSpeakers,
    isSpeakerFilterActive,
    filterNotice,
    mode,
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
    setPlaybackRate,
    toggleSpeaker,
    dismissFilterNotice,
    toggleMode,
  };
}
