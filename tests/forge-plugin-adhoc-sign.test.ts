// The macOS ad-hoc signature.
//
// Why this file exists: the packaged `.app` was never signed, and the
// packager's renames invalidate the signature Electron itself ships with, so on
// arm64 macOS the bundle was killed at launch. The bundle is now signed ad-hoc
// by a Forge plugin (`scripts/forge-plugin-adhoc-sign.js`), and the three
// things that plugin must get right are asserted here:
//
//   1. it does nothing at all on any platform but macOS — the plugin is
//      registered for every platform, so on Linux and Windows it must not even
//      look for `codesign`;
//   2. on macOS it signs every bundle in the packaged output with the ad-hoc
//      identity `-` (no certificate, no Apple account, no money) and leaves
//      everything that is not a bundle alone;
//   3. a `codesign` failure FAILS THE BUILD — the alternative is a `.dmg` whose
//      app cannot launch on arm64, which is the exact bug the plugin exists to
//      prevent.
//
// The plugin is a CommonJS script outside the TypeScript program, so it is
// loaded through a dynamic import whose specifier is not a literal: a literal
// one would make `tsc` demand a declaration file for it. The dynamic import is
// also what lets vitest's `child_process` mock reach the plugin's own import.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createRequire } from 'module';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'child_process';

const execFileSyncMock = vi.mocked(execFileSync);

const nodeRequire = createRequire(__filename);
const APP_ROOT = path.resolve(__dirname, '..');

/**
 * The plugin's specifier, typed as `string` on purpose: a literal type would
 * make TypeScript resolve the module and demand a declaration file for a
 * script that is deliberately outside the TypeScript program.
 */
const PLUGIN_SPECIFIER: string = '../scripts/forge-plugin-adhoc-sign.js';

interface PostPackageArgs {
  platform: string;
  outputPaths: string[];
}

interface ForgePlugin {
  name: string;
  init(dir: string, forgeConfig: unknown): void;
  getHooks(): {
    postPackage: (forgeConfig: unknown, args: PostPackageArgs) => Promise<void>;
  };
}

type ForgePluginConstructor = new (config?: unknown) => ForgePlugin;

let Plugin: ForgePluginConstructor;

/** A plugin instance with its hooks resolved, the way Forge resolves them. */
function createPlugin(): ForgePlugin {
  const plugin = new Plugin();
  plugin.init(APP_ROOT, {});
  return plugin;
}

beforeAll(async () => {
  const loaded = (await import(PLUGIN_SPECIFIER)) as { default: ForgePluginConstructor };
  Plugin = loaded.default;
});

