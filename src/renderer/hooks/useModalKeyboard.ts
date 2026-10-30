import { useEffect, RefObject } from 'react';

interface UseModalKeyboardOptions {
  onEscape?: () => void;
}

export function useModalKeyboard(
  containerRef: RefObject<HTMLElement | null>,
  options: UseModalKeyboardOptions = {}
): void {
  const { onEscape } = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, onEscape]);
}
