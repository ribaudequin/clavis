import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { encrypt, decrypt, MAX_DECRYPTED_SIZE, DEFAULT_MEMORY_COST, MIN_MEMORY_COST, MAX_MEMORY_COST, MIN_TIME_COST, MAX_TIME_COST, MIN_PARALLELISM, MAX_PARALLELISM, DEFAULT_TIME_COST, DEFAULT_PARALLELISM, deriveKey, ContentTooLargeError, CiphertextTooLargeError, KdfBackendUnavailableError, type KDFParams } from './encryption.js';
import { logger } from './logger.js';
import { EncryptedDrawer, DrawerListItem } from '../shared/types.js';
import { EncryptedDrawerSchema, type EncryptedDrawerMetadata } from './validation.js';
import { isPasswordCompliant, describePasswordPolicy } from '../shared/password-policy.js';

const DRAWER_EXT = '.clavis';

// DATA-01 — Per-drawer write lock: prevents concurrent saves/deletes/imports
// on the same drawer from losing the newer edit (read-modify-write race).
const drawerLocks = new Map<string, Promise<void>>();

async function withDrawerLock<T>(id: string, op: () => Promise<T>): Promise<T> {
  while (drawerLocks.has(id)) await drawerLocks.get(id)!;
  const p = op();
  drawerLocks.set(id, p.then(() => {}, () => {}));
  try { return await p; } finally { drawerLocks.delete(id); }
}

// HYG-22 — This used to rename the live file to `<id>.clavis.prev` and only then move
// the replacement in, so between the two renames there was no .clavis at the path at
// all: a kill or a power cut in that window destroyed the drawer's only file, and a
// rename that failed left it at .prev, which nothing in the app ever read back. One
// rename(tmp, filePath) replaces the live inode in a single metadata operation, so the
// path is never absent and never holds a half-written file.
async function atomicWrite(filePath: string, data: string): Promise<void> {
  const dir = path.dirname(filePath);
  // Not Date.now(): two saves of the same drawer inside one millisecond resolved to the same
  // temp path, so their writes interleaved and one of them renamed a half-written file over
  // the good one — the exact corruption this function exists to prevent, reintroduced through
  // its own staging step.
  const tmp = path.join(dir, `.tmp-${crypto.randomUUID()}-${path.basename(filePath)}`);
  // mode is honoured at creation and ignored on an existing inode; the temp file is
  // new on every call and is the inode that gets renamed over the live one, so this
  // is the single write in the store where 0o600 actually lands on the .clavis.
  await fs.writeFile(tmp, data, { encoding: 'utf8', mode: 0o600 });
  const fd = await fs.open(tmp, 'r+');
  try { await fd.sync(); } finally { await fd.close(); }
  try {
    await fs.rename(tmp, filePath);
  } catch (e) {
    // A refused save must not leave a full copy of a drawer sitting in the drawers
    // directory: listDrawers() filters on the .clavis suffix, so a stray .tmp- file is
    // invisible to it and would sit there for the life of the profile.
    await fs.unlink(tmp).catch(() => {});
    throw e;
  }
  // The rename edits the directory, not the temp file, so flushing the temp file's data
  // does not make the new entry durable: on a power cut the whole write can be undone
  // regardless, and the barrier that prevents it is the directory's own fsync. Windows
  // offers no equivalent — open(dir) on a directory fails and FlushFileBuffers refuses a
  // directory handle — so there the rename's own journal entry is the strongest
  // guarantee obtainable. Propagating that refusal would report a save that did land as
  // a failed one, which is the worse outcome, so the platform failure is swallowed.
  const dfd = await fs.open(dir, 'r').catch(() => null);
  if (dfd) {
    try { await dfd.sync(); } catch { /* platform cannot fsync a directory */ } finally { await dfd.close(); }
  }
}

export class DrawerAlreadyExistsError extends Error {
  constructor(id: string) {
    super(`Drawer with ID ${id} already exists — overwrite blocked`);
    this.name = 'DrawerAlreadyExistsError';
  }
}

export class FileTooLargeError extends Error {
  constructor() {
    super('File content exceeds max size');
    this.name = 'FileTooLargeError';
  }
}

