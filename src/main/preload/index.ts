import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../../shared/types';
import { CHANNELS } from '../../shared/channels.js';

const api: ElectronAPI = {
  listDrawers: () => ipcRenderer.invoke(CHANNELS.LIST_DRAWERS),
  createDrawer: (title, password) => ipcRenderer.invoke(CHANNELS.CREATE_DRAWER, title, password),
  unlockDrawer: (id, password) => ipcRenderer.invoke(CHANNELS.UNLOCK_DRAWER, id, password),
  saveDrawer: (id, password, title, content) => ipcRenderer.invoke(CHANNELS.SAVE_DRAWER, id, password, title, content),
  deleteDrawer: (id) => ipcRenderer.invoke(CHANNELS.DELETE_DRAWER, id),
  exportDrawer: (id) => ipcRenderer.invoke(CHANNELS.EXPORT_DRAWER, id),
  importDrawer: (token) => ipcRenderer.invoke(CHANNELS.IMPORT_DRAWER, token),
  openFile: () => ipcRenderer.invoke(CHANNELS.OPEN_FILE_DIALOG),
};

contextBridge.exposeInMainWorld('electronAPI', api);
