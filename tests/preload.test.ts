/**
 * The preload is the renderer<->main boundary: it runs before any renderer code
 * and is bundled by `scripts/build-preload.mjs`. Its two recorded production
 * failures were a packaging failure (`../../shared/channels.js` resolved to
 * `module not found` inside the AppImage, a TypeScript-level-green build that
 * still shipped a broken app) and a silent loss of `electronAPI`, which surfaced
 * to the user as a blank screen.
 *
 * LIMITATION: nothing here can detect either of those. A module-resolution or
 * bundling failure only reproduces against the real packaged artifact, and
 * `contextIsolation` + a jsdom `window` cannot prove the real bridge wrote
 * `electronAPI` onto the main world. What is testable in isolation is parity and
 * wiring: the exposed surface matches `ElectronAPI`, every method reaches
 * `ipcRenderer.invoke` on the right channel with the right argument order, and
 * the `Result<T>` envelope crosses IPC untouched.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  // HYG-24 — `on`/`removeListener` are the push surface: the export download's
  // outcome arrives on a channel the main process sends on, and the preload is the
  // only context that can touch ipcRenderer.
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
}));

import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '../src/shared/channels';
import type { Channel } from '../src/shared/channels';
import type { ElectronAPI } from '../src/shared/types';

// Electron ships `exposeInMainWorld(apiKey: string, api: any)` and
// `invoke(channel: string, ...args: any[]): Promise<any>`. These aliases pin the
// two shapes this suite actually depends on so the assertions stay typed without
// the production source being loosened.
const exposeInMainWorld = contextBridge.exposeInMainWorld as unknown as MockedFunction<
  (apiKey: string, api: ElectronAPI) => void
>;
const invoke = ipcRenderer.invoke as unknown as MockedFunction<
  (channel: string, ...args: unknown[]) => Promise<unknown>
>;
// The push surface, HYG-24: the export download's outcome arrives on a channel the
// main process sends on, so the preload registers a listener rather than invoking.
const on = ipcRenderer.on as unknown as MockedFunction<
  (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void
>;
const removeListener = ipcRenderer.removeListener as unknown as MockedFunction<
  (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void
>;

// The two kinds are listed apart, because they are wired apart: every method here
// reaches `ipcRenderer.invoke` on a channel, and the one below registers a listener
// on a channel the main process pushes on. The count guard further down compares the
// invoke calls in the source against INVOKE_API_KEYS, so the two lists cannot drift
// into each other.
const INVOKE_API_KEYS = [
  'listDrawers',
  'createDrawer',
'unlockDrawer',
  'getUnlockDelay',
  'saveDrawer',
  'deleteDrawer',
  'exportDrawer',
  'importDrawer',
  'openFile',
  'restartApp',
  'getAppVersion',
  'checkUpdate',
] as const satisfies readonly (keyof ElectronAPI)[];

const LISTENER_API_KEYS = [
  'onExportDownloadDone',
] as const satisfies readonly (keyof ElectronAPI)[];

const API_KEYS = [...INVOKE_API_KEYS, ...LISTENER_API_KEYS] as const satisfies readonly (keyof ElectronAPI)[];

// `satisfies` rejects a listed key that is not on ElectronAPI; this rejects a key
// added to ElectronAPI and forgotten here. Together they make the runtime key-set
// comparison below exhaustive from both sides.
type UnlistedApiKeys = Exclude<keyof ElectronAPI, (typeof API_KEYS)[number]>;
export const _everyApiKeyIsListed: UnlistedApiKeys extends never ? true : UnlistedApiKeys[] = true;

// The split has to hold in both directions: every method that is not a listener must
// be on the invoke list, so a method cannot be quietly reclassified from one kind
// to the other without this file noticing.
type ListenerKeys = (typeof LISTENER_API_KEYS)[number];
type InvokeOnlyKeys = Exclude<keyof ElectronAPI, ListenerKeys>;
type UnlistedInvokeKeys = Exclude<InvokeOnlyKeys, (typeof INVOKE_API_KEYS)[number]>;
export const _everyInvokeKeyIsListed: UnlistedInvokeKeys extends never ? true : UnlistedInvokeKeys[] = true;

// The wire protocol is duplicated from `src/shared/channels.ts` on purpose: a
// renamed constant must break this file, not just the main process.
const WIRE_PROTOCOL = [
  { name: 'LIST_DRAWERS', channel: CHANNELS.LIST_DRAWERS, wire: 'list-drawers' },
  { name: 'CREATE_DRAWER', channel: CHANNELS.CREATE_DRAWER, wire: 'create-drawer' },
  { name: 'UNLOCK_DRAWER', channel: CHANNELS.UNLOCK_DRAWER, wire: 'unlock-drawer' },
  { name: 'GET_UNLOCK_DELAY', channel: CHANNELS.GET_UNLOCK_DELAY, wire: 'get-unlock-delay' },
  { name: 'SAVE_DRAWER', channel: CHANNELS.SAVE_DRAWER, wire: 'save-drawer' },
  { name: 'DELETE_DRAWER', channel: CHANNELS.DELETE_DRAWER, wire: 'delete-drawer' },
  { name: 'EXPORT_DRAWER', channel: CHANNELS.EXPORT_DRAWER, wire: 'export-drawer' },
  { name: 'EXPORT_DOWNLOAD_DONE', channel: CHANNELS.EXPORT_DOWNLOAD_DONE, wire: 'export-download-done' },
  { name: 'IMPORT_DRAWER', channel: CHANNELS.IMPORT_DRAWER, wire: 'import-drawer' },
  { name: 'OPEN_FILE_DIALOG', channel: CHANNELS.OPEN_FILE_DIALOG, wire: 'open-file-dialog' },
  { name: 'RESTART_APP', channel: CHANNELS.RESTART_APP, wire: 'restart-app' },
  { name: 'GET_APP_VERSION', channel: CHANNELS.GET_APP_VERSION, wire: 'get-app-version' },
  { name: 'CHECK_UPDATE', channel: CHANNELS.CHECK_UPDATE, wire: 'check-update' },
] as const satisfies readonly { name: string; channel: Channel; wire: Channel }[];

type UncoveredChannel = Exclude<Channel, (typeof WIRE_PROTOCOL)[number]['channel']>;
export const _everyChannelIsCovered: UncoveredChannel extends never ? true : UncoveredChannel[] = true;

const DRAWER_ID = 'DRAWER_ID_1';
const PASSWORD = 'PASSWORD_1';
const TITLE = 'TITLE_1';
const CONTENT = 'CONTENT_1';
const TOKEN = 'TOKEN_1';

interface ChannelCase {
  method: keyof ElectronAPI;
  channel: string;
  args: unknown[];
  call: (api: ElectronAPI) => unknown;
}

// The variadic signature rejects a missing, extra or mistyped argument at the
// call site, so the table below cannot drift from `ElectronAPI`.
function channelCase<M extends keyof ElectronAPI>(
  method: M,
  channel: string,
  ...args: Parameters<ElectronAPI[M]>
): ChannelCase {
  return { method, channel, args, call: (api) => Reflect.apply(api[method], api, args) };
}

const CHANNEL_CASES: readonly ChannelCase[] = [
  channelCase('listDrawers', 'list-drawers'),
  channelCase('createDrawer', 'create-drawer', TITLE, PASSWORD),
  channelCase('unlockDrawer', 'unlock-drawer', DRAWER_ID, PASSWORD),
  channelCase('getUnlockDelay', 'get-unlock-delay', DRAWER_ID),
  channelCase('saveDrawer', 'save-drawer', DRAWER_ID, PASSWORD, TITLE, CONTENT),
  channelCase('deleteDrawer', 'delete-drawer', DRAWER_ID),
  channelCase('exportDrawer', 'export-drawer', DRAWER_ID),
  channelCase('importDrawer', 'import-drawer', TOKEN),
  channelCase('openFile', 'open-file-dialog'),
  channelCase('restartApp', 'restart-app'),
  channelCase('getAppVersion', 'get-app-version'),
  channelCase('checkUpdate', 'check-update'),
];

// Every promise the mock hands out, kept so a test can hold the exact object the
// transport produced. The preload cannot forge this identity, which is what makes
// the `toBe` assertions below meaningful rather than self-confirming.
let issuedPromises: Promise<unknown>[] = [];

beforeEach(() => {
  issuedPromises = [];
  invoke.mockImplementation(() => {
    const promise = Promise.resolve({ ok: true });
    issuedPromises.push(promise);
    return promise;
  });
});

async function importPreload(): Promise<void> {
  vi.resetModules();
  exposeInMainWorld.mockClear();
  invoke.mockClear();
  on.mockClear();
  removeListener.mockClear();
  await import('../src/main/preload/index');
}

function exposedApi(): ElectronAPI {
  const call = exposeInMainWorld.mock.calls[0];
  if (!call) throw new Error('exposeInMainWorld was never called');
  return call[1];
}

describe('preload bridge registration', () => {
  it('exposes electronAPI exactly once, with the api object and nothing else', async () => {
    await importPreload();

    expect(exposeInMainWorld).toHaveBeenCalledOnce();
    expect(exposeInMainWorld.mock.calls[0]?.[0]).toBe('electronAPI');
    expect(exposeInMainWorld.mock.calls[0]).toHaveLength(2);
    expect(exposeInMainWorld.mock.calls[0]?.[1]).toBeDefined();
  });

  it('re-executes on every import so a stale module cache cannot hide a second registration', async () => {
    await importPreload();
    expect(exposeInMainWorld).toHaveBeenCalledOnce();

    await importPreload();
    expect(exposeInMainWorld).toHaveBeenCalledOnce();
  });
});

describe('ElectronAPI parity', () => {
  it('exposes every method declared on ElectronAPI', async () => {
    await importPreload();

    const exposed = Object.keys(exposedApi());
    expect(API_KEYS.filter((key) => !exposed.includes(key))).toEqual([]);
  });

  it('exposes no key that is not declared on ElectronAPI (contextBridge leak)', async () => {
    await importPreload();

    const exposed = Object.keys(exposedApi());
    expect(exposed.filter((key) => !(API_KEYS as readonly string[]).includes(key))).toEqual([]);
  });

  it('exposes every key as a function', async () => {
    await importPreload();

    const api = exposedApi();
    const nonFunctions = Object.entries(api)
      .filter(([, value]) => typeof value !== 'function')
      .map(([key]) => key);

    expect(nonFunctions).toEqual([]);
  });
});

describe('channel wiring', () => {
  it.each(WIRE_PROTOCOL)('CHANNELS.$name is still the wire string $wire', ({ channel, wire }) => {
    expect(channel).toBe(wire);
  });

  it('covers every channel constant', () => {
    expect(Object.values(CHANNELS).sort()).toEqual(
      WIRE_PROTOCOL.map((entry) => entry.channel).sort(),
    );
  });

  it.each(CHANNEL_CASES)('$method invokes $channel exactly once with $args', async (testCase) => {
    await importPreload();

    testCase.call(exposedApi());

    expect(invoke).toHaveBeenCalledExactlyOnceWith(testCase.channel, ...testCase.args);
  });

  it('routes every call through a CHANNELS constant instead of a string literal', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'src', 'main', 'preload', 'index.ts'),
      'utf8',
    );
    const firstArgs = [...source.matchAll(/ipcRenderer\.invoke\(\s*([^,)\n]*)/g)].map((match) =>
      (match[1] ?? '').trim(),
    );

    // The count guard keeps a source refactor that stops matching the pattern
    // from turning this into a test that passes on an empty list. It counts the
    // *invoke* calls, so it is compared against the invoke list — the listener
    // method does not go through invoke.
    expect(firstArgs).toHaveLength(INVOKE_API_KEYS.length);
    expect(firstArgs.filter((arg) => !/^CHANNELS\.[A-Z0-9_]+$/.test(arg))).toEqual([]);
  });
});

describe('return value identity', () => {
  it.each(CHANNEL_CASES)('$method returns the invoke promise itself', async (testCase) => {
    await importPreload();

    const returned = testCase.call(exposedApi());

    expect(returned).toBe(issuedPromises[0]);
  });

  it('returns the invoke promise itself when it rejects (no swallow wrapper)', async () => {
    await importPreload();
    const failure = new Error('ipc unavailable');
    invoke.mockImplementation(() => {
      const promise = Promise.reject(failure);
      issuedPromises.push(promise);
      return promise;
    });

    const returned = exposedApi().getAppVersion();

    expect(returned).toBe(issuedPromises[0]);
    await expect(returned).rejects.toBe(failure);
  });
});

describe('the export download listener', () => {
  it('subscribes to the download channel and hands the payload to the listener', async () => {
    await importPreload();

    const received: unknown[] = [];
    exposedApi().onExportDownloadDone((result) => received.push(result));

    expect(on).toHaveBeenCalledExactlyOnceWith(
      CHANNELS.EXPORT_DOWNLOAD_DONE,
      expect.any(Function)
    );

    // The handler the preload registered is the one that reaches the renderer's
    // listener, with the main process's payload and nothing else.
    const handler = on.mock.calls[0][1];
    handler({}, { fileName: 'drawer.clavis', outcome: 'completed' });
    expect(received).toEqual([{ fileName: 'drawer.clavis', outcome: 'completed' }]);
  });

  it('hands back the unsubscribe, and it removes that same listener', async () => {
    // A listener that outlives its component is a leak that survives the window it
    // belonged to, so the renderer must be able to let go of it.
    await importPreload();

    const unsubscribe = exposedApi().onExportDownloadDone(() => {});
    const handler = on.mock.calls[0][1];

    unsubscribe();

    expect(removeListener).toHaveBeenCalledExactlyOnceWith(CHANNELS.EXPORT_DOWNLOAD_DONE, handler);
  });
});
