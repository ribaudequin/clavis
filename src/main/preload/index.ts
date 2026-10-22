import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '../../shared/channels';
import type { DownloadResult, ElectronAPI } from '../../shared/types';

const api: ElectronAPI = {
  listDrawers: () => ipcRenderer.invoke(CHANNELS.LIST_DRAWERS),
  createDrawer: (title: string, password: string) => ipcRenderer.invoke(CHANNELS.CREATE_DRAWER, title, password),
  unlockDrawer: (id: string, password: string) => ipcRenderer.invoke(CHANNELS.UNLOCK_DRAWER, id, password),
  getUnlockDelay: (id: string) => ipcRenderer.invoke(CHANNELS.GET_UNLOCK_DELAY, id),
  saveDrawer: (id: string, password: string, title: string, content: string) => ipcRenderer.invoke(CHANNELS.SAVE_DRAWER, id, password, title, content),
  deleteDrawer: (id: string) => ipcRenderer.invoke(CHANNELS.DELETE_DRAWER, id),
  exportDrawer: (id: string) => ipcRenderer.invoke(CHANNELS.EXPORT_DRAWER, id),
  // HYG-24 — The one push the app has: the renderer has to learn that the export
  // download ended before it may revoke the blob URL. The listener is registered in
  // the preload (the only context that can touch ipcRenderer) and the unsubscribe
  // function is handed back so the renderer can drop it on unmount — a listener that
  // outlives its component is a leak that survives the window it belonged to.
  onExportDownloadDone: (listener: (result: DownloadResult) => void) => {
    const handler = (_event: unknown, result: DownloadResult): void => listener(result);
    ipcRenderer.on(CHANNELS.EXPORT_DOWNLOAD_DONE, handler);
    return () => {
      ipcRenderer.removeListener(CHANNELS.EXPORT_DOWNLOAD_DONE, handler);
    };
  },
  importDrawer: (token: string) => ipcRenderer.invoke(CHANNELS.IMPORT_DRAWER, token),
  openFile: () => ipcRenderer.invoke(CHANNELS.OPEN_FILE_DIALOG),
  restartApp: () => ipcRenderer.invoke(CHANNELS.RESTART_APP),
  getAppVersion: () => ipcRenderer.invoke(CHANNELS.GET_APP_VERSION),
  checkUpdate: () => ipcRenderer.invoke(CHANNELS.CHECK_UPDATE),
};

contextBridge.exposeInMainWorld('electronAPI', api);
