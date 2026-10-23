// @vitest-environment jsdom
// UX-01 — The trap used to capture the focusable list once, on mount. A modal that
// replaces its own content (the duplicate-title warning does) then wrapped against
// nodes that were no longer on screen. These tests use the real hooks and the real
// modal, so they fail if the list is cached again.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import CreateDrawerModal from '../src/renderer/components/CreateDrawerModal';
import { DrawerListItem, EncryptedDrawer, Result } from '../src/shared/types';

const CHANGE_TITLE = /change title|alterar/i;
const CREATE_ANYWAY = /create anyway|criar mesmo assim/i;

function buildStub(): Window['electronAPI'] {
  return {
    listDrawers: async (): Promise<Result<DrawerListItem[]>> => ({ ok: true, data: [] }),
    createDrawer: async (): Promise<Result<EncryptedDrawer>> => ({ ok: true, data: { id: 'x', title: '', iconData: '', createdAt: 0, updatedAt: 0, encryptedData: '', salt: '', iv: '', authTag: '', keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 65536, parallelism: 1 } } }),
    unlockDrawer: async () => ({ ok: true, data: null }),
    getUnlockDelay: async (): Promise<number> => 0,
    saveDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    deleteDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    exportDrawer: async (): Promise<Result<string>> => ({ ok: true, data: '' }),
    importDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    openFile: async () => ({ ok: true, data: null }),
    restartApp: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    getAppVersion: async (): Promise<string> => '0.0.0',
    checkUpdate: async (): Promise<{ tag_name?: string } | null> => null,
    onExportDownloadDone: () => () => {},
  };
}

beforeEach(() => {
  window.electronAPI = buildStub();
});

afterEach(() => {
  cleanup();
});

function openDuplicateWarning(): void {
  render(<CreateDrawerModal onClose={() => {}} onCreated={() => {}} existingTitles={['Banco Central']} />);

  fireEvent.change(screen.getByLabelText(/^title$|^título$/i), { target: { value: 'Banco Central' } });
  fireEvent.change(screen.getByLabelText(/^password$|^palavra-passe$|^senha$/i), {
    target: { value: 'StrongPass1!' },
  });
  fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: 'StrongPass1!' } });
  fireEvent.click(screen.getByRole('button', { name: /^(ok|criar|creating)$/i }));

  expect(screen.getByRole('alert')).toBeTruthy();
}

describe('useFocusTrap follows the DOM when the modal swaps its content', () => {
  it('wraps Tab from the last control of the duplicate view to the first', () => {
    openDuplicateWarning();
    const changeTitle = screen.getByRole('button', { name: CHANGE_TITLE });
    const createAnyway = screen.getByRole('button', { name: CREATE_ANYWAY });

    expect(document.activeElement).toBe(changeTitle);
    createAnyway.focus();

    const notPrevented = fireEvent.keyDown(createAnyway, { key: 'Tab' });

    expect(notPrevented).toBe(false);
    expect(document.activeElement).toBe(changeTitle);
  });

  it('wraps Shift+Tab from the first control of the duplicate view to the last', () => {
    openDuplicateWarning();
    const changeTitle = screen.getByRole('button', { name: CHANGE_TITLE });
    const createAnyway = screen.getByRole('button', { name: CREATE_ANYWAY });

    expect(document.activeElement).toBe(changeTitle);
    const notPrevented = fireEvent.keyDown(changeTitle, { key: 'Tab', shiftKey: true });

    expect(notPrevented).toBe(false);
    expect(document.activeElement).toBe(createAnyway);
  });

  it('does not prevent Tab from a control that is not at the end', () => {
    openDuplicateWarning();
    const changeTitle = screen.getByRole('button', { name: CHANGE_TITLE });

    expect(fireEvent.keyDown(changeTitle, { key: 'Tab' })).toBe(true);
  });

  it('recomputes the focusable list on every press', () => {
    openDuplicateWarning();
    const changeTitle = screen.getByRole('button', { name: CHANGE_TITLE });
    const createAnyway = screen.getByRole('button', { name: CREATE_ANYWAY });

    createAnyway.focus();

    expect(fireEvent.keyDown(createAnyway, { key: 'Tab' })).toBe(false);
    expect(document.activeElement).toBe(changeTitle);

    expect(fireEvent.keyDown(changeTitle, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(createAnyway);
  });
});
