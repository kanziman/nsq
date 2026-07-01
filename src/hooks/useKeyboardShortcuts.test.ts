// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useKeyboardShortcuts,
  type KeyboardShortcutHandlers,
} from './useKeyboardShortcuts';

function makeHandlers(): KeyboardShortcutHandlers {
  return {
    onTogglePlay: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onToggleLoop: vi.fn(),
    onSpeedUp: vi.fn(),
    onSpeedDown: vi.fn(),
  };
}

function press(key: string, target: EventTarget = window): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(ev);
  return ev;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useKeyboardShortcuts', () => {
  it('[정상] Space should call onTogglePlay and preventDefault (AC1)', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    const ev = press(' ');
    expect(h.onTogglePlay).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('[정상] ArrowLeft/ArrowRight should call onPrev/onNext (AC2)', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    press('ArrowLeft');
    press('ArrowRight');
    expect(h.onPrev).toHaveBeenCalledTimes(1);
    expect(h.onNext).toHaveBeenCalledTimes(1);
  });

  it('[정상] r/R should call onToggleLoop (AC2)', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    press('r');
    press('R');
    expect(h.onToggleLoop).toHaveBeenCalledTimes(2);
  });

  it('[정상] +/=/- should call onSpeedUp/onSpeedDown (AC2)', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    press('+');
    press('=');
    press('-');
    expect(h.onSpeedUp).toHaveBeenCalledTimes(2);
    expect(h.onSpeedDown).toHaveBeenCalledTimes(1);
  });

  it('[예외] key inside an input should be ignored (AC3)', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    const input = document.createElement('input');
    document.body.appendChild(input);
    press(' ', input);
    expect(h.onTogglePlay).not.toHaveBeenCalled();
  });

  it('[예외] key inside a textarea should be ignored (AC3)', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    press('r', ta);
    expect(h.onToggleLoop).not.toHaveBeenCalled();
  });

  it('[예외] key inside a select should be ignored (AC3)', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    const select = document.createElement('select');
    document.body.appendChild(select);
    press('ArrowRight', select);
    expect(h.onNext).not.toHaveBeenCalled();
  });

  it('[예외] key inside a contenteditable should be ignored (AC3)', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    document.body.appendChild(div);
    press(' ', div);
    expect(h.onTogglePlay).not.toHaveBeenCalled();
  });

  it('[경계] unmapped key should call nothing', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    press('a');
    Object.values(h).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it('[경계] enabled=false should not attach the listener', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h, { enabled: false }));
    press(' ');
    expect(h.onTogglePlay).not.toHaveBeenCalled();
  });

  it('[경계] should detach the listener on unmount', () => {
    const h = makeHandlers();
    const { unmount } = renderHook(() => useKeyboardShortcuts(h));
    unmount();
    press(' ');
    expect(h.onTogglePlay).not.toHaveBeenCalled();
  });
});
