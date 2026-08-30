import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { encrypt, decrypt } from './encryption';
import { EncryptedDrawer, DrawerListItem } from '../shared/types';

const DATA_DIR = path.join(os.homedir(), '.local', 'share', 'Clavis');
const DRAWER_EXT = '.clavis';

function getDrawersPath(): string {
  return path.join(DATA_DIR, 'drawers');
}

function getDrawerFilePath(id: string): string {
  return path.join(getDrawersPath(), `${id}${DRAWER_EXT}`);
}

function generateIconData(seed: string): string {
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

async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(getDrawersPath(), { recursive: true });
  } catch {}
}

async function listDrawers(): Promise<DrawerListItem[]> {
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
      } catch {}
    }
    return drawers;
  } catch {
    return [];
  }
}

async function createDrawer(
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

  await fs.writeFile(getDrawerFilePath(id), JSON.stringify(drawer, null, 2), 'utf8');
  return drawer;
}

async function unlockDrawer(
  id: string,
  password: string
): Promise<{ title: string; content: string; iconData: string } | null> {
  try {
    const filePath = getDrawerFilePath(id);
    const content = await fs.readFile(filePath, 'utf8');
    const drawer: EncryptedDrawer = JSON.parse(content);

    const decryptedContent = await decrypt(
      drawer.encryptedData,
      drawer.salt,
      drawer.iv,
      drawer.authTag,
      password
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

async function saveDrawer(
  id: string,
  password: string,
  title: string,
  content: string
): Promise<boolean> {
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

    await fs.writeFile(filePath, JSON.stringify(updatedDrawer, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Save failed:', e);
    return false;
  }
}

async function deleteDrawer(id: string): Promise<boolean> {
  try {
    await fs.unlink(getDrawerFilePath(id));
    return true;
  } catch (e) {
    console.error('Delete failed:', e);
    return false;
  }
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      },
    titleBarStyle: 'hidden',
    resizable: true,
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

function handleIPC(): void {
  ipcMain.handle('list-drawers', async () => await listDrawers());
  ipcMain.handle('create-drawer', async (_e, title: string, password: string) =>
    await createDrawer(title, password)
  );
  ipcMain.handle('unlock-drawer', async (_e, id: string, password: string) =>
    await unlockDrawer(id, password)
  );
  ipcMain.handle('save-drawer', async (_e, id: string, password: string, title: string, content: string) =>
    await saveDrawer(id, password, title, content)
  );
  ipcMain.handle('delete-drawer', async (_e, id: string) =>
    await deleteDrawer(id)
  );
  ipcMain.handle('export-drawer', async (_e, id: string) => {
    const filePath = getDrawerFilePath(id);
    const content = await fs.readFile(filePath, 'utf8');
    return content;
  });
  ipcMain.handle('import-drawer', async (_e, fileContent: string) => {
    try {
      const drawer: EncryptedDrawer = JSON.parse(fileContent);
      await ensureDataDir();
      await fs.writeFile(getDrawerFilePath(drawer.id), fileContent, 'utf8');
      return true;
    } catch {
      return false;
    }
  });
  ipcMain.on('open-file-dialog', (event) => {
    dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Clavis Drawers', extensions: ['clavis'] }],
    }).then((result) => {
      event.reply('file-selected', result.filePaths[0] || null);
    });
  });
}

app.whenReady().then(() => {
  ensureDataDir();
  createWindow();
  handleIPC();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
