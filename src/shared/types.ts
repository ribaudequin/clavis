export enum ErrorCode {
  INVALID_ID = 'INVALID_ID',
  PASSWORD_TOO_SHORT = 'PASSWORD_TOO_SHORT',
  DECRYPT_FAILED = 'DECRYPT_FAILED',
  WRONG_PASSWORD = 'WRONG_PASSWORD',
  WRITE_FAILED = 'WRITE_FAILED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  INVALID_JSON = 'INVALID_JSON',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  // SAV-02/SAV-03 — A size refusal is not a generic write failure: reusing
  // WRITE_FAILED renders "The operation could not be completed." and throws away
  // the only message that tells the user why their drawer will not open.
  CONTENT_TOO_LARGE = 'CONTENT_TOO_LARGE',
  // SAV-01 — The *character* cap (Zod's .max on content, which counts code points) is
  // a different limit from CONTENT_TOO_LARGE (bytes, and the drawer file's own
  // ceiling). They collapse into the same code today, so the user cannot be told
  // which one refused the save; this code names the code-point cap.
  CONTENT_TOO_LONG = 'CONTENT_TOO_LONG',
  // SEC-01 — A drawer encrypted with argon2id cannot be read on a build whose native
  // argon2 module failed to load. Reporting that as DECRYPT_FAILED would tell the user
  // their correct password is wrong and feed the unlock rate limiter.
  KDF_UNAVAILABLE = 'KDF_UNAVAILABLE',
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

/**
 * How a download ended.
 *
 * `completed` is the only one that means the file was written; `cancelled` is the user
 * closing the save dialog and `interrupted` is the transfer failing (a disk error, or
 * the blob being gone before Chromium took it).
 */
export type DownloadOutcome = 'completed' | 'cancelled' | 'interrupted';

/** What the main process knows about a finished download. */
export interface DownloadResult {
  /** The file name Chromium gave it — the renderer matches the pending export by it. */
  fileName: string;
  outcome: DownloadOutcome;
}

export interface ElectronAPI {
  listDrawers: () => Promise<Result<DrawerListItem[]>>;
  createDrawer: (title: string, password: string) => Promise<Result<EncryptedDrawer>>;
  unlockDrawer: (id: string, password: string) => Promise<Result<{ title: string; content: string; iconData: string } | null>>;
  /**
   * How long the *next* unlock attempt on this drawer would wait, in milliseconds.
   *
   * A read-only query, not a decision: the unlock path computes the delay itself at
   * attempt time. The renderer asks so it can show the countdown, and the answer is
   * exact because the only writer of the counter is a failed attempt — the attempt in
   * question is the one about to be made.
   */
  getUnlockDelay: (id: string) => Promise<number>;
  saveDrawer: (id: string, password: string, title: string, content: string) => Promise<Result<void>>;
  deleteDrawer: (id: string) => Promise<Result<void>>;
  exportDrawer: (id: string) => Promise<Result<string>>;
  /**
   * How the export download ended.
   *
   * The renderer hands Chromium a blob URL and a download filename; the blob URL can
   * only be revoked once the browser is done with it, and only the main process knows
   * when that is — the renderer gets no download event. This is a push, not a query:
   * the app is the only thing that downloads, so the notification carries the file
   * name and the renderer matches it to the export that is waiting for it.
   *
   * Returns the unsubscribe function.
   */
  onExportDownloadDone: (listener: (result: DownloadResult) => void) => () => void;
  importDrawer: (token: string) => Promise<Result<void>>;
  openFile: () => Promise<Result<{ token: string; fileName: string } | null>>;
  restartApp: () => Promise<Result<void>>;
  getAppVersion: () => Promise<string>;
  checkUpdate: () => Promise<{ tag_name?: string } | null>;
}
