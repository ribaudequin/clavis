// @vitest-environment jsdom
// Why this file exists: the main process returns English literals in AppError.message,
// which is what the logs show. The renderer used to concatenate that raw message onto a
// translated prefix, so a pt-PT user saw "Falha ao guardar Incorrect password or drawer
// not found". The renderer must resolve user-visible text from AppError.code instead.
// Every assertion below pins the translated string AND the absence of the English one,
// because a test that only checked the Portuguese would still pass on the old code if the
// English were appended.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { translations } from '../src/i18n';
import {
  AppError,
  DrawerListItem,
  ElectronAPI,
  EncryptedDrawer,
  ErrorCode,
  Result,
} from '../src/shared/types';

const ORIGINAL_LANGUAGE = window.navigator.language;

function setLanguage(lang: string): void {
  Object.defineProperty(window.navigator, 'language', { value: lang, configurable: true });
}

function setPortuguese(): void {
  vi.stubEnv('CI', undefined);
  setLanguage('pt-PT');
}

const WRONG_PASSWORD = 'Incorrect password or drawer not found';
const PT_DECRYPT_FAILED = translations['pt-PT']['error.decrypt_failed'];

const mockDrawers: DrawerListItem[] = [
  { id: '123e4567-e89b-12d3-a456-426614174000', title: 'Banco Central', iconData: '[]' },
];

let unlockDrawer: ReturnType<typeof vi.fn>;

function buildStub(): ElectronAPI {
  return {
    listDrawers: async (): Promise<Result<DrawerListItem[]>> => ({ ok: true, data: mockDrawers }),
    createDrawer: async (): Promise<Result<EncryptedDrawer>> => ({
      ok: true,
      data: {
        id: 'x',
        title: '',
        iconData: '',
        createdAt: 0,
        updatedAt: 0,
        encryptedData: '',
        salt: '',
        iv: '',
        authTag: '',
        keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 65536, parallelism: 1 },
      },
    }),
    unlockDrawer: unlockDrawer as unknown as ElectronAPI['unlockDrawer'],
    saveDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    deleteDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    exportDrawer: async (): Promise<Result<string>> => ({ ok: true, data: '' }),
    importDrawer: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    openFile: async (): Promise<Result<{ token: string; fileName: string } | null>> => ({ ok: true, data: null }),
    restartApp: async (): Promise<Result<void>> => ({ ok: true, data: undefined }),
    getAppVersion: async (): Promise<string> => '0.0.0-test',
    checkUpdate: async (): Promise<{ tag_name?: string } | null> => null,
  };
}

function failingUnlock(error: AppError) {
  return vi.fn(async (): Promise<Result<{ title: string; content: string; iconData: string } | null>> => ({
    ok: false,
    error,
  }));
}

beforeEach(() => {
  cleanup();
  setPortuguese();
  unlockDrawer = vi.fn(async (): Promise<Result<{ title: string; content: string; iconData: string } | null>> => ({
    ok: true,
    data: null,
  }));
  window.electronAPI = buildStub();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  setLanguage(ORIGINAL_LANGUAGE);
});

async function submitWrongPassword(): Promise<void> {
  const { default: HomeScreen } = await import('../src/renderer/pages/HomeScreen');
  window.electronAPI = buildStub();
  render(<HomeScreen />);

  fireEvent.click(await screen.findByText('Banco Central'));
  const input = (await screen.findByLabelText(translations['pt-PT']['label.password'])) as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'errada' } });
  fireEvent.click(screen.getByRole('button', { name: translations['pt-PT']['btn.open'] }));

  await waitFor(() => expect(unlockDrawer).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
}

describe('unlock failure is translated from the error code, not the main-process message', () => {
  it('renders the pt-PT DECRYPT_FAILED string and never the English main-process message', async () => {
    unlockDrawer = failingUnlock({ code: ErrorCode.DECRYPT_FAILED, message: WRONG_PASSWORD });

    await submitWrongPassword();

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(PT_DECRYPT_FAILED);
    expect(alert.textContent).not.toContain(WRONG_PASSWORD);
    expect(document.body.textContent).not.toContain(WRONG_PASSWORD);
    expect(PT_DECRYPT_FAILED).not.toBe(WRONG_PASSWORD);
  });

  it('never shows the bare dictionary key when a code is resolved', async () => {
    unlockDrawer = failingUnlock({ code: ErrorCode.DECRYPT_FAILED, message: WRONG_PASSWORD });

    await submitWrongPassword();

    expect(document.body.textContent).not.toContain('error.decrypt_failed');
  });

  it('translates every error code to a distinct pt-PT string that is not the English one', async () => {
    const codes = Object.values(ErrorCode);
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      const key = translations['pt-PT'][`error.${code.toLowerCase()}`];
      expect({ code, present: typeof key === 'string' && key !== '' }).toEqual({ code, present: true });
      expect(key).not.toBe(WRONG_PASSWORD);
      expect(key).not.toContain('Error:');
      expect(key.trim()).toBe(key);
      expect(key.endsWith(':')).toBe(false);
    }
  });

  it('falls back to the error message when the code is unknown to the dictionary', async () => {
    const { tError } = await import('../src/i18n');
    const unknown = { code: 'NOT_A_REAL_CODE', message: 'Something the main process said' } as unknown as AppError;
    expect(tError(unknown)).toBe('Something the main process said');
  });
});