// SAV-02 — unlockDrawer used to return a bare null for six unrelated causes, and the
// IPC layer collapsed all six into "Incorrect password or drawer not found" while
// counting every one of them against the rate limiter. A drawer that is oversized or
// corrupt — with the correct password — walked the user into the 1s/5s/30s lockout
// for a guess that was never wrong.
export type UnlockFailureReason =
  | 'invalid_id'
  | 'read_failed'
  | 'parse_failed'
  | 'corrupt_metadata'
  | 'kdf_out_of_bounds'
  | 'kdf_backend_unavailable'
  | 'too_large'
  | 'wrong_password';

export interface UnlockedDrawer {
  title: string;
  content: string;
  iconData: string;
}

export type UnlockResult =
  | { ok: true; data: UnlockedDrawer }
  | { ok: false; reason: UnlockFailureReason };

// SAV-03 — saveDrawer's bare `false` was what made encrypt()'s refusal invisible:
// every failure collapsed into "Failed to save drawer (invalid ID or password)", so
// a note that was too large to store reported a password problem.
//
// This union once carried 'password_too_weak' as well, and two tests asserted it. It
// was unreachable: saveDrawer never consulted the password policy and never will,
// because a save re-uses the password that already opens the drawer and there is no
// change-password channel to supply a new one (reason recorded on SaveDrawerSchema).
export type SaveFailureReason =
  | 'invalid_id'
  | 'wrong_password'
  | 'kdf_out_of_bounds'
  | 'kdf_backend_unavailable'
  | 'content_too_large'
  | 'too_large'
  | 'write_failed';

export type SaveResult = { ok: true } | { ok: false; reason: SaveFailureReason };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let DATA_DIR: string | null = null;

function resolveDataDir(): string {
  if (DATA_DIR) return DATA_DIR;
  const { app } = require('electron');
  DATA_DIR = app.getPath('userData');
  return DATA_DIR as string;
}

export function setDataDir(dir: string): void {
  DATA_DIR = dir;
}

export function getDataDir(): string {
  return resolveDataDir();
}

export function isValidId(id: string): boolean {
  return UUID_RE.test(id);
}

// KDF-01/SEC-006 — Validate stored/imported Argon2 parameters against both a
// security floor (reject trivially weak params) and a safety cap (reject params
// that would allocate enough memory to crash the native Argon2 binding).
export function isKdfWithinBounds(kdf: {
  iterations?: unknown;
  memory?: unknown;
  parallelism?: unknown;
}): boolean {
  return (
    typeof kdf.iterations === 'number' &&
    kdf.iterations >= MIN_TIME_COST &&
    kdf.iterations <= MAX_TIME_COST &&
    typeof kdf.memory === 'number' &&
    kdf.memory >= MIN_MEMORY_COST &&
    kdf.memory <= MAX_MEMORY_COST &&
    typeof kdf.parallelism === 'number' &&
    kdf.parallelism >= MIN_PARALLELISM &&
    kdf.parallelism <= MAX_PARALLELISM
  );
}

export function getDrawersPath(): string {
  return path.join(resolveDataDir(), 'drawers');
}

// P0.12/SAV-01 — AES-GCM ciphertext is exactly as long as its plaintext (the 16-byte
// tag is stored separately, not appended), so MAX_DECRYPTED_SIZE is also the longest
// ciphertext any drawer Clavis writes can carry. Checked on the hex string rather
// than on a decoded buffer: the decode is a second allocation of the same size, and
// Node's hex decoder stops at the first invalid pair, so floor(len / 2) is an exact
// upper bound. Note the unit — Zod's .max() counts code points, not bytes, so
// content that passes validation can still be several times this in UTF-8.
function isCiphertextOverCap(encryptedDataHex: string): boolean {
  return Math.floor(encryptedDataHex.length / 2) > MAX_DECRYPTED_SIZE;
}

export function getDrawerFilePath(id: string): string {
  return path.join(getDrawersPath(), `${id}${DRAWER_EXT}`);
}

export function generateIconData(seed: string): string {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const colors: string[] = [];
  for (let i = 0; i < 9; i++) {
    const r = parseInt(hash.slice(i * 6, i * 6 + 2), 16);
    const g = parseInt(hash.slice(i * 6 + 2, i * 6 + 4), 16);
    const b = parseInt(hash.slice(i * 6 + 4, i * 6 + 6), 16);
    colors.push(`rgb(${r},${g},${b})`);
  }
  return JSON.stringify(colors);
}

