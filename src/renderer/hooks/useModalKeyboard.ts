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
        const target = e.target as HTMLElement;
        const tag = target.tagName.toLowerCase();
        const isTextArea = tag === 'textarea';
        const isContentEditable = target.getAttribute('contenteditable') === 'true';
        if (!isTextArea && !isContentEditable) {
          e.preventDefault();
          onEnter();
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, onEscape, onEnter]);
}
