// HYG-13b — The content caps are policy, and policy is a number.
//
// The family, and who owns each number:
//
//   src/shared/limits.ts        CONTENT_CEILING = 10_000_000
//     ├── MAX_CONTENT_CODE_POINTS   code points — Zod's .max() in validation.ts
//     └── MAX_PLAINTEXT_BYTES      UTF-8 bytes — encrypt()/decrypt() in encryption.ts
//           └── MAX_DECRYPTED_SIZE  bytes — the re-export store.ts derives from
//                 └── MAX_DRAWER_FILE_SIZE  characters of a .clavis file — store.ts
//
// Every boundary test in the suite builds its input FROM the constant
// ('x'.repeat(MAX_DECRYPTED_SIZE + 1), 'ab'.repeat(MAX_DECRYPTED_SIZE + 1), …),
// which is right for a behavioural test and wrong as the only kind: the invariant has
// to hold at whatever the cap is, so retargeting the cap keeps every one of them
// green. That is the hole this file closes.
//
// What was actually unguarded — each of these read off the tree and measured, not
// assumed:
//
//   1. The file ceiling (MAX_DRAWER_FILE_SIZE = 20 004 096) was pinned NOWHERE.
//      Two copies of the number lived in the test tree — the ipc-handlers store mock
//      and the SEC-07 metadata assertion — but a copy is a use, not an assertion, and
//      the mock would have kept serving the old number after the source moved.
//      Measured: lowering ABSOLUTE_IMPORT_CEILING from 20 004 096 to 20 004 010 —
//      86 characters, a cap that moved for real — left the whole suite green,
//      499/499. Below that the suite notices only by collision, when the payloads
//      the store tests build stop fitting under the cap, not by comparison.
//
//   2. The two content ceilings were pinned, but by three unrelated files:
//      tests/encryption.test.ts (HYG-13), tests/ViewDrawer.test.tsx (the tripwire)
//      and tests/validation.test.ts (the boundary literals). Three owners of one
//      policy, none of them owning it whole: the byte cap, the code-point cap and
//      the file cap were stated in three places, and a reader asking "where is the
//      content cap stated?" got three answers.
//
//   3. Nothing said the file cap is DERIVED. Replacing the whole derivation in
//      store.ts with `export const MAX_DRAWER_FILE_SIZE = 20_004_096;` — the same
//      number, the same behaviour today — left the whole suite green, 516/516.
//      Measured, and it is the case the house pattern calls a "faithful re-inline":
//      it behaves identically, so no behavioural test can see it, and the clamp
//      store.ts warns about ("it becomes load-bearing the moment the text limit
//      rises") is exactly what a literal throws away. Only a wiring guard can.
//
// This file is the anchor: the whole family, in absolute numbers, in one place. A
// retarget of any member of it — a value, or the wiring that derives it — turns this
// file red, which is what makes moving a cap a deliberate act instead of a silent
// one.
//
// It does not replace the three guards above: they are local tripwires next to the
// behaviour they protect, and the ViewDrawer one reads the real module rather than
// the mock it renders against. Those are not second owners of the policy: a boundary
// built out of a number — 'x'.repeat(10_000_001) — is a probe of the behaviour, and
// it fails loudly, and by name, when the policy moves. What they could not do is
// state the policy, and the file cap had no statement of its own anywhere.
//
// What is deliberately NOT here: the behavioural boundary tests stay relative. They
// probe the true boundary ("one byte past the cap is refused"), and an absolute
// construction would stop probing it the moment the cap moved. This file states the
// policy; those tests hold the behaviour to it.
//
// Two of the four numbers are shown to the user — the capacity counter in the drawer
// view reads the code-point and byte ceilings — and all four are documented in
// docs/DRAWER-CAPACITY.md, which is why the doc is guarded at the bottom.

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { MAX_CONTENT_CODE_POINTS, MAX_PLAINTEXT_BYTES } from '../src/shared/limits';
import { MAX_DECRYPTED_SIZE } from '../src/main/encryption';
import { MAX_DRAWER_FILE_SIZE } from '../src/main/store';

// The policy, in absolute numbers. These are literals on purpose: a value read back
// from the module it is checking proves nothing, so the expectations below have to
// carry the number themselves.
const ABSOLUTE_CODE_POINT_CEILING = 10_000_000;
const ABSOLUTE_PLAINTEXT_BYTE_CEILING = 10_000_000;
const ABSOLUTE_DRAWER_FILE_CEILING = 20_004_096;

// The envelope allowance store.ts adds to the hex payload: the JSON around it, which
// is measured at 1 922 characters in the worst case (255 characters of U+0001, each
// escaped to six) and covered with 4 KB of headroom.
const ABSOLUTE_ENVELOPE_OVERHEAD = 4_096;

/**
 * The file cap as the store derives it, with the byte cap forced to `byteCap`.
 *
 * The mock is what makes the derivation observable: the byte cap is the only input
 * the file cap reacts to while it is below the absolute ceiling, so replacing the
 * derivation with a literal leaves the number untouched while this changes it.
 */
async function deriveFileCapWith(byteCap: number): Promise<number> {
  vi.resetModules();
  vi.doMock('../src/shared/limits.js', async (importActual) => {
    return { ...((await importActual()) as Record<string, unknown>), MAX_PLAINTEXT_BYTES: byteCap };
  });
  const store = await import('../src/main/store.js');
  const derived = store.MAX_DRAWER_FILE_SIZE;
  vi.doUnmock('../src/shared/limits.js');
  vi.resetModules();
  return derived;
}

