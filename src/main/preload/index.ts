import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from '../../shared/types';
import { CHANNELS } from '../../shared/channels';

const api: ElectronAPI = {
  listDrawers: () => ipcRenderer.invoke(CHANNELS.LIST_DRAWERS),
  createDrawer: (title: string, password: string) => ipcRenderer.invoke(CHANNELS.CREATE_DRAWER, title, password),
  unlockDrawer: (id: string, password: string) => ipcRenderer.invoke(CHANNELS.UNLOCK_DRAWER, id, password),
  saveDrawer: (id: string, password: string, title: string, content: string) => ipcRenderer.invoke(CHANNELS.SAVE_DRAWER, id, password, title, content),
  deleteDrawer: (id: string) => ipcRenderer.invoke(CHANNELS.DELETE_DRAWER, id),
  exportDrawer: (id: string) => ipcRenderer.invoke(CHANNELS.EXPORT_DRAWER, id),
  importDrawer: (token: string) => ipcRenderer.invoke(CHANNELS.IMPORT_DRAWER, token),
  openFile: () => ipcRenderer.invoke(CHANNELS.OPEN_FILE_DIALOG),
  restartApp: () => ipcRenderer.invoke(CHANNELS.RESTART_APP),
};

contextBridge.exposeInMainWorld('electronAPI', api);
