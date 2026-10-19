import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock, MockedFunction } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  app: { quit: vi.fn(), getVersion: vi.fn(), relaunch: vi.fn() },
}));

vi.mock('https', () => ({
  default: { get: vi.fn() },
}));

// The real module is spread first so the two error classes are the genuine ones: the
// handler now classifies a refused import with `instanceof`, and a mock that defined its
// own copies of those classes would make that assertion tautological — the handler and the
// test would be comparing the same fake against itself. Only the store functions are
// replaced; the classes are the subject of the test, not a dependency of it.
vi.mock('../src/main/store.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/main/store.js')>();
  return {
    ...actual,
    listDrawers: vi.fn(),
    createDrawer: vi.fn(),
    unlockDrawer: vi.fn(),
    saveDrawer: vi.fn(),
    deleteDrawer: vi.fn(),
    readDrawerRaw: vi.fn(),
    importDrawerRaw: vi.fn(),
    ensureDataDir: vi.fn(),
    MAX_DRAWER_FILE_SIZE: 20_004_096,
  };
});

vi.mock('../src/main/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  initializeLogger: vi.fn(),
}));

vi.mock('fs/promises', () => {
  const actual = require('fs/promises');
  return {
    ...actual,
    default: actual,
    readFile: vi.fn(),
    lstat: vi.fn(),
  };
});

import { registerIpcHandlers, __resetAllowedImportPaths } from '../src/main/ipc-handlers';
import type { IpcListener } from '../src/main/ipc-handlers';
import * as store from '../src/main/store';
import * as fsPromises from 'fs/promises';
import { app } from 'electron';
import { MAX_CONTENT_CODE_POINTS } from '../src/shared/limits';
import https from 'https';
import { CHANNELS } from '../src/shared/channels';
import type { Channel } from '../src/shared/channels';
import { ErrorCode } from '../src/shared/types';
import { CreateDrawerSchema } from '../src/main/validation';
import { describePasswordPolicy } from '../src/main/password-policy';
import type { ElectronAPI, EncryptedDrawer } from '../src/shared/types';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_UUID_2 = '123e4567-e89b-12d3-a456-426614174001';

// Maps every IPC channel to the preload-exposed method that invokes it, so the
// handlers under test are typed by the public ElectronAPI contract instead of
// hand-written signatures. Any drift between preload and main is a type error.
const API_BY_CHANNEL = {
  [CHANNELS.LIST_DRAWERS]: 'listDrawers',
  [CHANNELS.CREATE_DRAWER]: 'createDrawer',
  [CHANNELS.UNLOCK_DRAWER]: 'unlockDrawer',
  [CHANNELS.SAVE_DRAWER]: 'saveDrawer',
  [CHANNELS.DELETE_DRAWER]: 'deleteDrawer',
  [CHANNELS.EXPORT_DRAWER]: 'exportDrawer',
  [CHANNELS.OPEN_FILE_DIALOG]: 'openFile',
  [CHANNELS.IMPORT_DRAWER]: 'importDrawer',
  [CHANNELS.RESTART_APP]: 'restartApp',
  [CHANNELS.GET_APP_VERSION]: 'getAppVersion',
  [CHANNELS.CHECK_UPDATE]: 'checkUpdate',
} as const satisfies Record<Channel, keyof ElectronAPI>;

type Handler<C extends Channel> = (
  event: unknown,
  ...args: Parameters<ElectronAPI[(typeof API_BY_CHANNEL)[C]]>
) => Awaited<ReturnType<ElectronAPI[(typeof API_BY_CHANNEL)[C]]>>;

let handlers: Map<Channel, IpcListener>;

// `fs/promises` exposes overloaded signatures; these narrow aliases describe the
// exact overloads the import handler uses, so mock expectations stay typed.
type MockStats = { isSymbolicLink: () => boolean; size?: number };
const lstatMock = fsPromises.lstat as unknown as MockedFunction<
  (path: string) => Promise<MockStats>
>;
const readFileMock = fsPromises.readFile as unknown as MockedFunction<
  (path: string, encoding: 'utf8') => Promise<string>
>;

// `https.get` is overloaded too; the alias below pins the single overload the
// check-update handler uses, and the fake request/response objects implement
// exactly the members it touches — `.on()`, `.destroy()` and `statusCode`.
type Listener = (payload?: unknown) => void;
type MockResponse = { statusCode: number; on: (event: string, listener: Listener) => MockResponse };
type MockRequest = { on: (event: string, listener: Listener) => MockRequest; destroy: () => void };

const httpsGetMock = https.get as unknown as MockedFunction<
  (
    url: string,
    options: { headers: Record<string, string> },
    callback: (res: MockResponse) => void
  ) => MockRequest
>;

type HttpsScript = {
  statusCode?: number;
  body?: string;
  /** Emits `error` on the response instead of the body, after the headers. */
  streamError?: Error;
  /** Never emits anything — the connection stalls after the request is sent. */
  stall?: boolean;
};

interface HttpsStub {
  destroy: Mock;
  failRequest: (error: Error) => void;
}

/** Records whether a handler promise settled at all, and with what. */
type PendingSettlement =
  | { done: false }
  | { done: true; value: { tag_name?: string } | null };

