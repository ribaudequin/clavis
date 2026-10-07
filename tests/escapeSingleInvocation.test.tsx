// @vitest-environment jsdom
// Regression test: Escape used to be handled twice per keypress, once by
// useFocusTrap and once by useModalKeyboard, both attached to the same container
// ref. It stayed invisible only because every onEscape happened to be an
// idempotent setState(false). These tests therefore use NON-IDEMPOTENT handlers
// (a counter that must advance by exactly one per keypress), which is what makes
// a double fire observable. No hook is mocked: the point is the real wiring.
import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import DeleteConfirmModal from '../src/renderer/components/DeleteConfirmModal';
import DiscardChangesModal from '../src/renderer/components/DiscardChangesModal';

const CANCEL = /^(cancel|cancelar)$/i;

beforeEach(() => cleanup());
afterEach(() => cleanup());

function DeleteHarness({ onCancel }: { onCancel: () => void }): React.JSX.Element {
  const [count, setCount] = useState(0);
  return (
    <div>
      <span data-testid="count">{count}</span>
      <DeleteConfirmModal
        drawerTitle="Secrets"
        onConfirm={async () => {}}
        onCancel={() => {
          onCancel();
          setCount((previous) => previous + 1);
        }}
      />
    </div>
  );
}

function DiscardHarness({ onCancel }: { onCancel: () => void }): React.JSX.Element {
  const [count, setCount] = useState(0);
  return (
    <div>
      <span data-testid="count">{count}</span>
      <DiscardChangesModal
        onSaveAndLeave={() => {}}
        onDiscard={() => {}}
        onCancel={() => {
          onCancel();
          setCount((previous) => previous + 1);
        }}
        saving={false}
      />
    </div>
  );
}

describe('Escape invokes the modal handler exactly once per keypress', () => {
  it('advances the DeleteConfirmModal handler once for one Escape', () => {
    const onCancel = vi.fn();
    render(<DeleteHarness onCancel={onCancel} />);

    expect(screen.getByTestId('count').textContent).toBe('0');

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('advances the DiscardChangesModal handler once for one Escape', () => {
    const onCancel = vi.fn();
    render(<DiscardHarness onCancel={onCancel} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('still fires once when Escape bubbles up from a focused control inside the panel', () => {
    const onCancel = vi.fn();
    render(<DiscardHarness onCancel={onCancel} />);

    fireEvent.keyDown(screen.getByRole('button', { name: CANCEL }), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('fires exactly twice for two Escape presses', () => {
    const onCancel = vi.fn();
    render(<DeleteHarness onCancel={onCancel} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('does not fire for keys other than Escape', () => {
    const onCancel = vi.fn();
    render(<DeleteHarness onCancel={onCancel} />);

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Enter' });
    fireEvent.keyDown(dialog, { key: 'Tab' });
    fireEvent.keyDown(dialog, { key: 'a' });

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByTestId('count').textContent).toBe('0');
  });
});