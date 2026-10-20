import { z } from 'zod';
import { MAX_CONTENT_CODE_POINTS } from '../shared/limits.js';
import { isPasswordCompliant, describePasswordPolicy } from '../shared/password-policy.js';

// The policy is a refine, not a .min()/.regex chain: a violation has to arrive at the
// IPC layer as a Zod issue on `password` that can be classified by path, and a chain of
// built-in checks would raise four or five issues with four or five unrelated codes
// (`too_small`, `invalid_string`) and no single one meaning "password policy".
export const CreateDrawerSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  password: z
    .string()
    .max(128, 'Password too long')
    .refine(isPasswordCompliant, { message: describePasswordPolicy() }),
});

export const UnlockDrawerSchema = z.object({
  id: z.string().uuid('Invalid drawer ID'),
  password: z.string().min(1, 'Password is required').max(128, 'Password too long'),
});

// Sanity bounds only — the strong policy is a create-time rule, and both of these
// schemas are read as "what may arrive" rather than "what a new password must be".
// There is no change-password channel in CHANNELS, so a save can only re-use the
// password that already opens the drawer, and drawers created before the
// 12-character rule still open with 8-character passwords. Enforcing the policy here
// would strand exactly those users: they could unlock a drawer and then not save it,
// which is SEC-02 reopening. Unlock has the same reason from the other side — a legacy
// password has to get as far as the store to be tried.
export const SaveDrawerSchema = z.object({
  id: z.string().uuid('Invalid drawer ID'),
  password: z.string().min(1, 'Password is required').max(128, 'Password too long'),
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  // The cap is in code points, not bytes — Zod's .max() folds surrogate pairs, so this
  // admits up to 4x MAX_PLAINTEXT_BYTES of UTF-8 text. The byte cap lives in
  // encrypt() (SAV-01). Main-process log text only: the renderer translates on
  // ErrorCode, not on this string.
  content: z.string().max(MAX_CONTENT_CODE_POINTS, `Content too large (max ${MAX_CONTENT_CODE_POINTS.toLocaleString('en-US')} code points)`),
});

export const DeleteDrawerSchema = z.object({
  id: z.string().uuid('Invalid drawer ID'),
});

// UX-08 — The delay query needs the drawer id and nothing else. It repeats
// DeleteDrawerSchema's shape on purpose: that schema belongs to the delete path,
// and a schema named after the operation that uses it is worth more here than a
// shared constant would be.
export const DrawerIdSchema = z.object({
  id: z.string().uuid('Invalid drawer ID'),
});

// SEC-05 — Every hex field Clavis writes has a fixed width, and decrypt() builds a
// Buffer from whatever it is given: a 2-byte IV reaches createDecipheriv and throws,
// which used to be indistinguishable from a wrong password. Salt, IV and tag are all
// 16 bytes (32 hex characters); the ciphertext is any even-length hex, including the
// empty string an empty drawer encrypts to. Hex is accepted in either case.
const SIXTEEN_BYTE_HEX_RE = /^(?:[0-9a-f]{2}){16}$/i;
const EVEN_LENGTH_HEX_RE = /^(?:[0-9a-f]{2})*$/i;

const ICON_DATA_MAX_ENTRIES = 64;
const ICON_DATA_ENTRY_MAX_LENGTH = 64;

// SEC-07 — HomeScreen's renderIcon() parses iconData and maps every element to a DOM
// node, so an unbounded array is a renderer freeze. The real value is nine "rgb(...)"
// entries; the caps leave room for older or larger palettes without admitting millions.
function isBoundedIconData(value: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return false;
  }
  return (
    Array.isArray(parsed) &&
    parsed.length <= ICON_DATA_MAX_ENTRIES &&
    parsed.every(
      (entry) => typeof entry === 'string' && entry.length <= ICON_DATA_ENTRY_MAX_LENGTH
    )
  );
}

export const EncryptedDrawerSchema = z.object({
  id: z.string().uuid('Invalid drawer id'),
  title: z.string().min(1).max(255),
  iconData: z
    .string()
    .max(4096)
    .refine(isBoundedIconData, 'iconData must be a JSON array of bounded strings'),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  encryptedData: z.string().regex(EVEN_LENGTH_HEX_RE, 'Ciphertext must be even-length hex'),
  salt: z.string().regex(SIXTEEN_BYTE_HEX_RE, 'Salt must be 32 hex characters'),
  iv: z.string().regex(SIXTEEN_BYTE_HEX_RE, 'IV must be 32 hex characters'),
  authTag: z.string().regex(SIXTEEN_BYTE_HEX_RE, 'Auth tag must be 32 hex characters'),
  keyDerivation: z.object({
    // Legacy drawers predate this field. storedKdfParams() treats a missing value as
    // "whatever backend this build supports", which is the only behaviour they had.
    algorithm: z.enum(['argon2id', 'scrypt']).optional(),
    iterations: z.number().int().positive(),
    memory: z.number().int().positive(),
    parallelism: z.number().int().positive(),
  }),
});

export type EncryptedDrawerMetadata = z.infer<typeof EncryptedDrawerSchema>;

export const ExportDrawerSchema = z.object({
  id: z.string().uuid('Invalid drawer ID'),
});

export const ImportDrawerSchema = z.object({
  token: z.string().uuid('Invalid import token'),
});

export type CreateDrawerInput = z.infer<typeof CreateDrawerSchema>;
export type UnlockDrawerInput = z.infer<typeof UnlockDrawerSchema>;
export type SaveDrawerInput = z.infer<typeof SaveDrawerSchema>;
export type DeleteDrawerInput = z.infer<typeof DeleteDrawerSchema>;
export type ExportDrawerInput = z.infer<typeof ExportDrawerSchema>;
export type ImportDrawerInput = z.infer<typeof ImportDrawerSchema>;
