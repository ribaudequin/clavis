// DATA-04 — Crash hooks are registered on the primary instance and log+exit on the
// right events. The wiring is what regresses silently: a missing handler means a
// crash in the main process dies with no log line and no user-facing diagnosis.
//
// The module under test (`src/main/index.ts`) is a side-effectful entry point: it
// acquires the single-instance lock, initializes the logger and registers the IPC
// handlers at module load. Testing it directly requires mocking `electron`,
// `./store.js`, `./logger.js`, `./ipc-handlers.js`, `./single-instance.js`,
// `./window-options.js` and `./downloads.js` — and even then, the crash handlers
// call `dialog.showErrorBox` and `app.exit(1)`, which would kill the test runner.
//
// The approach here is structural: the test reads the source file and asserts the
// shape of the crash-hook block. It is not a behavioural test — the handlers are
// never invoked — but it pins the wiring that a future refactor could silently
// drop. Behavioural coverage would require an e2e test that crashes the main
// process, which is out of scope for DATA-04.

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('DATA-04 — crash hooks are registered on the primary instance', () => {
  const indexPath = path.resolve(__dirname, '../src/main/index.ts');
  const source = fs.readFileSync(indexPath, 'utf8');

  it('registers an uncaughtException handler that logs, shows a dialog and exits', () => {
    // The handler must be inside the `if (isPrimaryInstance)` block so the process
    // that lost the lock race does not register it.
    const primaryBlockMatch = source.match(
      /if\s*\(isPrimaryInstance\)\s*\{([\s\S]*?)\n\}/
    );
    expect(primaryBlockMatch).not.toBeNull();
    const primaryBlock = primaryBlockMatch![1];

    expect(primaryBlock).toContain("process.on('uncaughtException'");
    expect(primaryBlock).toContain('logger.error');
    expect(primaryBlock).toContain('dialog.showErrorBox');
    expect(primaryBlock).toContain('app.exit(1)');
  });

  it('registers an unhandledRejection handler that logs but does not exit', () => {
    const primaryBlockMatch = source.match(
      /if\s*\(isPrimaryInstance\)\s*\{([\s\S]*?)\n\}/
    );
    expect(primaryBlockMatch).not.toBeNull();
    const primaryBlock = primaryBlockMatch![1];

    expect(primaryBlock).toContain("process.on('unhandledRejection'");
    expect(primaryBlock).toContain('logger.error');
    // The handler must NOT call app.exit or dialog.showErrorBox — an unhandled
    // rejection is not fatal and the user should not be interrupted.
    const rejectionBlockMatch = primaryBlock.match(
      /process\.on\('unhandledRejection'[\s\S]*?\}\);/
    );
    expect(rejectionBlockMatch).not.toBeNull();
    expect(rejectionBlockMatch![0]).not.toContain('app.exit');
    expect(rejectionBlockMatch![0]).not.toContain('dialog.showErrorBox');
  });

  it('registers a render-process-gone handler on the app', () => {
    const primaryBlockMatch = source.match(
      /if\s*\(isPrimaryInstance\)\s*\{([\s\S]*?)\n\}/
    );
    expect(primaryBlockMatch).not.toBeNull();
    const primaryBlock = primaryBlockMatch![1];

    expect(primaryBlock).toContain("app.on('render-process-gone'");
    expect(primaryBlock).toContain('logger.error');
  });

  it('does not register crash hooks when the lock is held by another instance', () => {
    // The entire crash-hook block must be inside `if (isPrimaryInstance) { ... }`,
    // not at module scope. A handler registered unconditionally would fire in the
    // process that lost the lock race, which never opened the store and has nothing
    // to diagnose.
    // We check that `process.on('uncaughtException'` is indented (inside a block),
    // not at the start of a line (module scope).
    const lines = source.split('\n');
    const uncaughtLine = lines.find((l) => l.includes("process.on('uncaughtException'"));
    expect(uncaughtLine).toBeDefined();
    // Must be indented (starts with whitespace), not at column 0.
    expect(uncaughtLine![0]).toMatch(/\s/);
  });
});