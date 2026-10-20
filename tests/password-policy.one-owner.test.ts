// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';

// The house pattern: the modal traps the focus and binds the keyboard itself, and
// neither is what is under test here.
vi.mock('../src/renderer/hooks/useFocusTrap', () => ({ useFocusTrap: () => {} }));
vi.mock('../src/renderer/hooks/useModalKeyboard', () => ({ useModalKeyboard: () => {} }));

import CreateDrawerModal from '../src/renderer/components/CreateDrawerModal';
import { isPasswordCompliant } from '../src/shared/password-policy';
import type { DrawerListItem, ElectronAPI, EncryptedDrawer, Result } from '../src/shared/types';

// SEC-08 — The drift guards. HYG-22 left the rule's owner in the main process and
// the renderer's copy where nothing could reach it: the form the user meets ran
// its own regexes, its own length floor, and a strength meter that scored on its
// own rules and contradicted the gate in both directions. Nothing tested any of
// it, so the two copies could have drifted for as long as they liked.
//
// Three guards, because no single one of them is enough:
//
//   behavioural — the form accepts exactly what the policy accepts. This is what
//     catches a re-inline of the OLD rule: it refuses the long passphrases the
//     policy admits.
//   structural — the component's source holds no character-class regex and reads
//     the shared module. This is the only guard that catches a FAITHFUL re-inline
//     of the NEW rule, which behaves identically and would pass every behavioural
//     test there is.
//   wiring — the main-process schema consults the shared module rather than
//     carrying a literal of its own, so the two processes cannot each grow a
//     rule of their own.
//
// The wiring guard is proved the way tests/store-limit.mutation.test.ts proves
// MAX_CONTENT_CODE_POINTS is read rather than restated: the module is mocked and
// the call is observed.

function buildStub(): Window['electronAPI'] {
  return {
    listDrawers: async (): Promise<Result<DrawerListItem[]>> => ({ ok: true, data: [] }),
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

// 24 code points of lower case and spaces: the passphrase branch admits it, and
// the inline check this component used to carry refused it — it wanted all four
// character classes, and this string has two (lower case, and the spaces count
// as symbols; there is no upper-case letter and no digit).
const PASSPHRASE = 'the quick brown fox jump';

// 13 code points, three classes (upper, lower, digit) and no symbol: the short
// branch wants all four, and 13 is below the passphrase threshold.
const THREE_CLASS = 'Passw0rdTest1';

// 13 code points and all four classes: the short branch admits it.
const FOUR_CLASS = 'Passw0rdTest!';

let createDrawer: Mock<ElectronAPI['createDrawer']>;

beforeEach(() => {
  createDrawer = vi.fn(buildStub().createDrawer);
  window.electronAPI = { ...buildStub(), createDrawer };
});

afterEach(() => {
  cleanup();
});

function fillForm(title: string, password: string): void {
  fireEvent.change(screen.getByLabelText(/^title$|^título$/i), { target: { value: title } });
  fireEvent.change(screen.getByLabelText(/^password$|^palavra-passe$|^senha$/i), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: password } });
}

function submitForm(): void {
  fireEvent.click(screen.getByRole('button', { name: /^(ok|criar|creating)$/i }));
}

function renderModal(): void {
  render(React.createElement(CreateDrawerModal, { onClose: () => {}, onCreated: () => {} }));
}

describe('the renderer form accepts exactly what the policy accepts', () => {
  it('accepts a 24-character lowercase passphrase and sends it to createDrawer', async () => {
    renderModal();

    fillForm('Passphrase', PASSPHRASE);
    submitForm();

    await waitFor(() => expect(createDrawer).toHaveBeenCalledWith('Passphrase', PASSPHRASE));
  });

  it('refuses a 13-character three-class password and never calls createDrawer', () => {
    renderModal();

    fillForm('Curta', THREE_CLASS);
    submitForm();

    // The gate runs before the component's first await, so the refusal has
    // already been decided by the time the click handler returns.
    expect(createDrawer).not.toHaveBeenCalled();
  });

  it('accepts and refuses each case exactly as the policy does', async () => {
    const cases: Array<[string, string]> = [
      ['a 24-character lowercase passphrase', PASSPHRASE],
      ['a 13-character three-class password', THREE_CLASS],
      ['a 13-character four-class password', FOUR_CLASS],
      ['a 19-character lowercase passphrase', 'correct horse batte'],
      ['an empty password', ''],
    ];

    for (const [why, password] of cases) {
      cleanup();
      createDrawer.mockClear();
      renderModal();

      fillForm('Drawer', password);
      submitForm();

      // The comparison is against the policy module, not against a copy of its
      // rules: a renderer that carried the old rule would refuse the passphrase
      // the policy admits, and that is exactly the drift this guard exists for.
      const expected = isPasswordCompliant(password);
      if (expected) {
        await waitFor(() => expect(createDrawer, why).toHaveBeenCalledWith('Drawer', password));
      } else {
        expect(createDrawer, why).not.toHaveBeenCalled();
      }
    }
  });
});

