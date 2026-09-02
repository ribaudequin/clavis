export enum ErrorCode {
  INVALID_ID = 'INVALID_ID',
  PASSWORD_TOO_SHORT = 'PASSWORD_TOO_SHORT',
  DECRYPT_FAILED = 'DECRYPT_FAILED',
  WRITE_FAILED = 'WRITE_FAILED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  INVALID_JSON = 'INVALID_JSON',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export interface DrawerMetadata {
  id: string;
  title: string;
  iconData: string;
  createdAt: number;
  updatedAt: number;
}

export interface EncryptedDrawer {
  id: string;
  title: string;
  iconData: string;
  createdAt: number;
  updatedAt: number;
  encryptedData: string;
  salt: string;
  iv: string;
  authTag: string;
  keyDerivation: {
    algorithm: string;
    iterations: number;
    memory: number;
    parallelism: number;
  };
}

export interface DrawerListItem {
  id: string;
  title: string;
  iconData: string;
}

export interface ElectronAPI {
  listDrawers: () => Promise<Result<DrawerListItem[]>>;
  createDrawer: (title: string, password: string) => Promise<Result<EncryptedDrawer>>;
  unlockDrawer: (id: string, password: string) => Promise<Result<{ title: string; content: string; iconData: string } | null>>;
  saveDrawer: (id: string, password: string, title: string, content: string) => Promise<Result<void>>;
  deleteDrawer: (id: string) => Promise<Result<void>>;
  exportDrawer: (id: string) => Promise<Result<string>>;
  importDrawer: (token: string) => Promise<Result<void>>;
  openFile: () => Promise<Result<{ token: string; fileName: string } | null>>;
}
