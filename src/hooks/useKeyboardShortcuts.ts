import { useEffect, useRef } from 'react';

export interface KeyboardShortcutHandlers {
  onTogglePlay: () => void; // Space
  onPrev: () => void; // ArrowLeft
  onNext: () => void; // ArrowRight
  onToggleLoop: () => void; // R / r
  onSpeedUp: () => void; // + / =
  onSpeedDown: () => void; // -
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
}

/** 입력 요소(input/textarea/select/contenteditable)에 포커스된 상태면 단축키를 무시한다. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  const ce = target.getAttribute('contenteditable');
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable ||
    ce === '' ||
    ce === 'true'
  );
}

export function useKeyboardShortcuts(
  handlers: KeyboardShortcutHandlers,
  options: UseKeyboardShortcutsOptions = {},
): void {
  const { enabled = true } = options;
  // 최신 handlers를 참조하되 리스너 재구독은 피한다.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (isEditableTarget(e.target)) return; // AC3
      const h = handlersRef.current;
      switch (e.key) {
        case ' ':
          e.preventDefault(); // 페이지 스크롤 방지
          h.onTogglePlay();
          break;
        case 'ArrowLeft':
          h.onPrev();
          break;
        case 'ArrowRight':
          h.onNext();
          break;
        case 'r':
        case 'R':
          h.onToggleLoop();
          break;
        case '+':
        case '=':
          h.onSpeedUp();
          break;
        case '-':
          h.onSpeedDown();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
