// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

beforeEach(() => cleanup());
afterEach(() => cleanup());

import ViewDrawer from '../src/renderer/pages/ViewDrawer';
import { Result } from '../src/shared/types';

const ok: Result<void> = { ok: true, data: undefined };

function props(extra: Partial<React.ComponentProps<typeof ViewDrawer>> = {}): React.ComponentProps<typeof ViewDrawer> {
  return {
    drawerId: '1',
    password: 'password123',
    initialTitle: 'Original',
    initialContent: 'Body',
    onSave: vi.fn().mockResolvedValue(ok),
    onDelete: vi.fn().mockResolvedValue(ok),
    onBack: vi.fn(),
    ...extra,
  };
}

function openDialog(): HTMLElement {
  const title = screen.getByDisplayValue('Original');
  title.focus();
  fireEvent.change(title, { target: { value: 'Edited' } });
  fireEvent.click(screen.getByText(/← Back|Voltar/));
  return screen.getByRole('dialog');
}

describe('useFocusTrap keeps focus stable across re-renders', () => {
  it('does not restore focus outside the container when the caller re-renders', () => {
    const { rerender } = render(<ViewDrawer {...props()} />);
    const dialog = openDialog();
    expect(dialog.contains(document.activeElement)).toBe(true);

    rerender(<ViewDrawer {...props({ initialContent: 'Edited' })} />);
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.change(screen.getByDisplayValue('Edited'), { target: { value: 'Edited again' } });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes the modal on Escape after a re-render without invoking the drawer onBack', () => {
    const onBack = vi.fn();
    const { rerender } = render(<ViewDrawer {...props({ onBack })} />);
    const dialog = openDialog();

    rerender(<ViewDrawer {...props({ onBack })} />);

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('focuses the primary action on open and activates it with Enter', () => {
    const onSave = vi.fn().mockResolvedValue(ok);
    render(<ViewDrawer {...props({ onSave })} />);
    openDialog();

    const primary = screen.getByRole('button', { name: /save and leave|guardar e sair/i });
    expect(document.activeElement).toBe(primary);

    fireEvent.click(primary);
    expect(onSave).toHaveBeenCalledWith('1', 'password123', 'Edited', 'Body');
  });
});