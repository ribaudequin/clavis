// @vitest-environment jsdom
// Hook-level coverage for useModalKeyboard. No hook is mocked: the point is the real
// addEventListener wiring on the container ref, which a mocked hook cannot exercise.
// The modal-level Escape tests in escapeSingleInvocation.test.tsx are deliberately not
// repeated here — this file owns the parts no modal can reach today, namely the null-ref
// early return, listener teardown, and the missing-callback guards.
import React, { useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, createEvent } from '@testing-library/react';

import { useModalKeyboard } from '../src/renderer/hooks/useModalKeyboard';

type ModalKeyboardOptions = Parameters<typeof useModalKeyboard>[1];

beforeEach(() => cleanup());
afterEach(() => cleanup());

interface PanelProps {
  onEscape?: () => void;
  children?: React.ReactNode;
}

function Panel({ onEscape, children }: PanelProps): React.JSX.Element {
  // useRef<HTMLDivElement> matches all five production callers, so the harness wires the
  // hook exactly as DeleteConfirmModal and friends do. The wider RefObject<HTMLElement>
  // annotation cannot be attached to a <div> without a cast.
  const containerRef = useRef<HTMLDivElement>(null);
  const options: ModalKeyboardOptions = {};
  if (onEscape) options.onEscape = onEscape;
  useModalKeyboard(containerRef, options);
  return (
    <div ref={containerRef} data-testid="panel">
      {children}
    </div>
  );
}

function UnattachedRefPanel({ onEscape }: PanelProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  useModalKeyboard(containerRef, { onEscape });
  return <div data-testid="panel" />;
}

function panel(): HTMLElement {
  return screen.getByTestId('panel');
}

// Returned so a test can assert defaultPrevented: whether the hook consumed the event is
// part of the contract, and a spy on the callback alone cannot see it.
function press(target: Element, key: string): Event {
  const event = createEvent.keyDown(target, { key });
  fireEvent(target, event);
  return event;
}

describe('useModalKeyboard — Escape', () => {
  it('invokes onEscape exactly once for an Escape on the container', () => {
    const onEscape = vi.fn();
    render(<Panel onEscape={onEscape} />);

    const event = press(panel(), 'Escape');

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('invokes onEscape once when the keypress starts on a control inside the container', () => {
    const onEscape = vi.fn();
    render(
      <Panel onEscape={onEscape}>
        <button type="button">Close</button>
      </Panel>
    );

    const event = press(screen.getByRole('button', { name: 'Close' }), 'Escape');

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('invokes onEscape twice for two presses, so the listener is not one-shot', () => {
    const onEscape = vi.fn();
    render(<Panel onEscape={onEscape} />);

    press(panel(), 'Escape');
    press(panel(), 'Escape');

    expect(onEscape).toHaveBeenCalledTimes(2);
  });

  it('consumes nothing when no onEscape was supplied', () => {
    render(<Panel />);

    const event = press(panel(), 'Escape');

    expect(event.defaultPrevented).toBe(false);
  });

  it.each(['a', 'Tab'])('invokes neither callback and consumes nothing for %s', (key) => {
    const onEscape = vi.fn();
    render(
      <Panel onEscape={onEscape}>
        <input data-testid="target" />
      </Panel>
    );

    const event = press(screen.getByTestId('target'), key);

    expect(onEscape).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('useModalKeyboard — listener lifetime', () => {
  it('detaches on unmount', () => {
    const onEscape = vi.fn();
    const { unmount } = render(<Panel onEscape={onEscape} />);
    const detached = panel();

    unmount();
    press(detached, 'Escape');

    expect(onEscape).not.toHaveBeenCalled();
  });

  it('drops the previous listener when the callback identity changes', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Panel onEscape={first} />);

    rerender(<Panel onEscape={second} />);
    press(panel(), 'Escape');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('attaches nothing and does not throw when containerRef.current is null', () => {
    const onEscape = vi.fn();

    expect(() => render(<UnattachedRefPanel onEscape={onEscape} />)).not.toThrow();
    press(panel(), 'Escape');
    press(panel(), 'Enter');

    expect(onEscape).not.toHaveBeenCalled();
  });
});