import { describe, it, expect, vi } from 'vitest';
import { createAudioManager, BOUNDARY_PARK_BACKOFF_SEC } from './audio';

// 최소 HTMLAudioElement 페이크 (DI 주입용)
function makeFakeElement() {
  const listeners: Record<string, Array<(e?: unknown) => void>> = {};
  return {
    currentTime: 0,
    play: vi.fn(),
    pause: vi.fn(),
    src: '',
    addEventListener: vi.fn((type: string, cb: () => void) => {
      (listeners[type] ??= []).push(cb);
    }),
    removeEventListener: vi.fn((type: string, cb: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter((f) => f !== cb);
    }),
    emit(type: string) {
      (listeners[type] ?? []).forEach((f) => f());
    },
    _listeners: listeners,
  };
}

describe('createAudioManager', () => {
  it('[정상] should delegate play()/pause() to the element', () => {
    const el = makeFakeElement();
    const m = createAudioManager('/audio', el as unknown as HTMLAudioElement);
    m.play();
    m.pause();
    expect(el.play).toHaveBeenCalledTimes(1);
    expect(el.pause).toHaveBeenCalledTimes(1);
  });

  it('[정상] onTimeUpdate should invoke cb with currentTime on timeupdate', () => {
    const el = makeFakeElement();
    const m = createAudioManager('/audio', el as unknown as HTMLAudioElement);
    const cb = vi.fn();
    m.onTimeUpdate(cb);
    el.currentTime = 12.5;
    el.emit('timeupdate');
    expect(cb).toHaveBeenCalledWith(12.5);
  });

  it('[정상] onEnded should invoke cb on ended', () => {
    const el = makeFakeElement();
    const m = createAudioManager('/audio', el as unknown as HTMLAudioElement);
    const cb = vi.fn();
    m.onEnded(cb);
    el.emit('ended');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('[정상] getCurrentTime should return element.currentTime', () => {
    const el = makeFakeElement();
    el.currentTime = 7;
    const m = createAudioManager('/audio', el as unknown as HTMLAudioElement);
    expect(m.getCurrentTime()).toBe(7);
  });

  it('[경계] unsubscribe should remove the timeupdate listener', () => {
    const el = makeFakeElement();
    const m = createAudioManager('/audio', el as unknown as HTMLAudioElement);
    const cb = vi.fn();
    const off = m.onTimeUpdate(cb);
    off();
    el.emit('timeupdate');
    expect(cb).not.toHaveBeenCalled();
  });

  it('[정상] seekTo should set element.currentTime', () => {
    const el = makeFakeElement();
    const m = createAudioManager('/audio', el as unknown as HTMLAudioElement);
    m.seekTo(42);
    expect(el.currentTime).toBe(42);
  });

  it('[정상] getDuration should return element.duration', () => {
    const el = makeFakeElement();
    (el as unknown as { duration: number }).duration = 300;
    const m = createAudioManager('/audio', el as unknown as HTMLAudioElement);
    expect(m.getDuration()).toBe(300);
  });

  it('[정상] playSegment should seek to start and play', () => {
    const el = makeFakeElement();
    const m = createAudioManager('/audio', el as unknown as HTMLAudioElement);
    m.playSegment(2, 5);
    expect(el.currentTime).toBe(2);
    expect(el.play).toHaveBeenCalled();
  });

  it('[정상] playSegment should pause and park at end - BACKOFF on boundary', () => {
    const el = makeFakeElement();
    const m = createAudioManager('/audio', el as unknown as HTMLAudioElement);
    m.playSegment(0, 5);
    el.currentTime = 4.96;
    el.emit('timeupdate');
    expect(el.pause).toHaveBeenCalled();
    expect(el.currentTime).toBeCloseTo(5 - BOUNDARY_PARK_BACKOFF_SEC, 5);
  });

  it('[경계] playSegment should not bleed into next when end === next.start', () => {
    const el = makeFakeElement();
    const m = createAudioManager('/audio', el as unknown as HTMLAudioElement);
    m.playSegment(0, 5); // 다음 세그먼트 start=5
    el.currentTime = 5.0;
    el.emit('timeupdate');
    expect(el.currentTime).toBeLessThan(5);
  });

  it('[경계] consecutive playSegment should deactivate the previous watcher', () => {
    const el = makeFakeElement();
    const m = createAudioManager('/audio', el as unknown as HTMLAudioElement);
    m.playSegment(0, 5); // parkAt 4.95
    m.playSegment(10, 15); // 새 구간, 이전 watcher 해제되어야
    el.pause.mockClear();
    el.currentTime = 4.95; // 첫 구간 park 지점 — 이전 watcher가 살아있으면 pause됨
    el.emit('timeupdate');
    expect(el.pause).not.toHaveBeenCalled();
  });

  it('[정상] destroy should pause and detach listeners', () => {
    const el = makeFakeElement();
    const m = createAudioManager('/audio', el as unknown as HTMLAudioElement);
    const cb = vi.fn();
    m.onTimeUpdate(cb);
    m.destroy();
    el.emit('timeupdate');
    expect(el.pause).toHaveBeenCalled();
    expect(cb).not.toHaveBeenCalled();
  });
});
