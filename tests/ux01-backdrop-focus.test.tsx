// UX-01 — the backdrop is a full-screen overlay. Clicking it blurs the focused control and
// leaves focus on <body>; a listener bound to the overlay would never see the next keydown,
// so Escape and Tab both stopped working. Both hooks now listen on the document. These tests
// drive the real hooks against the real modal — mocking them would test a different program.
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import PasswordModal from '../src/renderer/components/PasswordModal';

const DRAWER_ID = '123e4567-e89b-12d3-a456-426614174000';

beforeEach(() => {
  window.electronAPI = {
    getUnlockDelay: async (): Promise<number> => 0,
  } as unknown as Window['electronAPI'];
});

afterEach(() => cleanup());

function renderModal(onClose: () => void = () => {}): void {
  render(
    <PasswordModal
      drawerId={DRAWER_ID}
      drawerTitle="Corrida"
      onClose={onClose}
      onSubmit={async () => {}}
      error={null}
    />
  );
}

/** Simulates the backdrop click: focus is on <body>, not inside the dialog. */
function blurToBody(): void {
  (document.activeElement as HTMLElement | null)?.blur();
  expect(document.activeElement).toBe(document.body);
}

describe('UX-01 — a backdrop click must not defeat the dialog keyboard contract', () => {
  it('closes on Escape when focus is on <body>', () => {
    const onClose = vi.fn();
    renderModal(onClose);
    blurToBody();

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pulls focus back into the dialog on Tab when focus is on <body>', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    blurToBody();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('pulls focus to the last control on Shift+Tab when focus is on <body>', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    blurToBody();

    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
