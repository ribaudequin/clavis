// @vitest-environment jsdom
// The real useFocusTrap and useModalKeyboard run here: this file covers what
// DeleteConfirmModal itself owns. Escape dispatching is already pinned by
// tests/escapeSingleInvocation.test.tsx and the hooks have their own files, so
// nothing about key handling is re-asserted below.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import DeleteConfirmModal from '../src/renderer/components/DeleteConfirmModal';
import { t } from '../src/i18n';
import { toast } from 'react-hot-toast';

// react-hot-toast dispatches to a module store, so it emits fine with no
// Toaster mounted; mocking it keeps the assertion container-neutral and leaves
// the rendered DOM the sole owner of the queries below.
vi.mock('react-hot-toast');

const CANCEL = /^(cancel|cancelar)$/i;
const DELETE = /^(delete|eliminar)$/i;
const DELETING = /deleting\.*|a eliminar/i;

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason: unknown) => void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function settle(action: () => void): Promise<void> {
  await act(async () => {
    action();
    await Promise.resolve();
  });
}

function renderModal(props: Partial<React.ComponentProps<typeof DeleteConfirmModal>> = {}):
  ReturnType<typeof render> {
  return render(
    <DeleteConfirmModal
      onConfirm={() => {}}
      onCancel={() => {}}
      {...props}
    />
  );
}

afterEach(() => cleanup());

