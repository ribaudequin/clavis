import React, { useEffect, useRef, RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[contenteditable="true"]',
  'audio[controls]',
  'video[controls]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface UseFocusTrapOptions {
  isActive?: boolean;
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  options: UseFocusTrapOptions = {}
): void {
  const { isActive = true } = options;
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (previouslyFocused.current && document.body.contains(previouslyFocused.current)) {
        previouslyFocused.current.focus();
      }
      previouslyFocused.current = null;
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      const root = containerRef.current;
      if (!root) return;

      const focusable = root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const index = Array.from(focusable).indexOf(document.activeElement as HTMLElement);

      if (e.shiftKey) {
        if (index === -1 || index === 0) {
          e.preventDefault();
          last.focus();
        }
      } else if (index === -1 || index === focusable.length - 1) {
        e.preventDefault();
        first.focus();
      }
    }

    // UX-01 — Bind to the document, not the container. A click on the backdrop moves focus to
    // <body>, and a keydown that starts there bubbles to the document and never reaches an
    // overlay descendant, so a container-bound handler would let Tab walk into the UI behind
    // the scrim. With the listener here, `index === -1` (focus outside) is already handled.
    document.addEventListener('keydown', handleTab);

    return () => {
      document.removeEventListener('keydown', handleTab);
      if (previouslyFocused.current && document.body.contains(previouslyFocused.current)) {
        previouslyFocused.current.focus();
      }
      previouslyFocused.current = null;
    };
  }, [containerRef, isActive]);
}
