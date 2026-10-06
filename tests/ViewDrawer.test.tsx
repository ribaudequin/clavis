// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

beforeEach(() => cleanup());
afterEach(() => cleanup());

vi.mock('../src/renderer/hooks/useFocusTrap', () => ({ useFocusTrap: () => {} }));
vi.mock('../src/renderer/hooks/useModalKeyboard', () => ({ useModalKeyboard: () => {} }));
import ViewDrawer from '../src/renderer/pages/ViewDrawer';
import { Result } from '../src/shared/types';

const BACK_BUTTON = /←\s*(back|voltar)/i;
const SAVE_AND_LEAVE = /save and leave|guardar e sair/i;
const DISCARD_AND_LEAVE = /discard and leave|descartar e sair/i;
const CANCEL = /^(cancel|cancelar)$/i;
const SAVE_DRAWER = /save drawer|guardar e voltar/i;
const UNSAVED_TITLE = /unsaved changes|alterações por guardar/i;

const okSave = async (): Promise<Result<void>> => ({ ok: true, data: undefined });
const okDelete = async (): Promise<Result<void>> => ({ ok: true, data: undefined });

function renderDrawer(overrides: Partial<React.ComponentProps<typeof ViewDrawer>> = {}) {
  const props = {
    drawerId: '1',
    password: 'pw',
    initialTitle: 'My Drawer',
    initialContent: 'Hello',
    onSave: vi.fn(okSave),
    onDelete: vi.fn(okDelete),
    onBack: vi.fn(),
    ...overrides,
  };
  const view = render(<ViewDrawer {...props} />);
  return { ...view, props };
}

describe('ViewDrawer', () => {
  it('renders title and content inputs', () => {
    renderDrawer();
    expect(screen.getByDisplayValue('My Drawer')).toBeTruthy();
    expect(screen.getByDisplayValue('Hello')).toBeTruthy();
  });

  it('calls onBack when back clicked', () => {
    const onBack = vi.fn();
    renderDrawer({ onBack });
    fireEvent.click(screen.getByRole('button', { name: BACK_BUTTON }));
    expect(onBack).toHaveBeenCalled();
  });

  it('calls onSave with updated data', async () => {
    const onSave = vi.fn(okSave);
    renderDrawer({ initialTitle: 'T', initialContent: 'C', onSave });
    fireEvent.change(screen.getByDisplayValue('T'), { target: { value: 'Updated' } });
    fireEvent.change(screen.getByDisplayValue('C'), { target: { value: 'Updated content' } });
    await fireEvent.click(screen.getByRole('button', { name: SAVE_DRAWER }));
    expect(onSave).toHaveBeenCalledWith('1', 'pw', 'Updated', 'Updated content');
  });

  it('shows delete button', () => {
    renderDrawer({ initialTitle: 'Del', initialContent: '' });
    expect(screen.getByRole('button', { name: /delete drawer|eliminar gaveta/i })).toBeTruthy();
  });

  it('leaves straight away on back when the content is clean', () => {
    const { props } = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: BACK_BUTTON }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks before leaving when the title was edited', () => {
    const { props } = renderDrawer();
    fireEvent.change(screen.getByDisplayValue('My Drawer'), { target: { value: 'Edited' } });
    fireEvent.click(screen.getByRole('button', { name: BACK_BUTTON }));
    expect(props.onBack).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: UNSAVED_TITLE })).toBeTruthy();
  });

  it('asks before leaving when only the content was edited', () => {
    const { props } = renderDrawer();
    fireEvent.change(screen.getByDisplayValue('Hello'), { target: { value: 'Edited content' } });
    fireEvent.click(screen.getByRole('button', { name: BACK_BUTTON }));
    expect(props.onBack).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('discards the edits and leaves when "discard and leave" is chosen', () => {
    const { props } = renderDrawer();
    fireEvent.change(screen.getByDisplayValue('My Drawer'), { target: { value: 'Edited' } });
    fireEvent.click(screen.getByRole('button', { name: BACK_BUTTON }));
    fireEvent.click(screen.getByRole('button', { name: DISCARD_AND_LEAVE }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('saves the edits and leaves when "save and leave" is chosen', async () => {
    const { props } = renderDrawer();
    fireEvent.change(screen.getByDisplayValue('My Drawer'), { target: { value: 'Edited' } });
    fireEvent.change(screen.getByDisplayValue('Hello'), { target: { value: 'Edited content' } });
    fireEvent.click(screen.getByRole('button', { name: BACK_BUTTON }));
    fireEvent.click(screen.getByRole('button', { name: SAVE_AND_LEAVE }));

    await waitFor(() => expect(props.onBack).toHaveBeenCalledTimes(1));
    expect(props.onSave).toHaveBeenCalledWith('1', 'pw', 'Edited', 'Edited content');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the dialog without leaving or saving when cancelled', () => {
    const { props } = renderDrawer();
    fireEvent.change(screen.getByDisplayValue('My Drawer'), { target: { value: 'Edited' } });
    fireEvent.click(screen.getByRole('button', { name: BACK_BUTTON }));
    fireEvent.click(screen.getByRole('button', { name: CANCEL }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(props.onBack).not.toHaveBeenCalled();
    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Edited')).toBeTruthy();
  });

  it('leaves straight away once the edit is reverted to the original value', () => {
    const { props } = renderDrawer();
    fireEvent.change(screen.getByDisplayValue('My Drawer'), { target: { value: 'Edited' } });
    fireEvent.change(screen.getByDisplayValue('Edited'), { target: { value: 'My Drawer' } });
    fireEvent.click(screen.getByRole('button', { name: BACK_BUTTON }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
