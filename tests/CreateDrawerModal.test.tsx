// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('../src/renderer/hooks/useFocusTrap', () => ({ useFocusTrap: () => {} }));
vi.mock('../src/renderer/hooks/useModalKeyboard', () => ({ useModalKeyboard: () => {} }));
// react-hot-toast dispatches to a module store, so it emits fine with no Toaster
// mounted; mocking it is what lets the refusal be asserted as a call rather than
// as a pixel.
vi.mock('react-hot-toast');
import CreateDrawerModal from '../src/renderer/components/CreateDrawerModal';
import { DrawerListItem, ElectronAPI, EncryptedDrawer, Result } from '../src/shared/types';
import { t } from '../src/i18n';
import { toast } from 'react-hot-toast';

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
  };
}

const CREATE_ANYWAY = /create anyway|criar mesmo assim/i;
const CHANGE_TITLE = /change title|alterar t/i;

// SEC-08 — The three passwords the policy has to tell apart.
//
// The passphrase is 27 code points of lower case and spaces: the passphrase branch
// accepts it, and the inline check this component used to carry refused it — it
// wanted four character classes, and this string has none.
const PASSPHRASE = 'correct horse battery staple';

// 13 characters, three classes (upper, lower, digit) and no symbol: the short
// branch wants all four, so the app refuses it.
const THREE_CLASS = 'Passw0rdTest1';

// 13 characters and all four classes: the short branch accepts it.
const FOUR_CLASS = 'Passw0rdTest!';

let createDrawer: Mock<ElectronAPI['createDrawer']>;

beforeEach(() => {
  createDrawer = vi.fn(buildStub().createDrawer);
  window.electronAPI = { ...buildStub(), createDrawer };
  vi.mocked(toast.error).mockClear();
});

afterEach(() => {
  cleanup();
});

function fillForm(title: string, password = 'StrongPass1!'): void {
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

    await waitFor(() => expect(createDrawer).toHaveBeenCalledWith('Banco Central do Estado', 'StrongPass1!'));
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
    expect(createDrawer).toHaveBeenCalledWith('Banco Central', 'StrongPass1!');
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

    await waitFor(() => expect(createDrawer).toHaveBeenCalledWith('Banco Central', 'StrongPass1!'));
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

// SEC-08 — The renderer's half of the policy. Nothing here was under test before:
// the gate's inline regexes and the meter's own scoring were both private to the
// component, and the meter's labels were hardcoded Portuguese.
describe('CreateDrawerModal — the password policy', () => {
  it('accepts a long lowercase passphrase, which the old inline check refused', async () => {
    render(<CreateDrawerModal onClose={() => {}} onCreated={() => {}} />);

    fillForm('Passphrase', PASSPHRASE);
    submitForm();

    await waitFor(() => expect(createDrawer).toHaveBeenCalledWith('Passphrase', PASSPHRASE));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('refuses a password below the passphrase threshold that misses a character class', () => {
    render(<CreateDrawerModal onClose={() => {}} onCreated={() => {}} />);

    fillForm('Curta', THREE_CLASS);
    submitForm();

    expect(createDrawer).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(t('msg.password_too_short'));
  });

  it('labels an accepted password as good, and the gate accepts it too', async () => {
    render(<CreateDrawerModal onClose={() => {}} onCreated={() => {}} />);

    fireEvent.change(screen.getByLabelText(/^password$|^palavra-passe$|^senha$/i), {
      target: { value: FOUR_CLASS },
    });

    // The label is read from the catalogue, so a hardcoded one — in Portuguese or
    // in English — fails here instead of shipping.
    expect(screen.getByText(t('label.strength_good'))).toBeTruthy();

    fillForm('Misto', FOUR_CLASS);
    submitForm();

    await waitFor(() => expect(createDrawer).toHaveBeenCalledWith('Misto', FOUR_CLASS));
  });

  it('labels a refused password as too simple, and the gate refuses it too', () => {
    render(<CreateDrawerModal onClose={() => {}} onCreated={() => {}} />);

    fireEvent.change(screen.getByLabelText(/^password$|^palavra-passe$|^senha$/i), {
      target: { value: THREE_CLASS },
    });

    expect(screen.getByText(t('label.strength_too_simple'))).toBeTruthy();

    fillForm('Curta', THREE_CLASS);
    submitForm();

    expect(createDrawer).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(t('msg.password_too_short'));
  });
});