describe('the content caps, in absolute numbers', () => {
  it('caps a drawer at 10 000 000 code points — what the save schema accepts', () => {
    expect(MAX_CONTENT_CODE_POINTS).toBe(ABSOLUTE_CODE_POINT_CEILING);
  });

  it('caps the same text at 10 000 000 UTF-8 bytes — what encrypt() and decrypt() enforce', () => {
    expect(MAX_PLAINTEXT_BYTES).toBe(ABSOLUTE_PLAINTEXT_BYTE_CEILING);
  });

  it('re-exports the byte cap as MAX_DECRYPTED_SIZE at 10 000 000', () => {
    // The value, checked here. That it is *derived* rather than a second literal is
    // guarded by the mutation test in tests/encryption.test.ts; this file states the
    // value and does not restate that guard.
    expect(MAX_DECRYPTED_SIZE).toBe(ABSOLUTE_PLAINTEXT_BYTE_CEILING);
  });

  it('caps a .clavis file at 20 004 096 characters', () => {
    expect(MAX_DRAWER_FILE_SIZE).toBe(ABSOLUTE_DRAWER_FILE_CEILING);
  });

  it('keeps the two ceilings equal in value, under two names', () => {
    // They are equal today and must stay two names: the units differ (code points
    // vs UTF-8 bytes), and one export would hide that from the reader. The equality
    // is also what makes the code-point cap the looser of the two.
    expect(MAX_CONTENT_CODE_POINTS).toBe(MAX_PLAINTEXT_BYTES);
  });

  it('keeps the unit gap open: the code-point cap admits more bytes than the byte cap allows', () => {
    // This is SAV-01, in the units that make it: a code point costs up to four
    // UTF-8 bytes, so text at the code-point ceiling can be four times the byte
    // ceiling, and encrypt() refuses it (SAV-03). The relation holds at any value
    // the caps are given, which is what makes it an invariant and not a policy:
    // the policy above says which numbers it holds for.
    expect(4 * MAX_CONTENT_CODE_POINTS).toBeGreaterThan(MAX_PLAINTEXT_BYTES);
  });
});

describe('the file cap is derived, not written down', () => {
  // These guards are the ones the value assertions above cannot make. A literal of
  // the right number passes every value check there is — measured:
  // `export const MAX_DRAWER_FILE_SIZE = 20_004_096;` leaves the suite green.

  it('follows the byte cap when the byte cap moves', async () => {
    // The teeth of the guard: the expected value is computed from the mocked byte
    // cap, so a hardcoded 20 004 096 cannot satisfy it. The two branches of the
    // derivation are read here — the ceiling clamps the file cap, so the byte cap
    // is moved well below it for this to be visible at all.
    expect(await deriveFileCapWith(1_000_000)).toBe(2 * 1_000_000 + ABSOLUTE_ENVELOPE_OVERHEAD);
  });

  it('stays pinned by the absolute ceiling when the byte cap rises', async () => {
    // The other branch: raising the byte cap must not move the file cap. This is
    // what the clamp in store.ts exists for, and a literal would break it silently
    // — the file cap would follow the text limit to 100 004 096 characters.
    expect(await deriveFileCapWith(50_000_000)).toBe(ABSOLUTE_DRAWER_FILE_CEILING);
  });

  it('takes the envelope allowance from the source, not from a copy here', async () => {
    // The 4 096 above is a policy number, but the source owns the arithmetic. With
    // the byte cap at 9 000 000 the file cap is 18 004 096 only because store.ts
    // adds its own 4 096 — a different allowance in the source moves this number.
    expect(await deriveFileCapWith(9_000_000)).toBe(2 * 9_000_000 + ABSOLUTE_ENVELOPE_OVERHEAD);
  });

  it('the mock reaches the derivation at all — the cap moves with the byte cap', async () => {
    // The count guard for the three above: if the mock did not reach store.ts, the
    // expected values would be unreachable and the guards would be passing for the
    // wrong reason. Two different byte caps, two different file caps.
    const atTen = await deriveFileCapWith(10_000_000);
    const atOne = await deriveFileCapWith(1_000_000);
    expect(atTen).toBe(ABSOLUTE_DRAWER_FILE_CEILING);
    expect(atOne).not.toBe(atTen);
  });
});

describe('the documented capacity matches the enforced one', () => {
  const DOC_PATH = path.resolve(__dirname, '..', 'docs', 'DRAWER-CAPACITY.md');

  /**
   * The row of the capacity table that states one limit. The table is where the doc
   * makes the claim, so the guard reads the claim itself rather than the whole
   * document: a doc that repeats 20 004 096 in its prose while the table says
   * something else is exactly the drift this catches.
   */
  function capacityRow(label: string): string | undefined {
    return fs
      .readFileSync(DOC_PATH, 'utf8')
      .split('\n')
      .find((line) => line.startsWith(`| ${label} |`));
  }

  it('states the code-point ceiling in the capacity table', () => {
    expect(capacityRow('Content on save')).toContain('`10_000_000` code points');
  });

  it('states the ciphertext ceiling in the capacity table', () => {
    expect(capacityRow('Ciphertext on unlock')).toContain('`10_000_000` bytes');
  });

  it('states the decrypted-content ceiling in the capacity table', () => {
    expect(capacityRow('Decrypted content')).toContain('`10_000_000` bytes');
  });

  it('states the file ceiling in the capacity table', () => {
    expect(capacityRow('Imported `.clavis` file')).toContain('`20_004_096` chars');
  });
});
