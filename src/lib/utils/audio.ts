/** 세그먼트/구간 경계에서 다음 세그먼트로 새는 것을 막기 위한 back-off(초). */
export const BOUNDARY_PARK_BACKOFF_SEC = 0.05;

/** 재생 속도 프리셋(0.5~2.0x). */
export const PLAYBACK_RATE_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const DEFAULT_PLAYBACK_RATE = 1;
const MIN_PLAYBACK_RATE = 0.5;
const MAX_PLAYBACK_RATE = 2;

export interface AudioManager {
  play(): void;
  pause(): void;
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(time: number): void;
  playSegment(start: number, end: number): void;
  setPlaybackRate(rate: number): void;
  onTimeUpdate(cb: (currentTime: number) => void): () => void;
  onEnded(cb: () => void): () => void;
  destroy(): void;
}

/**
 * HTMLAudioElement 래퍼. element 미주입 시 new Audio(src) 생성(테스트는 fake 주입).
 */
export function createAudioManager(
  src: string,
  element?: HTMLAudioElement,
): AudioManager {
  const el = element ?? new Audio(src);
  if (element) {
    el.src = src;
  }
  const offs: Array<() => void> = [];
  let segmentWatcherOff: (() => void) | null = null;

  return {
    play() {
      void el.play();
    },
    pause() {
      el.pause();
    },
    getCurrentTime() {
      return el.currentTime;
    },
    getDuration() {
      return el.duration;
    },
    seekTo(time) {
      el.currentTime = time;
    },
    setPlaybackRate(rate) {
      el.playbackRate = Math.min(
        MAX_PLAYBACK_RATE,
        Math.max(MIN_PLAYBACK_RATE, rate),
      );
    },
    playSegment(start, end) {
      // 이전 구간 watcher가 남아 다음 구간 재생에 간섭하지 않도록 먼저 해제
      if (segmentWatcherOff) {
        segmentWatcherOff();
        segmentWatcherOff = null;
      }
      const parkAt = Math.max(start, end - BOUNDARY_PARK_BACKOFF_SEC);
      el.currentTime = start;
      const watcher = () => {
        if (el.currentTime >= parkAt) {
          el.pause();
          el.currentTime = parkAt;
          off();
        }
      };
      const off = () => {
        el.removeEventListener('timeupdate', watcher);
        if (segmentWatcherOff === off) {
          segmentWatcherOff = null;
        }
      };
      el.addEventListener('timeupdate', watcher);
      segmentWatcherOff = off;
      offs.push(off);
      void el.play();
    },
    onTimeUpdate(cb) {
      const handler = () => cb(el.currentTime);
      el.addEventListener('timeupdate', handler);
      const off = () => el.removeEventListener('timeupdate', handler);
      offs.push(off);
      return off;
    },
    onEnded(cb) {
      const handler = () => cb();
      el.addEventListener('ended', handler);
      const off = () => el.removeEventListener('ended', handler);
      offs.push(off);
      return off;
    },
    destroy() {
      el.pause();
      offs.forEach((o) => o());
      offs.length = 0;
    },
  };
}
