// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../src/renderer/hooks/useFocusTrap', () => ({ useFocusTrap: () => {} }));
vi.mock('../src/renderer/hooks/useModalKeyboard', () => ({ useModalKeyboard: () => {} }));
import PasswordModal from '../src/renderer/components/PasswordModal';

beforeEach(() => cleanup());
afterEach(() => cleanup());

describe('PasswordModal', () => {
  it('renders title and password input', () => {
    render(<PasswordModal drawerTitle="Test Drawer" onClose={() => {}} onSubmit={async () => {}} error={null} />);
    expect(screen.getByText('Test Drawer')).toBeTruthy();
    expect(screen.getByPlaceholderText(/password/i)).toBeTruthy();
  });

  it('calls onSubmit with password', async () => {
    const onSubmit = vi.fn(async () => {});
    render(<PasswordModal drawerTitle="Test" onClose={() => {}} onSubmit={onSubmit} error={null} />);
    const input = screen.getByPlaceholderText(/password/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'secret' } });
    await fireEvent.click(screen.getByRole('button', { name: /open|abrir/i }));
    expect(onSubmit).toHaveBeenCalledWith('secret');
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    render(<PasswordModal drawerTitle="Test" onClose={onClose} onSubmit={async () => {}} error={null} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel|cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles password visibility', () => {
    render(<PasswordModal drawerTitle="Test" onClose={() => {}} onSubmit={async () => {}} error={null} />);
    const input = screen.getByPlaceholderText(/password/i) as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: /show/i }));
    expect(input.type).toBe('text');
  });

  it('shows error message', () => {
    render(<PasswordModal drawerTitle="Test" onClose={() => {}} onSubmit={async () => {}} error="Wrong password" />);
    expect(screen.getByText('Wrong password')).toBeTruthy();
  });
});