const RENDERER_PATH = path.resolve(
  __dirname,
  '..',
  'src',
  'renderer',
  'components',
  'CreateDrawerModal.tsx',
);
const rendererSource = fs.readFileSync(RENDERER_PATH, 'utf8');

/**
 * Every regex literal in a source text that selects a character class — a
 * bracket group holding letters or digits, or a shorthand escape like \d. That
 * is the shape the old inline rule was made of.
 */
function classRegexes(source: string): string[] {
  const literals = source.match(/\/(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^\/\n\\])+\/[gimsuy]*/g) ?? [];
  return literals.filter(
    (literal) => /\[[^\]]*[A-Za-z0-9][^\]]*\]/.test(literal) || /\\[dwsDWS]/.test(literal),
  );
}

// The rule the component used to carry, as text. It is the fixture the detector
// is proved against, and it is deliberately NOT the new rule: a faithful re-inline
// of the new rule would hold no character-class regex either, and this is what
// the detector has to be able to see.
const INLINE_RULE_FIXTURE = [
  "if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {",
].join('\n');

describe('the renderer does not re-derive the rule', () => {
  it('sees a character-class regex when the source holds one — the count guard', () => {
    // A scan that stops matching passes vacuously: the component stops holding
    // a regex, and "there is no regex here" is true for the wrong reason. The
    // detector is therefore proved on a fixture that DOES hold one — the four
    // classes of the inline rule the component used to carry — and the same
    // detector is then run on the component.
    expect(classRegexes(INLINE_RULE_FIXTURE)).toHaveLength(4);
  });

  it('holds no character-class regex of its own', () => {
    // The four classes live in the shared module. A second copy of them here is
    // a second rule, and it is the copy the user meets before the IPC round trip.
    expect(classRegexes(rendererSource)).toEqual([]);
  });

  it('holds no length threshold of its own', () => {
    // The two thresholds are two constants in the shared module. A number
    // compared against a length here is the floor or the ceiling restated, and
    // the floor is the number a reviewer is most likely to catch wrong.
    expect(rendererSource.match(/\.length\s*(?:<|>|<=|>=|===|!==)\s*\d+/g) ?? []).toEqual([]);
  });

  it('reads the rule from the shared module', () => {
    expect(rendererSource).toMatch(/from\s+['"][^'"]*shared\/password-policy['"]/);
    // The module moved out of src/main: an import of the old path would not
    // resolve, but a copy of the rule pasted into the component would.
    expect(rendererSource).not.toMatch(/main\/password-policy/);
  });

  it('calls the shared predicate and the shared scorer, once each', () => {
    // The count guard for the positive assertion above: the import does not
    // count as a use, and a component that had stopped consulting the policy
    // altogether has to fail here rather than pass the scans on an empty result.
    expect((rendererSource.match(/isPasswordCompliant\(/g) ?? []).length).toBe(1);
    expect((rendererSource.match(/scorePasswordStrength\(/g) ?? []).length).toBe(1);
  });
});

describe('the main-process schema consults the shared module', () => {
  afterEach(() => {
    vi.doUnmock('../src/shared/password-policy.js');
    vi.resetModules();
  });

  it('asks the shared predicate instead of carrying a literal of its own', async () => {
    const isPasswordCompliantSpy = vi.fn(() => true);

    vi.resetModules();
    vi.doMock('../src/shared/password-policy.js', async (importActual) => {
      const actual = await importActual<Record<string, unknown>>();
      return { ...actual, isPasswordCompliant: isPasswordCompliantSpy };
    });

    const { CreateDrawerSchema } = await import('../src/main/validation.js');
    const parsed = CreateDrawerSchema.safeParse({ title: 'Title', password: 'anything at all' });

    // The schema's verdict is the module's verdict: the mock admits every
    // password, so the schema admits this one. A schema that carried a literal
    // rule of its own would have refused it — and never called the spy, which
    // is the assertion that actually fails.
    expect(isPasswordCompliantSpy).toHaveBeenCalledWith('anything at all');
    expect(parsed.success).toBe(true);
  });

  it('refuses what the shared predicate refuses', async () => {
    const isPasswordCompliantSpy = vi.fn(() => false);

    vi.resetModules();
    vi.doMock('../src/shared/password-policy.js', async (importActual) => {
      const actual = await importActual<Record<string, unknown>>();
      return { ...actual, isPasswordCompliant: isPasswordCompliantSpy };
    });

    const { CreateDrawerSchema } = await import('../src/main/validation.js');
    const parsed = CreateDrawerSchema.safeParse({ title: 'Title', password: 'anything at all' });

    // The other direction, and the one that matters: a schema that kept its own
    // rule would still admit this password while the module refuses it, and the
    // two would have drifted apart without anybody noticing.
    expect(isPasswordCompliantSpy).toHaveBeenCalledWith('anything at all');
    expect(parsed.success).toBe(false);
  });
});