const OLD_DATA_DIR = path.join(os.homedir(), '.local', 'share', 'Clavis');
let migrated = false;

// Block B — The copy is a read with no guard of its own: fs.copyFile moves the
// whole file whatever its size, so the measurement has to happen before it, not
// after. MAX_DRAWER_FILE_SIZE is the shared ceiling every .clavis is held to on
// every other path; an over-cap file that reached the new data dir through the
// migration would be a drawer no read path will touch, copied once per startup.
// Extracted from migrateOldData so the guard is testable with temp directories —
// the real migration is gated behind NODE_ENV !== 'test' and a module-load path.
export async function migrateDrawersFrom(oldDrawersPath: string, newDrawersPath: string): Promise<number> {
  const files = await fs.readdir(oldDrawersPath);
  let copied = 0;
  for (const file of files) {
    if (!file.endsWith(DRAWER_EXT)) continue;
    const src = path.join(oldDrawersPath, file);
    const dst = path.join(newDrawersPath, file);
    // Copy only drawers that don't already exist in the new location, so the
    // migration is idempotent and never overwrites newer data. An existing but
    // empty target directory (created by an earlier run) no longer blocks it.
    const dstExists = await fs
      .access(dst)
      .then(() => true)
      .catch(() => false);
    if (dstExists) continue;
    const srcStat = await fs.stat(src).catch(() => null);
    if (!srcStat) continue;
    if (srcStat.size > MAX_DRAWER_FILE_SIZE) {
      logger.warn('Migration skipped: file exceeds max size', { file, size: srcStat.size });
      continue;
    }
    await fs.copyFile(src, dst);
    await fs.chmod(dst, 0o600);
    copied += 1;
  }
  return copied;
}

// OLD_DATA_DIR is derived from os.homedir() and has no relationship to userData, so a
// run with --user-data-dir pointed anywhere else would be seeded with the real user's
// legacy drawers: measured on this box, a "clean" test profile came up holding 10 of
// them. An overridden userData means the run is not operating on the real profile, so
// the migration must not run at all.
function userDataWasOverridden(): boolean {
  try {
    const { app } = require('electron');
    return app.commandLine.hasSwitch('user-data-dir');
  } catch {
    return false;
  }
}

async function migrateOldData(): Promise<void> {
  if (migrated) return;
  if (process.env.NODE_ENV === 'test') return;
  migrated = true;
  if (userDataWasOverridden()) {
    logger.info('Skipping legacy data migration: userData was overridden');
    return;
  }
  try {
    const oldDrawersPath = path.join(OLD_DATA_DIR, 'drawers');
    const stats = await fs.stat(oldDrawersPath).catch(() => null);
    if (!stats || !stats.isDirectory()) return;
    const newDrawersPath = getDrawersPath();
    await fs.mkdir(newDrawersPath, { recursive: true, mode: 0o700 });
    const copied = await migrateDrawersFrom(oldDrawersPath, newDrawersPath);
    if (copied > 0) {
      logger.info('Migrated old drawers to new userData path', { count: copied });
    }
  } catch (e) {
    logger.warn('Migration of old data failed', { error: e instanceof Error ? e.message : String(e) });
  }
}

export async function ensureDataDir(): Promise<void> {
  await migrateOldData();
  try {
    await fs.mkdir(getDrawersPath(), { recursive: true, mode: 0o700 });
    // SEC-03 — Tighten existing directory (mkdir with mode only applies to creation)
    try { await fs.chmod(getDrawersPath(), 0o700); } catch {}
    logger.debug('Data directory ensured', { path: getDrawersPath() });
  } catch (e) {
    logger.error('ensureDataDir mkdir failed', { error: e instanceof Error ? e.message : String(e) });
  }
}