beforeEach(() => {
  execFileSyncMock.mockReset();
  // The plugin reports what it signed; the test output does not need it.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the ad-hoc signing plugin', () => {
  it.each(['linux', 'win32'])('does nothing at all on %s', async (platform) => {
    // The plugin is registered on every platform, and the other two must not
    // even look for `codesign` — on Linux there is no such tool, and a Windows
    // build has no business being signed by a macOS plugin.
    //
    // The output path handed over is a macOS BUNDLE on purpose: a path that
    // held no bundle would let a plugin that ignored the platform pass this
    // test by accident, having found nothing to sign.
    const plugin = createPlugin();

    await plugin.getHooks().postPackage(
      {},
      {
        platform,
        outputPaths: [path.join(APP_ROOT, 'out', 'clavis-darwin-arm64', 'clavis.app')],
      }
    );

    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('signs the bundle in the packaged output and verifies the signature', async () => {
    const bundle = path.join(APP_ROOT, 'out', 'clavis-darwin-arm64', 'clavis.app');
    const plugin = createPlugin();

    await plugin.getHooks().postPackage(
      {},
      { platform: 'darwin', outputPaths: [bundle] }
    );

    expect(execFileSyncMock).toHaveBeenCalledTimes(2);
    expect(execFileSyncMock).toHaveBeenNthCalledWith(
      1,
      'codesign',
      ['--force', '--deep', '--sign', '-', bundle],
      expect.anything()
    );
    expect(execFileSyncMock).toHaveBeenNthCalledWith(
      2,
      'codesign',
      ['--verify', '--deep', bundle],
      expect.anything()
    );
  });

  it('signs with the ad-hoc identity and not with a certificate', async () => {
    // The identity is the whole point: `-` signs the bundle without a
    // certificate, which is free. A `Developer ID Application` identity would
    // cost $99 a year, and the project has no funding for it.
    const bundle = path.join(APP_ROOT, 'out', 'clavis-darwin-arm64', 'clavis.app');
    const plugin = createPlugin();

    await plugin.getHooks().postPackage(
      {},
      { platform: 'darwin', outputPaths: [bundle] }
    );

    const [, args] = execFileSyncMock.mock.calls[0] as [string, string[]];
    expect(args).toEqual(['--force', '--deep', '--sign', '-', bundle]);
    expect(args).not.toContain('Developer ID');
    expect(args).not.toContain('Mac Developer');
  });

  it('finds the bundle inside the platform directory electron-packager produces', async () => {
    // electron-packager resolves to `out/clavis-darwin-arm64`, and the bundle
    // is INSIDE it — so a plugin that only looked at the path it was handed
    // would sign nothing at all, and the macOS leg would stay red.
    const platformDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clavis-darwin-'));
    const bundle = path.join(platformDir, 'clavis.app');
    fs.mkdirSync(bundle);
    fs.writeFileSync(path.join(platformDir, 'LICENSE'), 'license');

    try {
      const plugin = createPlugin();

      await plugin.getHooks().postPackage(
        {},
        { platform: 'darwin', outputPaths: [platformDir] }
      );

      expect(execFileSyncMock).toHaveBeenCalledTimes(2);
      expect(execFileSyncMock).toHaveBeenNthCalledWith(
        1,
        'codesign',
        ['--force', '--deep', '--sign', '-', bundle],
        expect.anything()
      );
    } finally {
      fs.rmSync(platformDir, { recursive: true, force: true });
    }
  });

  it('skips the output paths that are not bundles', async () => {
    const plugin = createPlugin();

    await plugin.getHooks().postPackage(
      {},
      {
        platform: 'darwin',
        outputPaths: [
          path.join(APP_ROOT, 'out', 'clavis-darwin-arm64', 'clavis.app'),
          path.join(APP_ROOT, 'out', 'clavis-darwin-arm64', 'LICENSE'),
          path.join(APP_ROOT, 'out', 'clavis-win32-x64', 'clavis.exe'),
        ],
      }
    );

    // Two calls, both for the one bundle: the other two paths are not bundles
    // and contribute nothing.
    expect(execFileSyncMock).toHaveBeenCalledTimes(2);
    for (const call of execFileSyncMock.mock.calls) {
      const [command, args] = call as [string, string[]];
      expect(command).toBe('codesign');
      expect(args[args.length - 1]).toContain('clavis.app');
    }
  });

  it('fails the build when codesign fails, and says why', async () => {
    // The alternative — warning and carrying on — ships a `.dmg` whose app
    // cannot launch on arm64. So the failure has to stop the build, and the
    // message has to carry enough to act on: the command, the exit code and
    // the tool's own stderr.
    execFileSyncMock.mockImplementation(() => {
      const error = new Error('Command failed: codesign');
      Object.assign(error, {
        status: 1,
        stderr: 'code object is not signed at all\n',
      });
      throw error;
    });

    const bundle = path.join(APP_ROOT, 'out', 'clavis-darwin-arm64', 'clavis.app');
    const plugin = createPlugin();

    let thrown: unknown;
    try {
      await plugin.getHooks().postPackage({}, { platform: 'darwin', outputPaths: [bundle] });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain(`codesign --force --deep --sign - ${bundle}`);
    expect(message).toContain('exit code 1');
    expect(message).toContain('code object is not signed at all');
  });
});

describe('the plugin is registered the way Forge requires', () => {
  const forgeConfig = (
    JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8')) as {
      config: { forge: { plugins: Array<{ name: string; config?: unknown }> } };
    }
  ).config.forge;

  it('is declared in the forge config', () => {
    expect(forgeConfig.plugins).toHaveLength(1);
    expect(forgeConfig.plugins[0].name).toBe('./scripts/forge-plugin-adhoc-sign.js');
  });

  it('declares a config object, because Forge requires both keys', () => {
    // Forge's plugin interface only accepts an entry that has BOTH `name` and
    // `config`; an entry with a name alone is rejected outright, with an
    // error that names neither the file nor the missing key.
    expect(forgeConfig.plugins[0]).toHaveProperty('config');
  });

  it('is resolvable by Forge, from the project directory, as a constructor', () => {
    // Forge's own resolver, not a re-implementation of it: the local-file
    // plugin route only works if Forge can find and construct the module.
    const requireSearch = nodeRequire(
      '@electron-forge/core/dist/util/require-search.js'
    ) as { default: (dir: string, paths: string[]) => unknown };

    const resolved = requireSearch.default(APP_ROOT, [
      './scripts/forge-plugin-adhoc-sign.js',
    ]);

    expect(typeof resolved).toBe('function');
    const instance = new (resolved as ForgePluginConstructor)({});
    expect(instance.name).toBe('adhoc-sign');
    expect(typeof instance.getHooks().postPackage).toBe('function');
  });
});
