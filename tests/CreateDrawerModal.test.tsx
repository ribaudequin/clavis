// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('../src/renderer/hooks/useFocusTrap', () => ({ useFocusTrap: () => {} }));
vi.mock('../src/renderer/hooks/useModalKeyboard', () => ({ useModalKeyboard: () => {} }));
import CreateDrawerModal from '../src/renderer/components/CreateDrawerModal';
import { DrawerListItem, ElectronAPI, EncryptedDrawer, Result } from '../src/shared/types';

function buildStub(): Window['electronAPI'] {
  return {
    listDrawers: async (): Promise<Result<DrawerListItem[]>> => ({ ok: true, data: [] }),
    createDrawer: async (): Promise<Result<EncryptedDrawer>> => ({ ok: true, data: { id: 'x', title: '', iconData: '', createdAt: 0, updatedAt: 0, encryptedData: '', salt: '', iv: '', authTag: '', keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 65536, parallelism: 1 } } }),
    unlockDrawer: async () => ({ ok: true, data: null }),
    saveDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    deleteDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    exportDrawer: async (): Promise<Result<string>> => ({ ok: true, data: '' }),
    importDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    openFile: async () => ({ ok: true, data: null }),
    restartApp: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    getAppVersion: async (): Promise<string> => '0.0.0',
    checkUpdate: async (): Promise<{ tag_name?: string } | null> => null,
  };
}

const CREATE_ANYWAY = /create anyway|criar mesmo assim/i;
const CHANGE_TITLE = /change title|alterar t/i;

let createDrawer: Mock<ElectronAPI['createDrawer']>;

beforeEach(() => {
  createDrawer = vi.fn(buildStub().createDrawer);
  window.electronAPI = { ...buildStub(), createDrawer };
});

afterEach(() => {
  cleanup();
});

function fillForm(title: string, password = 'secret123'): void {
  fireEvent.change(screen.getByLabelText(/^title$|^título$/i), { target: { value: title } });
  fireEvent.change(screen.getByLabelText(/^password$|^palavra-passe$|^senha$/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: password } });
}

function submitForm(): void {
  fireEvent.click(screen.getByRole('button', { name: /^(ok|criar|creating)$/i }));
}

describe('CreateDrawerModal', () => {
  it('creates a drawer directly when the title is not a duplicate', async () => {
    const onCreated = vi.fn();
    render(
      <CreateDrawerModal
        onClose={() => {}}
        onCreated={onCreated}
        existingTitles={['Banco Central', 'Notas']}
      />
    );

    fillForm('Banco Central do Estado');
    submitForm();

    await waitFor(() => expect(createDrawer).toHaveBeenCalledWith('Banco Central do Estado', 'secret123'));
    expect(screen.queryByRole('button', { name: CREATE_ANYWAY })).toBeFalsy();
    expect(onCreated).toHaveBeenCalled();
  });

  it('warns before creating when the title duplicates an existing drawer', async () => {
    render(<CreateDrawerModal onClose={() => {}} onCreated={() => {}} existingTitles={['Banco Central']} />);

    fillForm('Banco Central');
    submitForm();

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Banco Central')).toBeTruthy();
    expect(createDrawer).not.toHaveBeenCalled();
  });

  it('creates the drawer after confirming the duplicate warning', async () => {
    const onCreated = vi.fn();
    render(
      <CreateDrawerModal onClose={() => {}} onCreated={onCreated} existingTitles={['Banco Central']} />
    );

    fillForm('Banco Central');
    submitForm();
    expect(createDrawer).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: CREATE_ANYWAY }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createDrawer).toHaveBeenCalledTimes(1);
    expect(createDrawer).toHaveBeenCalledWith('Banco Central', 'secret123');
  });

  it('warns when the title differs from an existing one only by case and whitespace', async () => {
    render(<CreateDrawerModal onClose={() => {}} onCreated={() => {}} existingTitles={['Banco Central']} />);

    fillForm('  banco central  ');
    submitForm();

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(createDrawer).not.toHaveBeenCalled();
  });

  it('returns to the form without creating when the warning is dismissed', () => {
    const onClose = vi.fn();
    render(<CreateDrawerModal onClose={onClose} onCreated={() => {}} existingTitles={['Banco Central']} />);

    fillForm('Banco Central');
    submitForm();
    expect(screen.getByRole('alert')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: CHANGE_TITLE }));

    expect(screen.queryByRole('alert')).toBeFalsy();
    expect(screen.getByLabelText(/^title$|^título$/i)).toBeTruthy();
    expect((screen.getByLabelText(/^title$|^título$/i) as HTMLInputElement).value).toBe('Banco Central');
    expect(createDrawer).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not warn when existingTitles is not provided', async () => {
    render(<CreateDrawerModal onClose={() => {}} onCreated={() => {}} />);

    fillForm('Banco Central');
    submitForm();

    await waitFor(() => expect(createDrawer).toHaveBeenCalledWith('Banco Central', 'secret123'));
    expect(screen.queryByRole('alert')).toBeFalsy();
  });

  it('rejects an empty title before checking for duplicates', () => {
    render(<CreateDrawerModal onClose={() => {}} onCreated={() => {}} existingTitles={['Banco Central']} />);

    fillForm('   ');
    submitForm();

    expect(screen.queryByRole('alert')).toBeFalsy();
    expect(createDrawer).not.toHaveBeenCalled();
  });
});
