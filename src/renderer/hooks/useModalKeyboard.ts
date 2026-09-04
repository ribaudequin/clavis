import React, { useEffect, useRef, RefObject } from 'react';

interface UseModalKeyboardOptions {
  onEscape?: () => void;
  onEnter?: () => void;
}

export function useModalKeyboard(
  containerRef: RefObject<HTMLElement>,
  options: UseModalKeyboardOptions = {}
): void {
  const { onEscape, onEnter } = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
      }
      if (e.key === 'Enter' && onEnter) {
        e.preventDefault();
        onEnter();
      }
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, onEscape, onEnter]);
}
