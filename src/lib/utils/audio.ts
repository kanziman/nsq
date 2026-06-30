export interface AudioManager {
  play(): void;
  pause(): void;
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(time: number): void;
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
