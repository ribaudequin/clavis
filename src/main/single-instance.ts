// SEC-09 — Two Clavis processes on the same `userData` directory meant two
// read-modify-write cycles over the same drawer file: `saveDrawer` has no lock of
// its own, so the second write silently discarded the first one's content. The
// process-level lock is the only thing standing between the user and that loss.
//
// The dependency types below are structural instead of `Electron.App` /
// `Electron.BrowserWindow` on purpose: this module imports nothing at all, so the
// unit test drives it with plain objects — no electron mock, and no risk of the
// test asserting against a fake that was shaped to mirror the implementation.
// The real wiring (which types are structurally satisfied by the real Electron
// objects) is checked by `tsc` at the call site in `index.ts`.

export interface SingleInstanceApp {
  requestSingleInstanceLock(): boolean;
  on(event: 'second-instance', listener: () => void): void;
}

export interface SingleInstanceWindow {
  isMinimized(): boolean;
  restore(): void;
  focus(): void;
}

export interface SingleInstanceDeps {
  app: SingleInstanceApp;
  getWindow: () => SingleInstanceWindow | null;
}

/**
 * Requests the single-instance lock and wires the `second-instance` handler.
 *
 * Returns true when this process is the primary instance and may continue
 * starting up; false when another instance already holds the lock.
 *
 * The decision to quit belongs to the caller: this function only reports the
 * outcome. Keeping `app.quit()` out of here is what lets the unit test assert
 * the refusal as a return value instead of as a side effect on a mocked `app`.
 */
export function acquireSingleInstanceLock(deps: SingleInstanceDeps): boolean {
  if (!deps.app.requestSingleInstanceLock()) {
    // No listener is registered on refusal: a process that is not the primary
    // instance has no window to focus, and `second-instance` is only ever
    // delivered to the lock holder.
    return false;
  }

  deps.app.on('second-instance', () => {
    const win = deps.getWindow();
    // The primary instance can be between the lock request and the creation of
    // its window when the second instance arrives — the window does not exist
    // yet, and there is nothing to restore or to focus. This is the ordinary
    // "double-clicked the launcher twice" case, not a hypothetical.
    if (!win) return;

    // A BrowserWindow can be destroyed between this event and these calls (the
    // user closes the window while the second instance is still starting), and
    // Electron throws on a destroyed window. An uncaught throw inside an event
    // listener takes the whole main process down, taking the primary instance
    // and every unsaved drawer with it — so the window interaction is guarded
    // instead of being allowed to escape.
    try {
      if (win.isMinimized()) {
        win.restore();
      }
      win.focus();
    } catch {
      // The window was destroyed between the check and the call. There is no
      // window left to focus, and the next `second-instance` will resolve a
      // fresh one through `getWindow()`.
    }
  });

  return true;
}