export async function listDrawers(): Promise<DrawerListItem[]> {
  await ensureDataDir();

  try {
    const files = await fs.readdir(getDrawersPath());
    const drawerFiles = files.filter((f) => f.endsWith(DRAWER_EXT));

    const drawers: DrawerListItem[] = [];
    for (const file of drawerFiles) {
      const filePath = path.join(getDrawersPath(), file);
      try {
        // Block B — Refuse before allocating. This read needs no user gesture
        // and fires on every app open, and HomeScreen re-runs it after every
        // save, delete, import and back-navigation, so an unbounded read here is
        // a DoS the user triggers by dropping one file in the directory. The
        // stat is one syscall; the read it refuses costs the file's size in
        // memory on every single listing.
        const stat = await fs.stat(filePath);
        if (stat.size > MAX_DRAWER_FILE_SIZE) {
          logger.error('listDrawers skipped file above max size', { file, size: stat.size });
          continue;
        }
        const content = await fs.readFile(filePath, 'utf8');
        // SEC-07 — Nothing from the file reaches the renderer unvalidated: a title that
        // is not a string crashes React, an unbounded iconData freezes it, and the
        // schema is also what enforces the SEC-05 crypto-field widths on this path.
        const parsed = EncryptedDrawerSchema.safeParse(JSON.parse(content));
        if (!parsed.success) {
          logger.error('listDrawers skipped invalid metadata', {
            file,
            reason: parsed.error.issues[0]?.message ?? 'invalid drawer metadata',
          });
          continue;
        }
        // The filename is what getDrawerFilePath() will look for. An internal id that
        // disagrees would list an entry no unlock or delete call can reach.
        const fileId = path.basename(file, DRAWER_EXT);
        if (parsed.data.id !== fileId) {
          logger.error('listDrawers skipped drawer whose id does not match its filename', {
            file,
            id: parsed.data.id,
          });
          continue;
        }
        drawers.push({
          id: parsed.data.id,
          title: parsed.data.title,
          iconData: parsed.data.iconData,
        });
      } catch (e) {
        logger.error('listDrawers read failed', { file, error: e instanceof Error ? e.message : String(e) });
      }
    }
    logger.debug('Drawers listed', { count: drawers.length });
    return drawers;
  } catch (e) {
    logger.error('listDrawers readdir failed', { error: e instanceof Error ? e.message : String(e) });
    return [];
  }
}

export async function createDrawer(
  title: string,
  password: string | Buffer
): Promise<EncryptedDrawer> {
  const passwordBuffer = Buffer.isBuffer(password) ? Buffer.from(password) : Buffer.from(password, 'utf8');
  await ensureDataDir();

  // Defence in depth, not the enforcement point: CreateDrawerSchema already applies the
  // policy, so on the IPC path this is unreachable. It is kept because store.ts is
  // exported and callable directly — a caller with no schema in front of it (a future
  // channel, a script, a test) would otherwise create a drawer the create schema would
  // have refused. The wording is the policy module's, so the log cannot disagree with
  // the schema.
  if (!isPasswordCompliant(password)) {
    passwordBuffer.fill(0);
    throw new Error(describePasswordPolicy());
  }

  const id = uuidv4();
  const now = Date.now();
  const iconData = generateIconData(id);
  const placeholderContent = '';

  let encrypted: Awaited<ReturnType<typeof encrypt>>;
  try {
    encrypted = await encrypt(placeholderContent, passwordBuffer);
  } finally {
    passwordBuffer.fill(0);
  }

  const drawer: EncryptedDrawer = {
    id,
    title,
    iconData,
    createdAt: now,
    updatedAt: now,
    encryptedData: encrypted.encryptedData,
    salt: encrypted.salt,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    keyDerivation: {
      algorithm: encrypted.algorithm,
      iterations: 3,
      memory: DEFAULT_MEMORY_COST,
      parallelism: 4,
    },
  };

  await atomicWrite(getDrawerFilePath(id), JSON.stringify(drawer, null, 2));
  logger.info('Drawer created', { id, titleLength: title?.length || 0 });
  return drawer;
}

// P0.11 — Constant-time comparison: dummy derivation to prevent timing leaks
// when drawer doesn't exist, ID is invalid, or KDF params are out of bounds.
async function dummyDerive(passwordBuffer: Buffer): Promise<void> {
  try {
    const salt = crypto.randomBytes(16);
    const dummyPass = Buffer.from(passwordBuffer.toString('utf8'), 'utf8');
    await deriveKey(dummyPass, salt, {
      timeCost: DEFAULT_TIME_COST,
      memoryCost: DEFAULT_MEMORY_COST,
      parallelism: DEFAULT_PARALLELISM,
    });
  } catch {
    // Intentionally ignore errors from dummy derivation
  }
}

// SEC-01 — The backend stored in the file has to reach deriveKey, not just sit in the
// metadata. Files created before the field existed carry no value; for those, undefined
// means "whatever this build supports", which is the only behaviour they ever had. A
// value this app wrote is one of the two, so anything else is treated the same as
// missing rather than passed through.
interface StoredKeyDerivation {
  algorithm?: string;
  iterations: number;
  memory: number;
  parallelism: number;
}