// `EventEmitter` semantics without the class: listeners register inside the
// production callback, so delivery happens on a later tick like the real stream.
function stubHttps(script: HttpsScript): HttpsStub {
  const resListeners = new Map<string, Listener[]>();
  const reqListeners = new Map<string, Listener[]>();
  const add = (map: Map<string, Listener[]>, event: string, listener: Listener): void => {
    map.set(event, [...(map.get(event) ?? []), listener]);
  };
  const emit = (map: Map<string, Listener[]>, event: string, payload?: unknown): void => {
    for (const listener of map.get(event) ?? []) listener(payload);
  };

  const destroy = vi.fn();
  const request: MockRequest = {
    on: (event, listener) => {
      add(reqListeners, event, listener);
      return request;
    },
    destroy,
  };
  const response: MockResponse = {
    statusCode: script.statusCode ?? 200,
    on: (event, listener) => {
      add(resListeners, event, listener);
      return response;
    },
  };

  httpsGetMock.mockImplementation((_url, _options, callback) => {
    callback(response);
    if (!script.stall) {
      setImmediate(() => {
        if (script.streamError) {
          emit(resListeners, 'error', script.streamError);
          return;
        }
        const body = script.body ?? '';
        const mid = Math.ceil(body.length / 2);
        emit(resListeners, 'data', body.slice(0, mid));
        emit(resListeners, 'data', body.slice(mid));
        emit(resListeners, 'end');
      });
    }
    return request;
  });

  return { destroy, failRequest: (error) => emit(reqListeners, 'error', error) };
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetAllowedImportPaths();
  handlers = new Map<Channel, IpcListener>();
  registerIpcHandlers({
    ipcMain: {
      handle: (channel, listener) => {
        handlers.set(channel, listener);
      },
    },
    dialog: {
      showOpenDialog: vi.fn(),
    },
  });
});

function getHandler<C extends Channel>(channel: C): Handler<C> {
  const h = handlers.get(channel);
  if (!h) throw new Error(`Handler not registered: ${channel}`);
  return h as unknown as Handler<C>;
}

