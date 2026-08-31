import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { encrypt, decrypt } from './encryption';
import { EncryptedDrawer, DrawerListItem } from '../shared/types';

const DRAWER_EXT = '.clavis';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let DATA_DIR = path.join(os.homedir(), '.local', 'share', 'Clavis');

export function setDataDir(dir: string): void {
  DATA_DIR = dir;
}

export function getDataDir(): string {
  return DATA_DIR;
}

export function isValidId(id: string): boolean {
  return UUID_RE.test(id);
}

export function getDrawersPath(): string {
  return path.join(DATA_DIR, 'drawers');
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

export async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(getDrawersPath(), { recursive: true, mode: 0o700 });
  } catch (e) { console.error('ensureDataDir mkdir failed', e); }
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
      } catch (e) { console.error('listDrawers read failed', e); }
    }
    return drawers;
  } catch (e) { console.error('listDrawers readdir failed', e); return []; }
}

export async function createDrawer(
  title: string,
  password: string
): Promise<EncryptedDrawer> {
  await ensureDataDir();

  const id = uuidv4();
  const now = Date.now();
  const iconData = generateIconData(id);
  const placeholderContent = '';

  const { encryptedData, salt, iv, authTag } = await encrypt(placeholderContent, password);

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
      memory: 2 ** 16,
      parallelism: 1,
    },
  };

  await fs.writeFile(getDrawerFilePath(id), JSON.stringify(drawer, null, 2), { encoding: 'utf8', mode: 0o600 });
  return drawer;
}

export async function unlockDrawer(
  id: string,
  password: string
): Promise<{ title: string; content: string; iconData: string } | null> {
  if (!isValidId(id)) return null;
  try {
    const filePath = getDrawerFilePath(id);
    const content = await fs.readFile(filePath, 'utf8');
    const drawer: EncryptedDrawer = JSON.parse(content);

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
      password,
      kdfParams
    );

    return {
      title: drawer.title,
      content: decryptedContent,
      iconData: drawer.iconData,
    };
  } catch (e) {
    console.error('Unlock failed:', e);
    return null;
  }
}

export async function saveDrawer(
  id: string,
  password: string,
  title: string,
  content: string
): Promise<boolean> {
  if (!isValidId(id)) return false;
  try {
    const filePath = getDrawerFilePath(id);
    const fileContent = await fs.readFile(filePath, 'utf8');
    const drawer: EncryptedDrawer = JSON.parse(fileContent);

    const { encryptedData, salt, iv, authTag } = await encrypt(content, password);

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
    return true;
  } catch (e) {
    console.error('Save failed:', e);
    return false;
  }
}

export async function deleteDrawer(id: string): Promise<boolean> {
  if (!isValidId(id)) return false;
  try {
    await fs.unlink(getDrawerFilePath(id));
    return true;
  } catch (e) {
    console.error('Delete failed:', e);
    return false;
  }
}

export async function readDrawerRaw(id: string): Promise<string | null> {
  if (!isValidId(id)) return null;
  try {
    const filePath = getDrawerFilePath(id);
    return await fs.readFile(filePath, 'utf8');
  } catch (e) { console.error('readDrawerRaw failed', e); return null; }
}

export async function importDrawerRaw(fileContent: string): Promise<boolean> {
  try {
    const drawer: EncryptedDrawer = JSON.parse(fileContent);
    if (!drawer.id || !isValidId(drawer.id)) return false;
    await ensureDataDir();
    await fs.writeFile(getDrawerFilePath(drawer.id), fileContent, { encoding: 'utf8', mode: 0o600 });
    return true;
  } catch (e) { console.error('importDrawerRaw failed', e); return false; }
}
