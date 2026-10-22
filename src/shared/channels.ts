export const CHANNELS = {
  LIST_DRAWERS: 'list-drawers',
  CREATE_DRAWER: 'create-drawer',
  UNLOCK_DRAWER: 'unlock-drawer',
  GET_UNLOCK_DELAY: 'get-unlock-delay',
  SAVE_DRAWER: 'save-drawer',
  DELETE_DRAWER: 'delete-drawer',
  EXPORT_DRAWER: 'export-drawer',
  // The only channel the main process pushes on: the renderer has to know when the
  // export download ended, because only then may it revoke the blob URL.
  EXPORT_DOWNLOAD_DONE: 'export-download-done',
  OPEN_FILE_DIALOG: 'open-file-dialog',
  IMPORT_DRAWER: 'import-drawer',
  RESTART_APP: 'restart-app',
  GET_APP_VERSION: 'get-app-version',
  CHECK_UPDATE: 'check-update',
} as const;

export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];