describe('IPC handlers', () => {
  describe('list-drawers', () => {
    it('returns ok with data on success', async () => {
      const items = [{ id: VALID_UUID, title: 't', iconData: 'rgb(0,0,0)' }];
      vi.mocked(store.listDrawers).mockResolvedValue(items);

      const handler = getHandler(CHANNELS.LIST_DRAWERS);
      const result = await handler({});

      expect(result).toEqual({ ok: true, data: items });
      expect(store.listDrawers).toHaveBeenCalledOnce();
    });

    it('returns FILE_NOT_FOUND error when store throws', async () => {
      vi.mocked(store.listDrawers).mockRejectedValue(new Error('boom'));

      const handler = getHandler(CHANNELS.LIST_DRAWERS);
      const result = await handler({});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND);
        expect(result.error.message).toBe('Failed to list drawers');
      }
    });
  });

  describe('create-drawer', () => {
    // The tests below used 'password12345' and 'Str0ng!Pass', neither of which any real
    // Clavis version would accept: with the store mocked, the schema was the only thing
    // that could have refused them, and it did not. Create is now the one channel where
    // the schema applies the policy, so a compliant password is the fixture every
    // non-policy test has to reach the store with.
    const COMPLIANT_PASSWORD = 'Segur0#Strong!';

    it('returns ok with encrypted drawer on success', async () => {
      const drawer: EncryptedDrawer = {
        id: VALID_UUID,
        title: 'A',
        iconData: 'rgb(0,0,0)',
        createdAt: 0,
        updatedAt: 0,
        encryptedData: 'e',
        salt: 's',
        iv: 'i',
        authTag: 'a',
        keyDerivation: { algorithm: 'argon2id', iterations: 3, memory: 262144, parallelism: 4 },
      };
      vi.mocked(store.createDrawer).mockResolvedValue(drawer);

      const handler = getHandler(CHANNELS.CREATE_DRAWER);
      const result = await handler({}, 'My Drawer', COMPLIANT_PASSWORD);

      expect(result).toEqual({ ok: true, data: drawer });
      expect(store.createDrawer).toHaveBeenCalledWith('My Drawer', COMPLIANT_PASSWORD);
    });

    it('returns VALIDATION_ERROR on Zod failure (empty title)', async () => {
      const handler = getHandler(CHANNELS.CREATE_DRAWER);
      const result = await handler({}, '', COMPLIANT_PASSWORD);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(result.error.message).toBe('Title is required');
      }
      expect(store.createDrawer).not.toHaveBeenCalled();
    });

    it('does not let a different field violation take over the policy verdict', async () => {
      // Both fields are invalid at once. PASSWORD_TOO_SHORT is deliberately chosen over
      // VALIDATION_ERROR and over the title's own issue message, because it is the code
      // with a translation and a fix attached; the title violation is not lost, it is
      // simply outranked. CreateDrawerModal screens an empty title before it ever calls
      // this channel, so the two together are a hand-crafted input rather than a real one.
      const handler = getHandler(CHANNELS.CREATE_DRAWER);
      const result = await handler({}, '', 'short');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.PASSWORD_TOO_SHORT);
        expect(result.error.message).toBe(describePasswordPolicy());
      }
      expect(store.createDrawer).not.toHaveBeenCalled();
    });

    it('reports a policy-violating password as PASSWORD_TOO_SHORT, not as a generic validation failure', async () => {
      const handler = getHandler(CHANNELS.CREATE_DRAWER);
      const result = await handler({}, 'Title', 'short');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.PASSWORD_TOO_SHORT);
      }
      expect(store.createDrawer).not.toHaveBeenCalled();
    });

    it('carries the schema issue message verbatim, so the main process holds one wording', async () => {
      const handler = getHandler(CHANNELS.CREATE_DRAWER);
      const result = await handler({}, 'Title', 'short');

      // Compared against the schema's own issue rather than a literal: ipc-handlers used
      // to carry a third copy of the sentence, which is how "upper, lower, digit,
      // symbol" (store) and "uppercase, lowercase, digit, symbol" (this file) drifted
      // apart unnoticed.
      const parsed = CreateDrawerSchema.safeParse({ title: 'Title', password: 'short' });
      if (result.ok || parsed.success) throw new Error('expected both to fail');
      expect(result.error.message).toBe(parsed.error.issues[0].message);
    });

    it.each([
      ['too few characters', 'short'],
      ['no symbol', 'Password1Only'],
      ['no uppercase letter', 'correct-123!'],
      ['no digit', 'CorrectPassword!'],
      ['no lowercase letter', 'CORRECT-123!'],
    ])('classifies a password with %s as PASSWORD_TOO_SHORT', async (_why, password) => {
      const handler = getHandler(CHANNELS.CREATE_DRAWER);
      const result = await handler({}, 'Title', password);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(ErrorCode.PASSWORD_TOO_SHORT);
      expect(store.createDrawer).not.toHaveBeenCalled();
    });

    it('never classifies on message text: a store error carrying the old wording is still a write failure', async () => {
      // The branch this suite used to pin did
      // `e.message.includes('Password must be at least 12 characters')` against the string
      // store.ts threw. Its own test compared two hardcoded copies of that sentence and
      // stayed green through any reword, while rewording the real string degraded the
      // create path to WRITE_FAILED / "Failed to create drawer" — the same cause reported
      // as a different failure. The schema now classifies, so the wording is inert: this
      // error text is exactly the one that used to trigger the match, and it must not.
      vi.mocked(store.createDrawer).mockRejectedValue(
        new Error('Password must be at least 12 characters with upper, lower, digit, symbol')
      );

      const handler = getHandler(CHANNELS.CREATE_DRAWER);
      const result = await handler({}, 'Title', COMPLIANT_PASSWORD);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.WRITE_FAILED);
        expect(result.error.message).toBe('Failed to create drawer');
      }
    });

    it('returns WRITE_FAILED on generic store error', async () => {
      vi.mocked(store.createDrawer).mockRejectedValue(new Error('disk full'));

      const handler = getHandler(CHANNELS.CREATE_DRAWER);
      const result = await handler({}, 'Title', COMPLIANT_PASSWORD);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.WRITE_FAILED);
        expect(result.error.message).toBe('Failed to create drawer');
      }
    });
  });

  describe('unlock-drawer', () => {
    it('returns ok with content on success', async () => {
      const payload = { title: 'A', content: 'hello', iconData: 'rgb(0,0,0)' };
      vi.mocked(store.unlockDrawer).mockResolvedValue({ ok: true, data: payload });

      const handler = getHandler(CHANNELS.UNLOCK_DRAWER);
      const result = await handler({}, VALID_UUID, 'password12345');

      expect(result).toEqual({ ok: true, data: payload });
      expect(store.unlockDrawer).toHaveBeenCalledWith(VALID_UUID, 'password12345');
    });

    it('returns DECRYPT_FAILED with data:null mapped to error envelope when password wrong', async () => {
      vi.mocked(store.unlockDrawer).mockResolvedValue({ ok: false, reason: 'wrong_password' });

      const handler = getHandler(CHANNELS.UNLOCK_DRAWER);
      const result = await handler({}, VALID_UUID, 'wrong-password');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.DECRYPT_FAILED);
        expect(result.error.message).toBe('Incorrect password or drawer not found');
        expect(result.error.details).toBeUndefined();
      }
    });

    it('reports an oversized drawer as CONTENT_TOO_LARGE rather than as a password failure', async () => {
      // The rescue path: a drawer already bricked on disk can never be unlocked, and
      // the honest answer is the only thing the user can act on. Reusing
      // DECRYPT_FAILED here would put them back in the lockout loop.
      vi.mocked(store.unlockDrawer).mockResolvedValue({ ok: false, reason: 'too_large' });

      const handler = getHandler(CHANNELS.UNLOCK_DRAWER);
      const result = await handler({}, VALID_UUID, 'correct-password123');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.CONTENT_TOO_LARGE);
        expect(result.error.message).toBe('Drawer content exceeds the maximum size');
      }
    });

    it('reports a drawer needing an absent KDF backend as KDF_UNAVAILABLE, not as a wrong password', async () => {
      // SEC-01 — The password was correct and was never the problem: the file needs
      // argon2 and this build did not load it. DECRYPT_FAILED would both lie to the
      // user and count the attempt against the unlock rate limiter.
      vi.mocked(store.unlockDrawer).mockResolvedValue({ ok: false, reason: 'kdf_backend_unavailable' });

      const handler = getHandler(CHANNELS.UNLOCK_DRAWER);
      const result = await handler({}, VALID_UUID, 'correct-password123');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.KDF_UNAVAILABLE);
      }
    });

    it('reports corrupt metadata as INVALID_JSON, not as a password failure', async () => {
      // SEC-05 — A damaged IV/title/icon is not a guess at the password.
      vi.mocked(store.unlockDrawer).mockResolvedValue({ ok: false, reason: 'corrupt_metadata' });

      const handler = getHandler(CHANNELS.UNLOCK_DRAWER);
      const result = await handler({}, VALID_UUID, 'correct-password123');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.INVALID_JSON);
        expect(result.error.message).toBe('The drawer metadata is corrupt');
      }
    });

    it('maps every unlock failure reason to its own code and message', async () => {
      const handler = getHandler(CHANNELS.UNLOCK_DRAWER);
      const reasons = [
        'invalid_id',
        'read_failed',
        'parse_failed',
        'corrupt_metadata',
        'kdf_out_of_bounds',
        'kdf_backend_unavailable',
        'too_large',
        'wrong_password',
      ] as const;

      const envelopes = [];
      for (const reason of reasons) {
        vi.mocked(store.unlockDrawer).mockResolvedValue({ ok: false, reason });
        const result = await handler({}, VALID_UUID, 'password12345');
        if (result.ok) throw new Error(`expected failure for ${reason}`);
        envelopes.push(`${result.error.code}:${result.error.message}`);
      }

      // Eight causes, eight distinguishable answers: a collapsed mapping is what made
      // an oversized drawer indistinguishable from a wrong password.
      expect(new Set(envelopes).size).toBe(reasons.length);
    });

    it('returns VALIDATION_ERROR on invalid id', async () => {
      const handler = getHandler(CHANNELS.UNLOCK_DRAWER);
      const result = await handler({}, 'not-a-uuid', 'password12345');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
      expect(store.unlockDrawer).not.toHaveBeenCalled();
    });

    it('returns DECRYPT_FAILED when store throws', async () => {
      vi.mocked(store.unlockDrawer).mockRejectedValue(new Error('crypto broke'));

      const handler = getHandler(CHANNELS.UNLOCK_DRAWER);
      const result = await handler({}, VALID_UUID, 'password12345');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.DECRYPT_FAILED);
        expect(result.error.message).toBe('Failed to unlock drawer');
      }
    });
  });

  // P0.6/SAV-02 — The limiter counts guesses. It used to count every failure,
  // which locked a user out of a drawer whose password had never been wrong.
  describe('unlock rate limiting', () => {
    // Each scenario uses its own id: the limiter state is module-private and there
    // is no reset hook, so ids are what keep these tests independent.
    const PASSWORD_ID = '123e4567-e89b-12d3-a456-426614174050';
    const SIZE_ID = '123e4567-e89b-12d3-a456-426614174051';
    const CORRUPT_ID = '123e4567-e89b-12d3-a456-426614174052';

    /**
     * Observes whether a handler call has settled, without awaiting it — a call
     * parked on a rate-limit timer must be observable as *not* settled.
     * `Handler<C>` is typed by the resolved value, so the promise is re-wrapped here
     * exactly as the check-update timeout test does it.
     */
    function watch<T>(result: T): { settled: () => boolean } {
      const state = { done: false };
      void Promise.resolve(result).then(() => {
        state.done = true;
      });
      return { settled: () => state.done };
    }

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('still locks out after repeated wrong passwords', async () => {
      vi.mocked(store.unlockDrawer).mockResolvedValue({ ok: false, reason: 'wrong_password' });
      const handler = getHandler(CHANNELS.UNLOCK_DRAWER);

      // Three failures are free; the fourth is parked on the 1s delay.
      for (let attempt = 0; attempt < 3; attempt++) {
        const early = watch(handler({}, PASSWORD_ID, 'wrong-password'));
        await vi.advanceTimersByTimeAsync(0);
        expect(early.settled()).toBe(true);
      }

      const locked = watch(handler({}, PASSWORD_ID, 'wrong-password'));
      await vi.advanceTimersByTimeAsync(0);
      expect(locked.settled()).toBe(false);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(locked.settled()).toBe(true);
    });

    it('never counts a non-password failure against the limiter', async () => {
      vi.mocked(store.unlockDrawer).mockResolvedValue({ ok: false, reason: 'too_large' });
      const handler = getHandler(CHANNELS.UNLOCK_DRAWER);

      // Well past the threshold: with the old condition these attempts would be
      // parked on 1s/5s/30s timers, and the user would wait out a lockout for a
      // drawer that cannot be opened at all.
      for (let attempt = 0; attempt < 8; attempt++) {
        const settled = watch(handler({}, SIZE_ID, 'correct-password123'));
        await vi.advanceTimersByTimeAsync(0);
        expect(settled.settled()).toBe(true);
      }

      // And the count was genuinely never accumulated: a wrong password on the same
      // id starts from zero rather than inheriting the failures above.
      vi.mocked(store.unlockDrawer).mockResolvedValue({ ok: false, reason: 'wrong_password' });
      const firstGuess = watch(handler({}, SIZE_ID, 'wrong-password'));
      await vi.advanceTimersByTimeAsync(0);
      expect(firstGuess.settled()).toBe(true);
    });

    it('never counts corrupt metadata against the limiter', async () => {
      // SEC-05 — The failure happened in the schema, before any key was derived or
      // any password was tried, so it is not a guess and must not be counted.
      vi.mocked(store.unlockDrawer).mockResolvedValue({ ok: false, reason: 'corrupt_metadata' });
      const handler = getHandler(CHANNELS.UNLOCK_DRAWER);

      for (let attempt = 0; attempt < 8; attempt++) {
        const settled = watch(handler({}, CORRUPT_ID, 'correct-password123'));
        await vi.advanceTimersByTimeAsync(0);
        expect(settled.settled()).toBe(true);
      }

      vi.mocked(store.unlockDrawer).mockResolvedValue({ ok: false, reason: 'wrong_password' });
      const firstGuess = watch(handler({}, CORRUPT_ID, 'wrong-password'));
      await vi.advanceTimersByTimeAsync(0);
      expect(firstGuess.settled()).toBe(true);
    });
  });

  describe('save-drawer', () => {
    it('returns ok on success', async () => {
      vi.mocked(store.saveDrawer).mockResolvedValue({ ok: true });

      const handler = getHandler(CHANNELS.SAVE_DRAWER);
      const result = await handler({}, VALID_UUID, 'password12345', 'Title', 'content');

      expect(result).toEqual({ ok: true, data: undefined });
      expect(store.saveDrawer).toHaveBeenCalledWith(VALID_UUID, 'password12345', 'Title', 'content');
    });

    it('reports an invalid id as VALIDATION_ERROR, not as a password problem', async () => {
      vi.mocked(store.saveDrawer).mockResolvedValue({ ok: false, reason: 'invalid_id' });

      const handler = getHandler(CHANNELS.SAVE_DRAWER);
      const result = await handler({}, VALID_UUID, 'wrong-password', 'Title', 'content');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(result.error.message).toBe('Invalid drawer ID');
      }
    });

    it('reports an oversized note as CONTENT_TOO_LARGE', async () => {
      // The guard working: a refusal to store is not a generic write failure, and the
      // old code reported it as "invalid ID or password".
      vi.mocked(store.saveDrawer).mockResolvedValue({ ok: false, reason: 'content_too_large' });

      const handler = getHandler(CHANNELS.SAVE_DRAWER);
      const result = await handler({}, VALID_UUID, 'password12345', 'Title', 'content');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.CONTENT_TOO_LARGE);
        expect(result.error.message).toBe('Content exceeds the maximum size');
      }
    });

    // The Zod branch of the save handler had no coverage at all, and it is invisible to
    // the test above: both it and the SaveFailureReason map emit the same
    // 'Content exceeds the maximum size', so mutating `iss.code === 'too_big'` to a
    // wrong string left all 56 tests green. Two violations, two classifications.
    it('classifies a schema ceiling violation as CONTENT_TOO_LARGE and any other as VALIDATION_ERROR', async () => {
      const handler = getHandler(CHANNELS.SAVE_DRAWER);
      const tooBig = await handler({}, VALID_UUID, 'password12345', 'Title', 'x'.repeat(MAX_CONTENT_CODE_POINTS + 1));
      // An empty password: SaveDrawerSchema holds a sanity `.min(1)` and no policy, so
      // this is the "some other schema violation" case. 'short' cannot be used — under
      // the strong policy it is still a legal save password, which is the point of
      // HYG-22's split.
      const tooShort = await handler({}, VALID_UUID, '', 'Title', 'content');
      expect({
        tooBig: { ok: tooBig.ok, code: tooBig.ok ? null : tooBig.error.code },
        tooShort: { ok: tooShort.ok, code: tooShort.ok ? null : tooShort.error.code },
      }).toEqual({
        tooBig: { ok: false, code: ErrorCode.CONTENT_TOO_LARGE },
        tooShort: { ok: false, code: ErrorCode.VALIDATION_ERROR },
      });
    });

    // HYG-22 — 'password_too_weak' was removed from the union and from SAVE_ERRORS
    // because saveDrawer cannot produce it. Listing the reasons exhaustively is what
    // keeps a removed reason from lingering in the map: the handler indexes SAVE_ERRORS
    // by reason, so an entry for a reason no store returns is untested and unreachable.
    it('maps every save failure reason to its own code and message', async () => {
      vi.mocked(store.saveDrawer).mockResolvedValue({ ok: true });
      const handler = getHandler(CHANNELS.SAVE_DRAWER);
      const reasons = [
        'invalid_id',
        'wrong_password',
        'kdf_out_of_bounds',
        'kdf_backend_unavailable',
        'content_too_large',
        'too_large',
        'write_failed',
      ] as const;

      const envelopes = [];
      for (const reason of reasons) {
        vi.mocked(store.saveDrawer).mockResolvedValue({ ok: false, reason });
        const result = await handler({}, VALID_UUID, 'password12345', 'Title', 'content');
        if (result.ok) throw new Error(`expected failure for ${reason}`);
        envelopes.push(`${result.error.code}:${result.error.message}`);
      }

      expect(new Set(envelopes).size).toBe(reasons.length);
    });

    it('reports a failed password check on save as WRONG_PASSWORD, not as a validation or write failure', async () => {
      // WRONG_PASSWORD had no assertion anywhere in the suite before HYG-22: it appears
      // in only one place in SAVE_ERRORS and in the i18n map, so deleting it — or
      // pointing it at WRITE_FAILED, which "Failed to save drawer" renders as the
      // generic "The operation could not be completed." — changed nothing observable.
      vi.mocked(store.saveDrawer).mockResolvedValue({ ok: false, reason: 'wrong_password' });

      const handler = getHandler(CHANNELS.SAVE_DRAWER);
      const result = await handler({}, VALID_UUID, 'wrong-password', 'Title', 'content');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.WRONG_PASSWORD);
        expect(result.error.message).toBe('Password is incorrect');
      }
    });

    it('returns VALIDATION_ERROR on invalid id', async () => {
      const handler = getHandler(CHANNELS.SAVE_DRAWER);
      const result = await handler({}, 'bad', 'password12345', 'Title', 'content');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
      expect(store.saveDrawer).not.toHaveBeenCalled();
    });

    it('returns WRITE_FAILED when store throws', async () => {
      vi.mocked(store.saveDrawer).mockRejectedValue(new Error('io error'));

      const handler = getHandler(CHANNELS.SAVE_DRAWER);
      const result = await handler({}, VALID_UUID, 'password12345', 'Title', 'content');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.WRITE_FAILED);
        expect(result.error.message).toBe('Failed to save drawer');
      }
    });
  });

  describe('delete-drawer', () => {
    it('returns ok on success', async () => {
      vi.mocked(store.deleteDrawer).mockResolvedValue(true);

      const handler = getHandler(CHANNELS.DELETE_DRAWER);
      const result = await handler({}, VALID_UUID);

      expect(result).toEqual({ ok: true, data: undefined });
    });

    it('returns FILE_NOT_FOUND when store returns false', async () => {
      vi.mocked(store.deleteDrawer).mockResolvedValue(false);

      const handler = getHandler(CHANNELS.DELETE_DRAWER);
      const result = await handler({}, VALID_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND);
        expect(result.error.message).toBe('Failed to delete drawer (invalid ID or drawer not found)');
      }
    });

    it('returns VALIDATION_ERROR on invalid id', async () => {
      const handler = getHandler(CHANNELS.DELETE_DRAWER);
      const result = await handler({}, 'not-a-uuid');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
      expect(store.deleteDrawer).not.toHaveBeenCalled();
    });

    it('returns WRITE_FAILED when store throws', async () => {
      vi.mocked(store.deleteDrawer).mockRejectedValue(new Error('disk error'));

      const handler = getHandler(CHANNELS.DELETE_DRAWER);
      const result = await handler({}, VALID_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.WRITE_FAILED);
      }
    });
  });

  describe('export-drawer', () => {
    it('returns ok with raw json string on success', async () => {
      const raw = '{"id":"x","title":"t"}';
      vi.mocked(store.readDrawerRaw).mockResolvedValue(raw);

      const handler = getHandler(CHANNELS.EXPORT_DRAWER);
      const result = await handler({}, VALID_UUID);

      expect(result).toEqual({ ok: true, data: raw });
    });

    it('returns FILE_NOT_FOUND when store returns null', async () => {
      vi.mocked(store.readDrawerRaw).mockResolvedValue(null);

      const handler = getHandler(CHANNELS.EXPORT_DRAWER);
      const result = await handler({}, VALID_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND);
        expect(result.error.message).toBe('Drawer not found');
      }
    });

    it('returns VALIDATION_ERROR on invalid id', async () => {
      const handler = getHandler(CHANNELS.EXPORT_DRAWER);
      const result = await handler({}, 'not-a-uuid');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
      expect(store.readDrawerRaw).not.toHaveBeenCalled();
    });

    it('returns WRITE_FAILED when store throws', async () => {
      vi.mocked(store.readDrawerRaw).mockRejectedValue(new Error('eio'));

      const handler = getHandler(CHANNELS.EXPORT_DRAWER);
      const result = await handler({}, VALID_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.WRITE_FAILED);
      }
    });
  });

  describe('open-file-dialog', () => {
    it('returns ok with data:null when user cancels (no file selected)', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: [] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (channel, listener) => { handlers.set(channel, listener); } },
        dialog: { showOpenDialog },
      });

      const result = await getHandler(CHANNELS.OPEN_FILE_DIALOG)({});
      expect(result).toEqual({ ok: true, data: null });
      expect(showOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile'],
        filters: [{ name: 'Clavis Drawers', extensions: ['clavis'] }],
      });
    });

    it('returns ok with token and fileName on valid selection', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: ['/home/user/secret.clavis'] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (channel, listener) => { handlers.set(channel, listener); } },
        dialog: { showOpenDialog },
      });

      const result = await getHandler(CHANNELS.OPEN_FILE_DIALOG)({});

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).not.toBeNull();
        expect(result.data!.fileName).toBe('secret.clavis');
        expect(result.data!.token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      }
      expect(showOpenDialog).toHaveBeenCalledOnce();
    });

    it('returns FILE_NOT_FOUND error when dialog throws', async () => {
      const showOpenDialog = vi.fn().mockRejectedValue(new Error('dialog crash'));
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (channel, listener) => { handlers.set(channel, listener); } },
        dialog: { showOpenDialog },
      });

      const result = await getHandler(CHANNELS.OPEN_FILE_DIALOG)({});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND);
        expect(result.error.message).toBe('Failed to open file dialog');
      }
    });
  });

  describe('import-drawer', () => {
    beforeEach(() => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: [] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (channel, listener) => { handlers.set(channel, listener); } },
        dialog: { showOpenDialog },
      });
      lstatMock.mockResolvedValue({ isSymbolicLink: () => false });
    });

    it('returns VALIDATION_ERROR for non-uuid token', async () => {
      const handler = getHandler(CHANNELS.IMPORT_DRAWER);
      const result = await handler({}, 'not-a-uuid');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });

    it('returns VALIDATION_ERROR "Invalid or expired import token" for unknown uuid token', async () => {
      const handler = getHandler(CHANNELS.IMPORT_DRAWER);
      const result = await handler({}, VALID_UUID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(result.error.message).toBe('Invalid or expired import token');
      }
      expect(readFileMock).not.toHaveBeenCalled();
    });

    it('returns ok after successful import and consumes token (one-shot)', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: ['/tmp/import.clavis'] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (channel, listener) => { handlers.set(channel, listener); } },
        dialog: { showOpenDialog },
      });
      const dialogResult = await getHandler(CHANNELS.OPEN_FILE_DIALOG)({});
      expect(dialogResult.ok).toBe(true);
      if (!dialogResult.ok) throw new Error('expected ok');
      const token = dialogResult.data!.token;

      readFileMock.mockResolvedValue('{"id":"x","title":"t","iconData":"i","createdAt":0,"updatedAt":0,"encryptedData":"e","salt":"s","iv":"i","authTag":"a","keyDerivation":{"algorithm":"x","iterations":1,"memory":1,"parallelism":1}}');
      vi.mocked(store.importDrawerRaw).mockResolvedValue(true);

      const handler = getHandler(CHANNELS.IMPORT_DRAWER);
      const result = await handler({}, token);

      expect(result).toEqual({ ok: true, data: undefined });
      expect(readFileMock).toHaveBeenCalledWith('/tmp/import.clavis', 'utf8');
      expect(store.importDrawerRaw).toHaveBeenCalledOnce();

      const replay = await handler({}, token);
      expect(replay.ok).toBe(false);
      if (!replay.ok) {
        expect(replay.error.message).toBe('Invalid or expired import token');
      }
    });

    it('returns INVALID_JSON when importDrawerRaw returns false', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: ['/tmp/bad.clavis'] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (channel, listener) => { handlers.set(channel, listener); } },
        dialog: { showOpenDialog },
      });
      const dialogResult = await getHandler(CHANNELS.OPEN_FILE_DIALOG)({});
      if (!dialogResult.ok) throw new Error('expected ok');
      const token = dialogResult.data!.token;

      readFileMock.mockResolvedValue('garbage');
      vi.mocked(store.importDrawerRaw).mockResolvedValue(false);

      const handler = getHandler(CHANNELS.IMPORT_DRAWER);
      const result = await handler({}, token);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.INVALID_JSON);
        expect(result.error.message).toBe('Failed to import drawer (invalid file format)');
      }
    });

    it('returns FILE_NOT_FOUND when fs.readFile throws', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: ['/tmp/missing.clavis'] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (channel, listener) => { handlers.set(channel, listener); } },
        dialog: { showOpenDialog },
      });
      const dialogResult = await getHandler(CHANNELS.OPEN_FILE_DIALOG)({});
      if (!dialogResult.ok) throw new Error('expected ok');
      const token = dialogResult.data!.token;

      readFileMock.mockRejectedValue(new Error('ENOENT'));

      const handler = getHandler(CHANNELS.IMPORT_DRAWER);
      const result = await handler({}, token);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND);
        expect(result.error.message).toBe('Failed to read import file');
      }
    });

    it('strips exception details from import error envelope (details === undefined)', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: ['/tmp/leak.clavis'] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (channel, listener) => { handlers.set(channel, listener); } },
        dialog: { showOpenDialog },
      });
      const dialogResult = await getHandler(CHANNELS.OPEN_FILE_DIALOG)({});
      if (!dialogResult.ok) throw new Error('expected ok');
      const token = dialogResult.data!.token;

      readFileMock.mockRejectedValue(new Error('read failed: file contents leaked into message'));

      const handler = getHandler(CHANNELS.IMPORT_DRAWER);
      const result = await handler({}, token);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.FILE_NOT_FOUND);
        expect(result.error.details).toBeUndefined();
      }
    });

    it('returns VALIDATION_ERROR "Refusing to import a symbolic link" when file is a symlink', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: ['/tmp/link.clavis'] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (channel, listener) => { handlers.set(channel, listener); } },
        dialog: { showOpenDialog },
      });
      const dialogResult = await getHandler(CHANNELS.OPEN_FILE_DIALOG)({});
      if (!dialogResult.ok) throw new Error('expected ok');
      const token = dialogResult.data!.token;

      lstatMock.mockResolvedValue({ isSymbolicLink: () => true });

      const handler = getHandler(CHANNELS.IMPORT_DRAWER);
      const result = await handler({}, token);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(result.error.message).toBe('Refusing to import a symbolic link');
      }
      expect(readFileMock).not.toHaveBeenCalled();
      expect(store.importDrawerRaw).not.toHaveBeenCalled();
    });

    // Block B — The import handler already held the lstat result and discarded
    // stat.size, so the read itself stayed unbounded: the cap in importDrawerRaw
    // runs on a string already in memory. The shape that can fail on the real
    // defect: stat resolves over the cap, readFile would throw if called, and
    // the handler must refuse — a call-shape assertion ("stat was consulted")
    // stays green if the comparison uses the wrong constant or the wrong branch.
    it('refuses an over-cap file before reading it, using the lstat size', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: ['/tmp/huge.clavis'] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (channel, listener) => { handlers.set(channel, listener); } },
        dialog: { showOpenDialog },
      });
      const dialogResult = await getHandler(CHANNELS.OPEN_FILE_DIALOG)({});
      if (!dialogResult.ok) throw new Error('expected ok');
      const token = dialogResult.data!.token;

      // The handler holds this lstat result and reads stat.size off it — the
      // size the real code discarded.
      lstatMock.mockResolvedValue({ isSymbolicLink: () => false, size: store.MAX_DRAWER_FILE_SIZE + 1 });
      readFileMock.mockRejectedValue(new Error('must not read an over-cap file'));
      vi.mocked(store.importDrawerRaw).mockResolvedValue(true);

      const handler = getHandler(CHANNELS.IMPORT_DRAWER);
      const result = await handler({}, token);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.WRITE_FAILED);
        // Locale-independent: the handler's message is built in getLocale(),
        // so the assertion pins *which* message, not which language.
        expect(result.error.message).toMatch(/too large|demasiado grande/i);
      }
      expect(readFileMock).not.toHaveBeenCalled();
      expect(store.importDrawerRaw).not.toHaveBeenCalled();
    });

    // The two refusals importDrawerRaw throws by type, re-thrown by it specifically so this
    // layer can name them. The handler used to read their message text instead, which meant a
    // reword of either class turned a known refusal into "Failed to read import file". These
    // two tests reword the message on purpose: classification has to follow the type.
    it.each([
      {
        name: 'FileTooLargeError',
        build: () => new store.FileTooLargeError(),
        expected: /too large|demasiado grande/i,
      },
      {
        name: 'DrawerAlreadyExistsError',
        build: () => new store.DrawerAlreadyExistsError('11111111-1111-4111-8111-111111111111'),
        expected: /already exists|já existe/i,
      },
    ])('names a $name by its type even after its message is reworded', async ({ build, expected }) => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: ['/tmp/import.clavis'] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (channel, listener) => { handlers.set(channel, listener); } },
        dialog: { showOpenDialog },
      });
      const dialogResult = await getHandler(CHANNELS.OPEN_FILE_DIALOG)({});
      if (!dialogResult.ok) throw new Error('expected ok');
      const token = dialogResult.data!.token;

      readFileMock.mockResolvedValue('{"id":"x"}');
      const thrown = build();
      thrown.message = 'a wording this handler has never seen';
      vi.mocked(store.importDrawerRaw).mockRejectedValue(thrown);

      const result = await getHandler(CHANNELS.IMPORT_DRAWER)({}, token);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.WRITE_FAILED);
        expect(result.error.message).toMatch(expected);
      }
    });
  });

  describe('get-app-version', () => {
    it('returns the version reported by electron', async () => {
      vi.mocked(app.getVersion).mockReturnValue('0.4.9-beta');

      const handler = getHandler(CHANNELS.GET_APP_VERSION);
      const result = await handler({});

      expect(result).toBe('0.4.9-beta');
      expect(app.getVersion).toHaveBeenCalledOnce();
    });
  });

  describe('restart-app', () => {
    it('relaunches, quits on the next tick and returns ok', async () => {
      const handler = getHandler(CHANNELS.RESTART_APP);
      const result = await handler({});

      expect(result).toEqual({ ok: true, data: undefined });
      expect(app.relaunch).toHaveBeenCalledOnce();

      // `setImmediate(() => app.quit())` is scheduled, not awaited, by the handler;
      // letting it drain here keeps the assertion honest and leaves no pending
      // immediate that could land inside a later test.
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(app.quit).toHaveBeenCalledOnce();
    });

    it('returns a WRITE_FAILED envelope when relaunch throws, and never quits', async () => {
      vi.mocked(app.relaunch).mockImplementationOnce(() => {
        throw new Error('spawn ENOENT');
      });

      const handler = getHandler(CHANNELS.RESTART_APP);
      const result = await handler({});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(ErrorCode.WRITE_FAILED);
        expect(result.error.message).toBe('Failed to restart app');
        expect(result.error.details).toBeUndefined();
      }
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(app.quit).not.toHaveBeenCalled();
    });
  });

  describe('check-update', () => {
    it('returns the tag from a well-formed 2xx body', async () => {
      stubHttps({ body: '{"tag_name":"v9.9.9","name":"Clavis 9.9.9"}' });

      const handler = getHandler(CHANNELS.CHECK_UPDATE);
      const result = await handler({});

      expect(result).toEqual({ tag_name: 'v9.9.9' });
      expect(httpsGetMock).toHaveBeenCalledWith(
        'https://api.github.com/repos/ribaudequin/clavis/releases/latest',
        { headers: { 'User-Agent': 'Clavis' } },
        expect.any(Function)
      );
    });

    it('returns no tag for a 2xx body without one', async () => {
      stubHttps({ body: '{}' });

      const handler = getHandler(CHANNELS.CHECK_UPDATE);
      const result = await handler({});

      expect(result).toEqual({ tag_name: undefined });
      expect(result?.tag_name).toBeUndefined();
    });

    it('returns null when the response stream errors after the headers', async () => {
      stubHttps({ body: '{"tag_name":"v9.9.9"}', streamError: new Error('ECONNRESET') });

      const handler = getHandler(CHANNELS.CHECK_UPDATE);
      const result = await handler({});

      expect(result).toBeNull();
    });

    it('returns null when the request errors', async () => {
      const stub = stubHttps({ stall: true });

      const handler = getHandler(CHANNELS.CHECK_UPDATE);
      const settled = handler({});
      stub.failRequest(new Error('ENOTFOUND'));

      expect(await settled).toBeNull();
    });

    it('returns null on a non-2xx status without parsing the body', async () => {
      stubHttps({ statusCode: 403, body: '{"message":"API rate limit exceeded"}' });

      const handler = getHandler(CHANNELS.CHECK_UPDATE);
      const result = await handler({});

      expect(result).toBeNull();
    });

    it('returns null on a 5xx status', async () => {
      stubHttps({ statusCode: 503, body: '{"tag_name":"v9.9.9"}' });

      const handler = getHandler(CHANNELS.CHECK_UPDATE);
      const result = await handler({});

      expect(result).toBeNull();
    });

    it('returns null on malformed JSON', async () => {
      stubHttps({ body: 'not-json{' });

      const handler = getHandler(CHANNELS.CHECK_UPDATE);
      const result = await handler({});

      expect(result).toBeNull();
    });

    it('returns null, not "42", when tag_name is not a string', async () => {
      stubHttps({ body: '{"tag_name":42}' });

      const handler = getHandler(CHANNELS.CHECK_UPDATE);
      const result = await handler({});

      expect(result).toBeNull();
    });

    it('returns null when a payload without an object root arrives', async () => {
      stubHttps({ body: '"v9.9.9"' });

      const handler = getHandler(CHANNELS.CHECK_UPDATE);
      const result = await handler({});

      expect(result).toBeNull();
    });

    it('resolves null and destroys the request when the response never arrives', async () => {
      const stub = stubHttps({ stall: true });
      vi.useFakeTimers();
      try {
        let settled: PendingSettlement = { done: false };
        // `Handler<C>` is typed by the resolved value, so wrap the real promise
        // back up to observe *whether* it settles, not only what it resolves to.
        void Promise.resolve(getHandler(CHANNELS.CHECK_UPDATE)({})).then((value) => {
          settled = { done: true, value };
        });

        // Ten virtual minutes: no timeout value a reviewer would accept survives
        // this, so the test pins "it settles", not "it settles in 5s".
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

        expect(settled).toEqual({ done: true, value: null });
        expect(stub.destroy).toHaveBeenCalledOnce();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('handler registration', () => {
    it('registers all expected channels', () => {
      const expected: Channel[] = [
        CHANNELS.LIST_DRAWERS,
        CHANNELS.CREATE_DRAWER,
        CHANNELS.UNLOCK_DRAWER,
        CHANNELS.SAVE_DRAWER,
        CHANNELS.DELETE_DRAWER,
        CHANNELS.EXPORT_DRAWER,
        CHANNELS.OPEN_FILE_DIALOG,
        CHANNELS.IMPORT_DRAWER,
        CHANNELS.RESTART_APP,
        CHANNELS.GET_APP_VERSION,
        CHANNELS.CHECK_UPDATE,
      ];
      for (const channel of expected) {
        expect(handlers.has(channel), `missing handler for ${channel}`).toBe(true);
      }
      expect(handlers.size).toBe(expected.length);
    });
  });

  describe('Result envelope', () => {
    it('always returns either ok:true with data or ok:false with structured error', async () => {
      vi.mocked(store.listDrawers).mockRejectedValue(new Error('x'));
      const handler = getHandler(CHANNELS.LIST_DRAWERS);
      const result = await handler({});
      expect('ok' in result).toBe(true);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toHaveProperty('code');
        expect(result.error).toHaveProperty('message');
        expect(Object.values(ErrorCode)).toContain(result.error.code);
      }
    });
  });

  describe('token whitelist (allowedImportPaths)', () => {
    it('__resetAllowedImportPaths clears the whitelist', async () => {
      const showOpenDialog = vi.fn().mockResolvedValue({ filePaths: ['/tmp/a.clavis'] });
      handlers.clear();
      registerIpcHandlers({
        ipcMain: { handle: (channel, listener) => { handlers.set(channel, listener); } },
        dialog: { showOpenDialog },
      });
      const dlgResult = await getHandler(CHANNELS.OPEN_FILE_DIALOG)({});
      if (!dlgResult.ok) throw new Error('expected ok');
      const token = dlgResult.data!.token;

      readFileMock.mockResolvedValue('{}');
      vi.mocked(store.importDrawerRaw).mockResolvedValue(true);
      await getHandler(CHANNELS.IMPORT_DRAWER)({}, token);

      __resetAllowedImportPaths();
      const replay = await getHandler(CHANNELS.IMPORT_DRAWER)({}, VALID_UUID_2);
      expect(replay.ok).toBe(false);
      if (!replay.ok) {
        expect(replay.error.message).toBe('Invalid or expired import token');
      }
    });
  });
});
