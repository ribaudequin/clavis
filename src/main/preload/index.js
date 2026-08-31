const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  listDrawers: () => ipcRenderer.invoke('list-drawers'),
  createDrawer: (title, password) => ipcRenderer.invoke('create-drawer', title, password),
  unlockDrawer: (id, password) => ipcRenderer.invoke('unlock-drawer', id, password),
  saveDrawer: (id, password, title, content) => ipcRenderer.invoke('save-drawer', id, password, title, content),
  deleteDrawer: (id) => ipcRenderer.invoke('delete-drawer', id),
  exportDrawer: (id) => ipcRenderer.invoke('export-drawer', id),
  importDrawer: (filePath) => ipcRenderer.invoke('import-drawer', filePath),
  openFile: () => ipcRenderer.invoke('open-file-dialog'),
});
