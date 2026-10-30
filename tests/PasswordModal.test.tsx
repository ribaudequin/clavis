// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('../src/renderer/hooks/useFocusTrap', () => ({ useFocusTrap: () => {} }));
vi.mock('../src/renderer/hooks/useModalKeyboard', () => ({ useModalKeyboard: () => {} }));
import PasswordModal from '../src/renderer/components/PasswordModal';

const DRAWER_ID = '123e4567-e89b-12d3-a456-426614174000';

// The modal asks the main process how long the next attempt would wait before
// it submits (UX-08). These tests are not about the countdown, so the answer is
// "no wait" — but the bridge has to be there, exactly as it is in the app.
beforeEach(() => {
  window.electronAPI = {
    getUnlockDelay: async (): Promise<number> => 0,
  } as unknown as Window['electronAPI'];
  cleanup();
});
afterEach(() => cleanup());

describe('PasswordModal', () => {
  it('renders title and password input', () => {
    render(<PasswordModal drawerId={DRAWER_ID} drawerTitle="Test Drawer" onClose={() => {}} onSubmit={async () => {}} error={null} />);
    expect(screen.getByText('Test Drawer')).toBeTruthy();
    expect(screen.getByPlaceholderText(/password/i)).toBeTruthy();
  });

  it('calls onSubmit with password', async () => {
    const onSubmit = vi.fn(async () => {});
    render(<PasswordModal drawerId={DRAWER_ID} drawerTitle="Test" onClose={() => {}} onSubmit={onSubmit} error={null} />);
    const input = screen.getByPlaceholderText(/password/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /open|abrir/i }));
    // The modal asks the main process for the delay before it submits, so the
    // submit lands a couple of microtasks after the click.
    await act(async () => {});
    expect(onSubmit).toHaveBeenCalledWith('secret');
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    render(<PasswordModal drawerId={DRAWER_ID} drawerTitle="Test" onClose={onClose} onSubmit={async () => {}} error={null} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel|cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles password visibility', () => {
    render(<PasswordModal drawerId={DRAWER_ID} drawerTitle="Test" onClose={() => {}} onSubmit={async () => {}} error={null} />);
    const input = screen.getByPlaceholderText(/password/i) as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: /show/i }));
    expect(input.type).toBe('text');
  });

  it('shows error message', () => {
    render(<PasswordModal drawerId={DRAWER_ID} drawerTitle="Test" onClose={() => {}} onSubmit={async () => {}} error="Wrong password" />);
    expect(screen.getByText('Wrong password')).toBeTruthy();
  });

  it('survives a rejected onSubmit and re-enables the form, without an unhandled rejection', async () => {
    // A2-deferred — the handler used to be `try { … } finally { … }`. A rejection from
    // `onSubmit` therefore escaped the submit handler that React cannot await, became a
    // global unhandled rejection, and left the user looking at a form that did nothing.
    // The message belongs to the caller (HomeScreen sets `unlockError`); this layer owes
    // the user a form that comes back to life, and the test file owes the suite no
    // dangling rejection — Vitest fails a file whose promise rejects unhandled, so a
    // green run here is half the assertion.
    const onSubmit = vi.fn(async () => {
      throw new Error('channel closed');
    });
    render(<PasswordModal drawerId={DRAWER_ID} drawerTitle="Test" onClose={() => {}} onSubmit={onSubmit} error={null} />);
    const input = screen.getByPlaceholderText(/password/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /open|abrir/i }));

    await act(async () => {});

    expect(onSubmit).toHaveBeenCalledWith('secret');
    expect(input.disabled).toBe(false);
    expect((screen.getByRole('button', { name: /open|abrir/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});
