import { describe, it, expect, vi } from 'vitest';
import { createAudioManager } from './audio';

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
