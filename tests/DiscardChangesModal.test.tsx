// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../src/renderer/hooks/useFocusTrap', () => ({ useFocusTrap: vi.fn() }));
vi.mock('../src/renderer/hooks/useModalKeyboard', () => ({ useModalKeyboard: vi.fn() }));
import DiscardChangesModal from '../src/renderer/components/DiscardChangesModal';
import { useFocusTrap } from '../src/renderer/hooks/useFocusTrap';
import { useModalKeyboard } from '../src/renderer/hooks/useModalKeyboard';

const SAVE_AND_LEAVE = /save and leave|guardar e sair/i;
const DISCARD_AND_LEAVE = /discard and leave|descartar e sair/i;
const CANCEL = /^(cancel|cancelar)$/i;
const SAVING = /saving|a guardar/i;
const UNSAVED_TITLE = /unsaved changes|alterações por guardar/i;

afterEach(() => cleanup());

describe('DiscardChangesModal', () => {
  it('renders a labelled dialog that warns about the lost changes', () => {
    render(<DiscardChangesModal onSaveAndLeave={() => {}} onDiscard={() => {}} onCancel={() => {}} saving={false} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('discard-title');
    expect(dialog.getAttribute('aria-describedby')).toBe('discard-desc');
    expect(screen.getByRole('heading', { name: UNSAVED_TITLE })).toBeTruthy();
    expect(document.getElementById('discard-desc')?.textContent ?? '').toMatch(/perdi|perdidas|lost/i);
  });

  it('focuses the primary action on mount', () => {
    render(<DiscardChangesModal onSaveAndLeave={() => {}} onDiscard={() => {}} onCancel={() => {}} saving={false} />);

    expect(document.activeElement).toBe(screen.getByRole('button', { name: SAVE_AND_LEAVE }));
  });

  it('calls onSaveAndLeave when the primary action is clicked', () => {
    const onSaveAndLeave = vi.fn();
    render(<DiscardChangesModal onSaveAndLeave={onSaveAndLeave} onDiscard={() => {}} onCancel={() => {}} saving={false} />);

    fireEvent.click(screen.getByRole('button', { name: SAVE_AND_LEAVE }));

    expect(onSaveAndLeave).toHaveBeenCalledTimes(1);
  });

  it('calls onDiscard when the destructive action is clicked', () => {
    const onDiscard = vi.fn();
    render(<DiscardChangesModal onSaveAndLeave={() => {}} onDiscard={onDiscard} onCancel={() => {}} saving={false} />);

    fireEvent.click(screen.getByRole('button', { name: DISCARD_AND_LEAVE }));

    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel action is clicked', () => {
    const onCancel = vi.fn();
    render(<DiscardChangesModal onSaveAndLeave={() => {}} onDiscard={() => {}} onCancel={onCancel} saving={false} />);

    fireEvent.click(screen.getByRole('button', { name: CANCEL }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables all three actions while saving and labels the primary action as saving', () => {
    render(<DiscardChangesModal onSaveAndLeave={() => {}} onDiscard={() => {}} onCancel={() => {}} saving />);

    expect((screen.getByRole('button', { name: SAVING }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: DISCARD_AND_LEAVE }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: CANCEL }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('wires onCancel as the escape handler of both accessibility hooks', () => {
    const onCancel = vi.fn();
    render(<DiscardChangesModal onSaveAndLeave={() => {}} onDiscard={() => {}} onCancel={onCancel} saving={false} />);

    const options = { onEscape: onCancel };
    expect(useFocusTrap).toHaveBeenCalledWith(expect.anything(), { ...options, isActive: true });
    expect(useModalKeyboard).toHaveBeenCalledWith(expect.anything(), options);
  });
});
