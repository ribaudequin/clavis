import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { encrypt, decrypt, DEFAULT_MEMORY_COST, MIN_MEMORY_COST, MAX_MEMORY_COST, MIN_TIME_COST, MAX_TIME_COST, MIN_PARALLELISM, MAX_PARALLELISM } from './encryption.js';
import { logger } from './logger.js';
import { EncryptedDrawer, DrawerListItem } from '../shared/types.js';

const DRAWER_EXT = '.clavis';
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

async function migrateOldData(): Promise<void> {
  if (migrated) return;
  if (process.env.NODE_ENV === 'test') return;
  migrated = true;
  try {
    const oldDrawersPath = path.join(OLD_DATA_DIR, 'drawers');
    const stats = await fs.stat(oldDrawersPath).catch(() => null);
    if (!stats || !stats.isDirectory()) return;
    const newDrawersPath = getDrawersPath();
    await fs.mkdir(newDrawersPath, { recursive: true, mode: 0o700 });
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
      await fs.copyFile(src, dst);
      await fs.chmod(dst, 0o600);
      copied += 1;
    }
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
        const content = await fs.readFile(filePath, 'utf8');
        const drawer: EncryptedDrawer = JSON.parse(content);
        drawers.push({
          id: drawer.id,
          title: drawer.title,
          iconData: drawer.iconData,
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

  if (passwordBuffer.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const id = uuidv4();
  const now = Date.now();
  const iconData = generateIconData(id);
  const placeholderContent = '';

  const { encryptedData, salt, iv, authTag } = await encrypt(placeholderContent, passwordBuffer);
  passwordBuffer.fill(0);

  const drawer: EncryptedDrawer = {
    id,
    title,
    iconData,
    createdAt: now,
    updatedAt: now,
    encryptedData,
    salt,
    iv,
    authTag,
    keyDerivation: {
      algorithm: 'argon2id',
      iterations: 3,
      memory: DEFAULT_MEMORY_COST,
      parallelism: 4,
    },
  };

  await fs.writeFile(getDrawerFilePath(id), JSON.stringify(drawer, null, 2), { encoding: 'utf8', mode: 0o600 });
  logger.info('Drawer created', { id, titleLength: title?.length || 0 });
  return drawer;
}

export async function unlockDrawer(
  id: string,
  password: string | Buffer
): Promise<{ title: string; content: string; iconData: string } | null> {
  const passwordBuffer = Buffer.isBuffer(password) ? Buffer.from(password) : Buffer.from(password, 'utf8');
  if (!isValidId(id)) {
    passwordBuffer.fill(0);
    return null;
  }
  try {
    const filePath = getDrawerFilePath(id);
    const content = await fs.readFile(filePath, 'utf8');
    const drawer: EncryptedDrawer = JSON.parse(content);

    // SEC-006 — Re-validate KDF params against security floor AND safety cap.
    // The floor (2^16) still accepts drawers created by older app versions; the
    // cap (2^20) prevents a crafted drawer from allocating enough memory to crash
    // the native Argon2 binding. Legacy drawers (2^16) remain unlockable because
    // decryption always uses the parameters stored in the file.
    if (drawer.keyDerivation && !isKdfWithinBounds(drawer.keyDerivation)) {
      logger.warn('Unlock failed: KDF parameters out of bounds', {
        id,
        iterations: drawer.keyDerivation.iterations,
        memory: drawer.keyDerivation.memory,
        parallelism: drawer.keyDerivation.parallelism,
      });
      return null;
    }

    const kdfParams = drawer.keyDerivation ? {
      timeCost: drawer.keyDerivation.iterations,
      memoryCost: drawer.keyDerivation.memory,
      parallelism: drawer.keyDerivation.parallelism,
    } : undefined;

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
      title: drawer.title,
      content: decryptedContent,
      iconData: drawer.iconData,
    };
  } catch (e) {
    passwordBuffer.fill(0);
    logger.warn('Unlock failed', { id, error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

export async function saveDrawer(
  id: string,
  password: string | Buffer,
  title: string,
  content: string
): Promise<boolean> {
  const passwordBuffer = Buffer.isBuffer(password) ? Buffer.from(password) : Buffer.from(password, 'utf8');
  if (!isValidId(id)) {
    passwordBuffer.fill(0);
    return false;
  }
  if (passwordBuffer.length < 8) {
    passwordBuffer.fill(0);
    logger.warn('Save failed: password too short', { id });
    return false;
  }
  try {
    const filePath = getDrawerFilePath(id);
    const fileContent = await fs.readFile(filePath, 'utf8');
    const drawer: EncryptedDrawer = JSON.parse(fileContent);

    if (drawer.keyDerivation && !isKdfWithinBounds(drawer.keyDerivation)) {
      passwordBuffer.fill(0);
      logger.warn('Save failed: KDF parameters out of bounds', { id });
      return false;
    }

    // Re-encrypt using the drawer's own stored KDF parameters so the metadata
    // stays consistent with the ciphertext. Using the process defaults here
    // would silently corrupt legacy drawers (metadata says 2^16, ciphertext
    // derived with 2^18) and make them impossible to unlock afterwards.
    const kdfParams = drawer.keyDerivation
      ? {
          timeCost: drawer.keyDerivation.iterations,
          memoryCost: drawer.keyDerivation.memory,
          parallelism: drawer.keyDerivation.parallelism,
        }
      : undefined;

    const { encryptedData, salt, iv, authTag } = await encrypt(content, passwordBuffer, kdfParams);

    const updatedDrawer: EncryptedDrawer = {
      ...drawer,
      title,
      updatedAt: Date.now(),
      encryptedData,
      salt,
      iv,
      authTag,
    };

    await fs.writeFile(filePath, JSON.stringify(updatedDrawer, null, 2), { encoding: 'utf8', mode: 0o600 });
    passwordBuffer.fill(0);
    logger.info('Drawer saved', { id, titleLength: title?.length || 0 });
    return true;
  } catch (e) {
    passwordBuffer.fill(0);
    logger.error('Save failed', { id, error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

export async function deleteDrawer(id: string): Promise<boolean> {
  if (!isValidId(id)) return false;
  try {
    await fs.unlink(getDrawerFilePath(id));
    logger.info('Drawer deleted', { id });
    return true;
  } catch (e) {
    logger.error('Delete failed', { id, error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

export async function readDrawerRaw(id: string): Promise<string | null> {
  if (!isValidId(id)) return null;
  try {
    const filePath = getDrawerFilePath(id);
    return await fs.readFile(filePath, 'utf8');
  } catch (e) {
    logger.error('readDrawerRaw failed', { id, error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

const MAX_IMPORT_FILE_SIZE = 11_000_000; // ~11MB; slightly above MAX_DECRYPTED_SIZE (10MB) to allow JSON overhead

export async function importDrawerRaw(fileContent: string): Promise<boolean> {
  try {
    // DOS-01: file size cap
    if (fileContent.length > MAX_IMPORT_FILE_SIZE) {
      logger.warn('importDrawerRaw: file content exceeds max size', { size: fileContent.length });
      return false;
    }

    const drawer: EncryptedDrawer = JSON.parse(fileContent);
    if (!drawer.id || !isValidId(drawer.id)) {
      logger.warn('importDrawerRaw: invalid drawer ID', {});
      return false;
    }

    // VALID-01: validate required encrypted fields
    if (!drawer.encryptedData || typeof drawer.encryptedData !== 'string' ||
        !drawer.salt || typeof drawer.salt !== 'string' ||
        !drawer.iv || typeof drawer.iv !== 'string' ||
        !drawer.authTag || typeof drawer.authTag !== 'string') {
      logger.warn('importDrawerRaw: missing or invalid encrypted fields', { id: drawer.id });
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

    // OVERWRITE-01: check existing drawer
    const filePath = getDrawerFilePath(drawer.id);
    try {
      await fs.access(filePath);
      logger.warn('importDrawerRaw: drawer already exists — overwrite blocked', { id: drawer.id });
      return false;
    } catch {
      // file does not exist — safe to import
    }

    await ensureDataDir();
    await fs.writeFile(filePath, fileContent, { encoding: 'utf8', mode: 0o600 });
    logger.info('Drawer imported', { id: drawer.id });
    return true;
  } catch (e) {
    logger.error('importDrawerRaw failed', { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}