function storedKdfParams(drawer: { keyDerivation?: StoredKeyDerivation | null }): KDFParams | undefined {
  if (!drawer.keyDerivation) return undefined;
  const algorithm = drawer.keyDerivation.algorithm;
  return {
    algorithm: algorithm === 'argon2id' || algorithm === 'scrypt' ? algorithm : undefined,
    timeCost: drawer.keyDerivation.iterations,
    memoryCost: drawer.keyDerivation.memory,
    parallelism: drawer.keyDerivation.parallelism,
  };
}

export async function unlockDrawer(
  id: string,
  password: string | Buffer
): Promise<UnlockResult> {
  const passwordBuffer = Buffer.isBuffer(password) ? Buffer.from(password) : Buffer.from(password, 'utf8');
  if (!isValidId(id)) {
    await dummyDerive(passwordBuffer);
    passwordBuffer.fill(0);
    return { ok: false, reason: 'invalid_id' };
  }

  // SAV-02 — The read and the parse are separated from the decryption below so that
  // "the file is gone" and "the file is not JSON" stop reporting themselves as a
  // wrong password. Every branch still pays the dummy derivation.
  const filePath = getDrawerFilePath(id);
  let content: string;
  try {
    // Block B — Measure before allocating. A drawer file over the shared
    // ceiling is refused here rather than read and measured afterwards: the
    // refusal costs one stat, the old behaviour cost the file's size in memory
    // on every unlock attempt. The dummy derivation keeps the timing identical
    // to every other pre-decryption refusal.
    const fileStat = await fs.stat(filePath);
    if (fileStat.size > MAX_DRAWER_FILE_SIZE) {
      await dummyDerive(passwordBuffer);
      passwordBuffer.fill(0);
      logger.warn('Unlock refused: drawer file exceeds max size', {
        id,
        size: fileStat.size,
      });
      return { ok: false, reason: 'too_large' };
    }
    content = await fs.readFile(filePath, 'utf8');
  } catch (e) {
    await dummyDerive(passwordBuffer);
    passwordBuffer.fill(0);
    logger.warn('Unlock failed: drawer file unreadable', {
      id,
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, reason: 'read_failed' };
  }

  let drawer: EncryptedDrawerMetadata;
  try {
    const parsed = EncryptedDrawerSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      // SEC-05/SEC-07 — Validate before touching keyDerivation or any crypto field.
      // A malformed IV, title or iconData is damage to the file, not a guess at the
      // password, so it must not walk the user into the rate limiter.
      await dummyDerive(passwordBuffer);
      passwordBuffer.fill(0);
      logger.warn('Unlock failed: drawer metadata is corrupt', {
        id,
        reason: parsed.error.issues[0]?.message ?? 'invalid drawer metadata',
      });
      return { ok: false, reason: 'corrupt_metadata' };
    }
    drawer = parsed.data;
  } catch (e) {
    await dummyDerive(passwordBuffer);
    passwordBuffer.fill(0);
    logger.warn('Unlock failed: drawer file is not valid JSON', {
      id,
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, reason: 'parse_failed' };
  }

  try {
    // SEC-006 — Re-validate KDF params against security floor AND safety cap.
    // The floor (2^16) still accepts drawers created by older app versions; the
    // cap (2^20) prevents a crafted drawer from allocating enough memory to crash
    // the native Argon2 binding. SEC-01 — the stored backend travels with the cost
    // parameters into deriveKey, so a scrypt drawer opens on an argon2 build and a
    // drawer that needs argon2 fails loudly instead of being tried with scrypt.
    if (drawer.keyDerivation && !isKdfWithinBounds(drawer.keyDerivation)) {
      await dummyDerive(passwordBuffer);
      passwordBuffer.fill(0);
      logger.warn('Unlock failed: KDF parameters out of bounds', {
        id,
        iterations: drawer.keyDerivation.iterations,
        memory: drawer.keyDerivation.memory,
        parallelism: drawer.keyDerivation.parallelism,
      });
      return { ok: false, reason: 'kdf_out_of_bounds' };
    }

    const kdfParams = storedKdfParams(drawer);

    // P0.12 — Size check before decrypt. AES-GCM ciphertext is exactly as long as
    // the plaintext (the 16-byte tag is returned separately, not appended), and
    // decrypt() itself refuses any plaintext above MAX_DECRYPTED_SIZE, so that is
    // also the longest ciphertext any drawer Clavis writes can carry. This compared
    // against MAX_DRAWER_FILE_SIZE, which counts characters of the JSON file: the
    // wrong unit, and so far above every legitimate payload that it could not fire.
    if (isCiphertextOverCap(drawer.encryptedData)) {
      await dummyDerive(passwordBuffer);
      passwordBuffer.fill(0);
      logger.warn('Unlock failed: encrypted file exceeds max size', {
        id,
        size: Math.floor(drawer.encryptedData.length / 2),
      });
      return { ok: false, reason: 'too_large' };
    }

    const decryptedContent = await decrypt(
      drawer.encryptedData,
      drawer.salt,
      drawer.iv,
      drawer.authTag,
      passwordBuffer,
      kdfParams
    );

    passwordBuffer.fill(0);
    logger.info('Drawer unlocked', { id });
    return {
      ok: true,
      data: {
        title: drawer.title,
        content: decryptedContent,
        iconData: drawer.iconData,
      },
    };
  } catch (e) {
    // An AES-GCM failure is the only thing that can reach here: the key derivation
    // and the auth tag. That is the guess, and the only guess.
    await dummyDerive(passwordBuffer);
    passwordBuffer.fill(0);
    logger.warn('Unlock failed', { id, error: e instanceof Error ? e.message : String(e) });
    return { ok: false, reason: 'wrong_password' };
  }
}

export async function saveDrawer(
  id: string,
  password: string | Buffer,
  title: string,
  content: string
): Promise<SaveResult> {
  return withDrawerLock(id, async () => {
    const passwordBuffer = Buffer.isBuffer(password) ? Buffer.from(password) : Buffer.from(password, 'utf8');
  if (!isValidId(id)) {
    passwordBuffer.fill(0);
    return { ok: false, reason: 'invalid_id' };
  }
  try {
    const filePath = getDrawerFilePath(id);
    // HYG-7 — defensive copy: force a new primitive so a mutable reference
    // passed by the renderer cannot affect validation after this point.
    const contentSafe = String(content);
    // Block B — Same refusal as the unlock path, on the write side: a drawer
    // already on disk above the shared ceiling must not be read into memory
    // just to be measured afterwards. Without this, saving over a corrupted or
    // hand-crafted drawer reads an unbounded file first.
    const fileStat = await fs.stat(filePath);
    if (fileStat.size > MAX_DRAWER_FILE_SIZE) {
      passwordBuffer.fill(0);
      logger.warn('Save refused: drawer file exceeds max size', { id, size: fileStat.size });
      return { ok: false, reason: 'too_large' };
    }
    const fileContent = await fs.readFile(filePath, 'utf8');
    const drawer: EncryptedDrawer = JSON.parse(fileContent);

    if (drawer.keyDerivation && !isKdfWithinBounds(drawer.keyDerivation)) {
      passwordBuffer.fill(0);
      logger.warn('Save failed: KDF parameters out of bounds', { id });
      return { ok: false, reason: 'kdf_out_of_bounds' };
    }

    // Re-encrypt using the drawer's own stored KDF parameters so the metadata
    // stays consistent with the ciphertext. Using the process defaults here
    // would silently corrupt legacy drawers (metadata says 2^16, ciphertext
    // derived with 2^18) and make them impossible to unlock afterwards.
    //
    // SEC-01 — This includes the backend. Re-encrypting a scrypt drawer with argon2
    // while leaving `algorithm: 'scrypt'` in the file produced a drawer that the
    // metadata itself described incorrectly, and no build could open afterwards.
    const kdfParams = storedKdfParams(drawer);

    // SEC-04 — Verify current password before overwriting ciphertext.
    try {
      await decrypt(drawer.encryptedData, drawer.salt, drawer.iv, drawer.authTag, passwordBuffer, kdfParams);
    } catch (e) {
      if (e instanceof KdfBackendUnavailableError) {
        passwordBuffer.fill(0);
        logger.warn('Save refused: KDF backend unavailable', { id, backend: e.algorithm });
        return { ok: false, reason: 'kdf_backend_unavailable' };
      }
      // P0.12 — A stored ciphertext above the ceiling is damaged file data, not a
      // failed password guess: decrypt() now refuses it before decoding, and this
      // catch used to turn every non-KDF failure into 'wrong_password'.
      if (e instanceof CiphertextTooLargeError) {
        passwordBuffer.fill(0);
        logger.warn('Save refused: stored ciphertext exceeds max size', { id });
        return { ok: false, reason: 'too_large' };
      }
      passwordBuffer.fill(0);
      logger.warn('Save refused: wrong password', { id });
      return { ok: false, reason: 'wrong_password' };
    }

    // SAV-03 — Kept distinct from the catch below: a refusal to store is not a
    // write failure, and the caller has to be able to say which one happened.
    let encrypted: Awaited<ReturnType<typeof encrypt>>;
    try {
      encrypted = await encrypt(contentSafe, passwordBuffer, kdfParams);
    } catch (e) {
      if (e instanceof ContentTooLargeError) {
        passwordBuffer.fill(0);
        logger.warn('Save failed: content exceeds max size', { id });
        return { ok: false, reason: 'content_too_large' };
      }
      if (e instanceof KdfBackendUnavailableError) {
        passwordBuffer.fill(0);
        logger.warn('Save failed: KDF backend unavailable', { id, backend: e.algorithm });
        return { ok: false, reason: 'kdf_backend_unavailable' };
      }
      throw e;
    }
    const { encryptedData, salt, iv, authTag } = encrypted;

    const updatedDrawer: EncryptedDrawer = {
      ...drawer,
      title,
      updatedAt: Date.now(),
      encryptedData,
      salt,
      iv,
      authTag,
      // SEC-01 — Keep the recorded backend equal to the one that just derived the key.
      // Spreading `...drawer` alone preserved the old label even when the KDF changed.
      // Files predating the field have no keyDerivation at all; do not invent a
      // partial one, or isKdfWithinBounds would start rejecting them on the next open.
      keyDerivation: drawer.keyDerivation
        ? { ...drawer.keyDerivation, algorithm: encrypted.algorithm }
        : drawer.keyDerivation,
    };

    await atomicWrite(filePath, JSON.stringify(updatedDrawer, null, 2));
    passwordBuffer.fill(0);
    logger.info('Drawer saved', { id, titleLength: title?.length || 0 });
    return { ok: true };
  } catch (e) {
    passwordBuffer.fill(0);
    logger.error('Save failed', { id, error: e instanceof Error ? e.message : String(e) });
    return { ok: false, reason: 'write_failed' };
  }
  });
}

export async function deleteDrawer(id: string): Promise<boolean> {
  if (!isValidId(id)) return false;
  // DATA-01 — Same critical section as saveDrawer/import: a delete that lands between a
  // save's read and its rename would otherwise be undone by the save (the drawer reappears).
  return withDrawerLock(id, async () => {
    try {
      await fs.unlink(getDrawerFilePath(id));
      logger.info('Drawer deleted', { id });
      return true;
    } catch (e) {
      logger.error('Delete failed', { id, error: e instanceof Error ? e.message : String(e) });
      return false;
    }
  });
}

export async function readDrawerRaw(id: string): Promise<string | null> {
  if (!isValidId(id)) return null;
  try {
    const filePath = getDrawerFilePath(id);
    const stat = await fs.stat(filePath);
    if (stat.size > MAX_DRAWER_FILE_SIZE) {
      logger.error('readDrawerRaw skipped file above max size', { id, size: stat.size });
      return null;
    }
    return await fs.readFile(filePath, 'utf8');
  } catch (e) {
    logger.error('readDrawerRaw failed', { id, error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

// The hex payload costs two characters per byte of text, so a drawer carrying the
// maximum permitted text writes a file of about twice MAX_DECRYPTED_SIZE. This used
// to be an independent 11 000 000 whose comment claimed it sat "slightly above
// MAX_DECRYPTED_SIZE" — arithmetic that holds for base64, not hex — so anything over
// ~5.5 MB exported cleanly and then failed to import. Deriving the cap is what stops
// the two constants drifting apart again.
// IMPORT_ENVELOPE_OVERHEAD covers the JSON around the payload. Measured against the
// exact envelope createDrawer/saveDrawer write, payload held constant and subtracted:
// 393 characters for a 1-character title, 647 for 255 ASCII, 902 for 255 emoji, and
// 1 922 for 255 characters of U+0001 (which JSON escapes to six characters each).
// 4 KB leaves 2 174 characters of headroom over that worst case — thin, so the file
// is written with JSON.stringify(drawer, null, 2) and the indentation is part of the
// cost. iconData is derived from the drawer id, so it does not scale with input.
const IMPORT_ENVELOPE_OVERHEAD = 4_096;
// Every .clavis file, on every path: the read guards below and the import check both
// measure the same file shape, so they share one ceiling — a file we would refuse to
// import must not be read into memory by the list, the unlock, the save or the export.
//
// A4 — the derivation keeps the relationship correct by construction, and the absolute
// ceiling pins the DoS bound so that raising MAX_DECRYPTED_SIZE cannot move it. The two
// are equal today (10 000 000 * 2 + 4 096 === 20 004 096), so the Math.min is currently a
// no-op. Do not simplify it away on that basis: it becomes load-bearing the moment the
// text limit rises, which is the exact scenario the ceiling exists for.
const ABSOLUTE_IMPORT_CEILING = 20_004_096;
export const MAX_DRAWER_FILE_SIZE = Math.min(
  MAX_DECRYPTED_SIZE * 2 + IMPORT_ENVELOPE_OVERHEAD,
  ABSOLUTE_IMPORT_CEILING
);

export async function importDrawerRaw(fileContent: string): Promise<boolean> {
  try {
    // DOS-01: file size cap
    if (fileContent.length > MAX_DRAWER_FILE_SIZE) {
      logger.warn('importDrawerRaw: file content exceeds max size', { size: fileContent.length });
      throw new FileTooLargeError();
    }

    const drawer = EncryptedDrawerSchema.parse(JSON.parse(fileContent));
    if (!drawer.id || !isValidId(drawer.id)) {
      logger.warn('importDrawerRaw: invalid drawer ID', {});
      return false;
    }

    // VALID-01 — EncryptedDrawerSchema has already checked every crypto field for type,
    // width and hex shape. encryptedData is deliberately allowed to be empty: empty
    // content encrypts to an empty ciphertext, which is what every empty drawer stores.

    // SAV-01 — The file-size cap above is measured in characters, so it admits a
    // payload of up to twice MAX_DECRYPTED_SIZE *bytes*. Such a drawer imports
    // cleanly and is then refused at unlock forever, so the ciphertext length has
    // to be checked where the drawer is admitted. Node's hex decoder stops at the
    // first invalid pair, so the decoded length never exceeds floor(len / 2).
    if (isCiphertextOverCap(drawer.encryptedData)) {
      logger.warn('importDrawerRaw: ciphertext exceeds max size', {
        id: drawer.id,
        bytes: Math.floor(drawer.encryptedData.length / 2),
      });
      return false;
    }

    // KDF-01: validate KDF parameters with minimum floors
    const kdf = drawer.keyDerivation;
    if (!kdf || typeof kdf !== 'object') {
      logger.warn('importDrawerRaw: missing keyDerivation', { id: drawer.id });
      return false;
    }
    // KDF-01 — Validate KDF parameters against security floor and safety cap.
    if (!isKdfWithinBounds(kdf)) {
      logger.warn('importDrawerRaw: KDF parameters out of bounds', {
        id: drawer.id,
        iterations: kdf.iterations,
        memory: kdf.memory,
        parallelism: kdf.parallelism,
      });
      return false;
    }

    // OVERWRITE-01 / DATA-01 — Check and write inside the same per-drawer critical section
    // as save and delete: two concurrent imports of one id could both pass the access()
    // test, and a save in flight would otherwise race this write.
    return await withDrawerLock(drawer.id, async () => {
      const filePath = getDrawerFilePath(drawer.id);
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      if (fileExists) {
        logger.warn('importDrawerRaw: drawer already exists — overwrite blocked', { id: drawer.id });
        throw new DrawerAlreadyExistsError(drawer.id);
      }

      await ensureDataDir();
      await atomicWrite(filePath, fileContent);
      logger.info('Drawer imported', { id: drawer.id });
      return true;
    });
  } catch (e) {
    if (e instanceof DrawerAlreadyExistsError || e instanceof FileTooLargeError) {
      throw e; // Propagate to ipc-handlers for explicit message
    }
    logger.error('importDrawerRaw failed', { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}
