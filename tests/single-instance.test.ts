// SEC-09 — No single-instance lock: two Clavis processes on the same `userData`
// directory meant two read-modify-write cycles over the same drawer file, and
// `saveDrawer` has no lock of its own, so the second write silently discarded
// the first. The lock is the control, so the test drives the module's own
// contract — request the lock, then focus the primary window when a second
// instance shows up.
//
// The module under test imports nothing (its dependency types are structural),
// so this file needs no electron mock at all: a fake `app` and a fake window
// are plain objects, and the assertions are about the calls the module makes on
// them. A mock that mirrored the implementation would be able to agree with a
// broken implementation, which is exactly what the mutation check at the end of
// this file rules out.

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { acquireSingleInstanceLock } from '../src/main/single-instance';
import type {
  SingleInstanceApp,
  SingleInstanceDeps,
  SingleInstanceWindow,
} from '../src/main/single-instance';

interface FakeApp {
  app: SingleInstanceApp;
  /** The listeners registered through `app.on('second-instance', …)`. */
  listeners: Array<() => void>;
  requestSingleInstanceLock: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}

function createFakeApp(lockGranted: boolean): FakeApp {
  const listeners: Array<() => void> = [];
  const requestSingleInstanceLock = vi.fn(() => lockGranted);
  const on = vi.fn((_event: 'second-instance', listener: () => void) => {
    listeners.push(listener);
  });
  return {
    app: { requestSingleInstanceLock, on },
    listeners,
    requestSingleInstanceLock,
    on,
  };
}

interface FakeWindow {
  win: SingleInstanceWindow;
  /** The method calls in the order they happened — restore must precede focus. */
  calls: string[];
}

function createFakeWindow(
  options: { minimized?: boolean; throwOn?: 'isMinimized' | 'restore' | 'focus' } = {}
): FakeWindow {
  const calls: string[] = [];
  const win: SingleInstanceWindow = {
    isMinimized: () => {
      calls.push('isMinimized');
      if (options.throwOn === 'isMinimized') throw new Error('Object has been destroyed');
      return options.minimized ?? false;
    },
    restore: () => {
      calls.push('restore');
      if (options.throwOn === 'restore') throw new Error('Object has been destroyed');
    },
    focus: () => {
      calls.push('focus');
      if (options.throwOn === 'focus') throw new Error('Object has been destroyed');
    },
  };
  return { win, calls };
}

function depsFor(app: SingleInstanceApp, getWindow: () => SingleInstanceWindow | null): SingleInstanceDeps {
  return { app, getWindow };
}

