import React, { useEffect, RefObject } from 'react';

interface UseFocusTrapOptions {
  isActive?: boolean;
  onEscape?: () => void;
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement>,
  options: UseFocusTrapOptions = {}
): void {
  const { isActive = true, onEscape } = options;

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusable = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
      }
    }

    container.addEventListener('keydown', handleTab);
    container.addEventListener('keydown', handleEscape);

    return () => {
      container.removeEventListener('keydown', handleTab);
      container.removeEventListener('keydown', handleEscape);
    };
  }, [containerRef, isActive, onEscape]);
}