describe('DeleteConfirmModal actions', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it('invokes onConfirm when the delete action is clicked', () => {
    const onConfirm = vi.fn();
    renderModal({ onConfirm });

    fireEvent.click(screen.getByRole('button', { name: DELETE }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('invokes onCancel when the cancel action is clicked', () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });

    fireEvent.click(screen.getByRole('button', { name: CANCEL }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('locks both actions and swaps the delete label while onConfirm is pending', async () => {
    const pending = deferred();
    renderModal({ onConfirm: () => pending.promise });

    fireEvent.click(screen.getByRole('button', { name: DELETE }));

    const busy = screen.getByRole('button', { name: DELETING }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect((screen.getByRole('button', { name: CANCEL }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: DELETE })).toBeNull();

    await settle(() => pending.resolve());
  });

  it('does not invoke onConfirm a second time while the first call is still pending', async () => {
    const pending = deferred();
    const onConfirm = vi.fn(() => pending.promise);
    renderModal({ onConfirm });

    fireEvent.click(screen.getByRole('button', { name: DELETE }));
    fireEvent.click(screen.getByRole('button', { name: DELETING }));

    // What makes this hold is the disabled attribute: React resolves no onClick
    // for a disabled button, so the second click never reaches handleConfirm.
    // handleConfirm's own `if (isConfirming) return` cannot be isolated through
    // the DOM — every state where it would fire is also a state where the
    // button is disabled — so this test pins the behaviour, not that line.
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await settle(() => pending.resolve());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('returns to the resting state once onConfirm resolves', async () => {
    const pending = deferred();
    renderModal({ onConfirm: () => pending.promise });

    fireEvent.click(screen.getByRole('button', { name: DELETE }));
    expect(screen.getByRole('button', { name: DELETING })).toBeTruthy();

    await settle(() => pending.resolve());

    const cancel = screen.getByRole('button', { name: CANCEL }) as HTMLButtonElement;
    const confirm = screen.getByRole('button', { name: DELETE }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(false);
    expect(confirm.disabled).toBe(false);
    expect(screen.queryByRole('button', { name: DELETING })).toBeNull();
  });

  it('swallows a rejection from onConfirm and surfaces it as a toast rather than letting it escape', async () => {
    const escaped: unknown[] = [];
    const capture = (reason: unknown): void => {
      escaped.push(reason);
    };
    // handleConfirm's catch is what stops the rejection: without it the promise
    // leaves the component as an unhandled rejection. Vitest suppresses its own
    // unhandled-error report once user code registers a listener, which is what
    // lets the escape — or its absence — be asserted below instead of being
    // silently tolerated.
    process.on('unhandledRejection', capture);

    try {
      const pending = deferred();
      renderModal({ onConfirm: () => pending.promise });

      fireEvent.click(screen.getByRole('button', { name: DELETE }));
      expect(screen.getByRole('button', { name: DELETING })).toBeTruthy();

      await settle(() => pending.reject(new Error('delete failed')));
      await new Promise((resolve) => setTimeout(resolve, 0));

      const cancel = screen.getByRole('button', { name: CANCEL }) as HTMLButtonElement;
      const confirm = screen.getByRole('button', { name: DELETE }) as HTMLButtonElement;
      expect(cancel.disabled).toBe(false);
      expect(confirm.disabled).toBe(false);
      expect(screen.queryByRole('button', { name: DELETING })).toBeNull();

      expect(escaped).toHaveLength(0);
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(t('msg.error_delete_failed'));
      // msg.error_delete is a prefix ("Error deleting:") whose detail the callers already
      // surface, so this modal needs a complete sentence — a toast reading "Error deleting:"
      // with nothing after the colon is the defect this key was added to avoid.
      expect(t('msg.error_delete_failed')).not.toMatch(/[:：]\s*$/);
    } finally {
      process.off('unhandledRejection', capture);
    }
  });

  it('restores the resting state only through the finally block, not through the success path', async () => {
    const onConfirm = vi.fn(() => Promise.reject(new Error('delete failed')));
    const capture = (): void => {};
    process.on('unhandledRejection', capture);

    try {
      renderModal({ onConfirm });
      fireEvent.click(screen.getByRole('button', { name: DELETE }));
      await settle(() => {});
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(screen.getByRole('button', { name: DELETE })).toBeTruthy();
      expect(screen.getByRole('button', { name: DELETE })).toBeEnabled();
    } finally {
      process.off('unhandledRejection', capture);
    }
  });
});

describe('DeleteConfirmModal accessibility contract', () => {
  it('labels the dialog through aria-labelledby and resolves to the visible heading', () => {
    renderModal({ drawerTitle: 'Banco Central' });
    const dialog = screen.getByRole('dialog');

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('delete-confirm-title');

    const titleId = dialog.getAttribute('aria-labelledby');
    const title = titleId === null ? null : document.getElementById(titleId);
    expect(title).not.toBeNull();
    expect(title?.tagName).toBe('H2');
    expect(title?.textContent).toBe(t('btn.delete'));
    expect(dialog).toHaveAccessibleName(t('btn.delete'));
  });

  it('describes the dialog through aria-describedby and resolves to the irreversible warning', () => {
    renderModal({ drawerTitle: 'Banco Central' });
    const dialog = screen.getByRole('dialog');

    expect(dialog.getAttribute('aria-describedby')).toBe('delete-confirm-desc');

    const descId = dialog.getAttribute('aria-describedby');
    const description = descId === null ? null : document.getElementById(descId);
    expect(description).not.toBeNull();
    expect(description?.tagName).toBe('P');
    expect(description?.textContent).toBe(t('msg.irreversible'));
    expect(dialog).toHaveAccessibleDescription(t('msg.irreversible'));
  });

  it('points aria-describedby at the warning rather than the drawer title', () => {
    renderModal({ drawerTitle: 'Banco Central' });
    const desc = document.getElementById('delete-confirm-desc');

    expect(desc?.textContent).not.toContain('Banco Central');
  });

  it('renders the danger icon without giving it an accessible name', () => {
    const { container } = renderModal();
    const icon = container.querySelector('svg');

    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).not.toHaveAccessibleName();
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelectorAll('svg title')).toHaveLength(0);
  });

  it('focuses the safe action on mount instead of the destructive one', () => {
    renderModal();

    const cancel = screen.getByRole('button', { name: CANCEL });
    expect(document.activeElement).toBe(cancel);
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: DELETE }));
  });
});

describe('DeleteConfirmModal drawer title', () => {
  it('renders the drawer title in quotes when one is given', () => {
    renderModal({ drawerTitle: 'Banco Central' });

    expect(screen.getByText('"Banco Central"')).toBeTruthy();
  });

  it('omits the drawer title paragraph entirely when none is given', () => {
    const { container } = renderModal();

    expect(screen.queryByText('"Banco Central"')).toBeNull();
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(document.getElementById('delete-confirm-desc')).not.toBeNull();
  });

  it('takes the warning text straight from the catalogue, so the inert || fallback can never take over', () => {
    renderModal();

    // The P3.27 pattern was `t('msg.irreversible') || 'This action is
    // irreversible.'` — t() returns the key itself for a missing key, never an
    // empty string, so that right-hand side was unreachable. DeleteConfirmModal
    // no longer carries the fallback; pinning the rendered text to the
    // catalogue is what shows a reintroduced one would still change nothing.
    expect(t('msg.irreversible')).not.toBe('');
    expect(t('msg.irreversible')).not.toBe('msg.irreversible');
    expect(document.getElementById('delete-confirm-desc')?.textContent).toBe(t('msg.irreversible'));
  });
});