describe('SEC-09 — single-instance lock', () => {
  it('returns true and registers exactly one second-instance listener when the lock is granted', () => {
    const fake = createFakeApp(true);
    const { win } = createFakeWindow();

    const acquired = acquireSingleInstanceLock(depsFor(fake.app, () => win));

    expect(acquired).toBe(true);
    expect(fake.requestSingleInstanceLock).toHaveBeenCalledOnce();
    expect(fake.on).toHaveBeenCalledOnce();
    expect(fake.on).toHaveBeenCalledWith('second-instance', expect.any(Function));
    expect(fake.listeners).toHaveLength(1);
  });

  it('returns false and registers no listener when the lock is refused', () => {
    // The refused process must not react to `second-instance`: it does not hold
    // the lock, it has no window, and the event is only ever delivered to the
    // lock holder. A listener here would be a listener on a process that is
    // about to quit.
    const fake = createFakeApp(false);
    const { win } = createFakeWindow();

    const acquired = acquireSingleInstanceLock(depsFor(fake.app, () => win));

    expect(acquired).toBe(false);
    expect(fake.requestSingleInstanceLock).toHaveBeenCalledOnce();
    expect(fake.on).not.toHaveBeenCalled();
    expect(fake.listeners).toHaveLength(0);
  });

  it('requests the lock before registering the listener', () => {
    // The order is the contract: the listener may only be registered by the
    // process that actually holds the lock.
    const order: string[] = [];
    const requestSingleInstanceLock = vi.fn(() => {
      order.push('requestSingleInstanceLock');
      return true;
    });
    const on = vi.fn((_event: 'second-instance', _listener: () => void) => {
      order.push('on');
    });
    const { win } = createFakeWindow();

    acquireSingleInstanceLock(depsFor({ requestSingleInstanceLock, on }, () => win));

    expect(order).toEqual(['requestSingleInstanceLock', 'on']);
  });

  it('restores a minimized window and then focuses it', () => {
    const fake = createFakeApp(true);
    const { win, calls } = createFakeWindow({ minimized: true });

    acquireSingleInstanceLock(depsFor(fake.app, () => win));
    fake.listeners[0]();

    // The order matters: focusing a minimized window leaves it focused but
    // still minimized, which is not what the user sees when they click the
    // launcher a second time.
    expect(calls).toEqual(['isMinimized', 'restore', 'focus']);
  });

  it('does not call restore() when the window is not minimized', () => {
    const fake = createFakeApp(true);
    const { win, calls } = createFakeWindow({ minimized: false });

    acquireSingleInstanceLock(depsFor(fake.app, () => win));
    fake.listeners[0]();

    // restore() on a window that is not minimized is a no-op that can still
    // un-maximize a window on some platforms, so it is only called when the
    // window really is minimized.
    expect(calls).toEqual(['isMinimized', 'focus']);
  });

  it('does nothing when there is no window yet', () => {
    // The primary instance can receive `second-instance` before it has created
    // its window — the user double-clicked the launcher and the second process
    // won the race to the lock. There is nothing to focus, and that is not an
    // error.
    //
    // Note what this test can and cannot see: the `!win` guard is a *type*
    // control (`tsc` reports TS18047 the moment it is deleted), and at runtime
    // the catch-all below the guard absorbs the TypeError that a deleted guard
    // would produce — so the two shapes behave identically here and no unit
    // test can tell them apart. Narrowing the catch to Electron's
    // "Object has been destroyed" message would make the difference visible,
    // but message sniffing is exactly what this repo forbids in `src/main`
    // (HYG-22: the store throws typed errors, the caller matches on the type).
    const fake = createFakeApp(true);
    let getWindowCalls = 0;

    acquireSingleInstanceLock(
      depsFor(fake.app, () => {
        getWindowCalls += 1;
        return null;
      })
    );

    expect(() => fake.listeners[0]()).not.toThrow();
    expect(getWindowCalls).toBe(1);
  });

  it('does not throw when the window has been destroyed', () => {
    // A BrowserWindow can be destroyed between the event and the call, and
    // Electron throws on a destroyed window. An uncaught throw inside an event
    // listener takes the whole main process down — with every drawer it holds.
    for (const throwOn of ['isMinimized', 'restore', 'focus'] as const) {
      const fake = createFakeApp(true);
      const { win } = createFakeWindow({ minimized: true, throwOn });

      acquireSingleInstanceLock(depsFor(fake.app, () => win));

      expect(() => fake.listeners[0]()).not.toThrow();
    }
  });

  it('resolves the window at event time, not at lock time', () => {
    // The window does not exist when the lock is requested, so the handler has
    // to look it up when the event arrives. A handler that captured the window
    // at registration time would hold `null` forever.
    const fake = createFakeApp(true);
    let current: SingleInstanceWindow | null = null;

    acquireSingleInstanceLock(depsFor(fake.app, () => current));

    const { win, calls } = createFakeWindow({ minimized: true });
    current = win;
    fake.listeners[0]();

    expect(calls).toEqual(['isMinimized', 'restore', 'focus']);
  });

  it('has no runtime dependency on electron', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'src', 'main', 'single-instance.ts'),
      'utf8',
    );

    // A value import of 'electron' would drag the real electron module into
    // this file: outside the Electron runtime that module is the path to the
    // binary, not an API, so `deps.app` would be undefined at call time and
    // every test above would fail for a reason that has nothing to do with
    // the lock. A type-only import is erased by the compiler and stays legal.
    expect(source).not.toMatch(/require\(\s*['"]electron['"]\s*\)/);
    expect(source).not.toMatch(/^\s*import\s+(?!type\s)[^;]*from\s+['"]electron['"]/m);
  });
});
