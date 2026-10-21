'use strict';

/**
 * Electron Forge plugin: ad-hoc code signing of the macOS bundle.
 *
 * Why this exists
 * ---------------
 * `electron-packager` renames the bundle it copies out of Electron
 * (`renameElectron()` and `renameAppAndHelpers()`), and those renames invalidate
 * the signature Electron itself ships with. On arm64 macOS an invalid
 * signature is a SIGKILL at launch, so the packaged `.app` has to be signed
 * again AFTER the packager is done with it. The packager's own signing step
 * (`signAppIfSpecified()`) is a no-op unless `osxSign` is set, and it runs
 * before the renames are worth trusting anyway — so the signing happens here,
 * in Forge's `postPackage` hook, which runs once the bundle is on disk.
 *
 * `packagerConfig.osxSign` cannot do this job: `identity: null` is falsy, so
 * `@electron/osx-sign` 1.3.3 takes its "no identity was passed" branch, looks
 * for a `Developer ID Application` certificate in the keychain, finds none, and
 * throws `No identity found for signing.` — and Forge hardcodes `quiet: true`,
 * so the failure would be invisible in the build log. An ad-hoc signature needs
 * no certificate, no Apple account and no money, so `codesign` is invoked
 * directly instead.
 *
 * What this does NOT do
 * ---------------------
 * It does not notarise. Notarisation is what removes the Gatekeeper
 * "downloaded from the internet" warning, and it requires a paid Apple
 * Developer ID certificate — out of scope for this project, which has no
 * funding for it.
 */

const fs = require('fs');
const path = require('path');

/** The ad-hoc identity: a bare `-` means "sign this, with no certificate". */
const ADHOC_IDENTITY = '-';

/** The macOS code-signing tool. It exists only on macOS. */
const CODESIGN = 'codesign';

/** The extension macOS uses for an application bundle. */
const APP_EXTENSION = '.app';

class AdhocSignPlugin {
  constructor(config) {
    this.config = config || {};
    this.name = 'adhoc-sign';

    // The marker Forge looks for on a plugin instance.
    Object.defineProperty(this, '__isElectronForgePlugin', {
      value: true,
      enumerable: false,
      configurable: false,
    });
  }

  /**
   * Resolves the hooks exactly once, the way `@electron-forge/plugin-base`
   * does: the hook list must not be rebuilt on every lookup.
   */
  init(_dir, _forgeConfig) {
    this._resolvedHooks = this.getHooks();
    this.getHooks = () => this._resolvedHooks;
  }

  getHooks() {
    return {
      postPackage: async (_forgeConfig, { platform, outputPaths }) => {
        await signAdHocApps(platform, outputPaths);
      },
    };
  }
}

/**
 * Signs every macOS bundle in the packaged output, ad-hoc, and verifies each
 * signature it writes.
 *
 * A no-op on every platform but macOS: the plugin is registered for all of
 * them, so on Linux and Windows it must not even look for `codesign`.
 */
async function signAdHocApps(platform, outputPaths) {
  if (platform !== 'darwin') {
    return;
  }

  const bundles = collectAppBundles(outputPaths);
  if (bundles.length === 0) {
    console.warn('[adhoc-sign] no macOS application bundle found in the packaged output.');
    return;
  }

  for (const bundle of bundles) {
    await runCodesign(['--force', '--deep', '--sign', ADHOC_IDENTITY, bundle]);
    await runCodesign(['--verify', '--deep', bundle]);
    console.log(`[adhoc-sign] ad-hoc signed ${bundle}`);
  }
}

/**
 * The application bundles in the packaged output.
 *
 * Forge hands the hook the packager's output paths, and electron-packager
 * resolves those to the PLATFORM DIRECTORY (`out/clavis-darwin-arm64`), not to
 * the bundle inside it (`out/clavis-darwin-arm64/clavis.app`). Both shapes are
 * therefore handled: a path that IS a bundle, and a directory that CONTAINS
 * one. Anything else — the flat output of the other platforms, a path that
 * does not exist — contributes no bundle.
 */
function collectAppBundles(outputPaths) {
  const bundles = [];

  for (const outputPath of outputPaths || []) {
    if (typeof outputPath !== 'string' || outputPath.length === 0) {
      continue;
    }

    if (outputPath.endsWith(APP_EXTENSION)) {
      bundles.push(outputPath);
      continue;
    }

    let entries;
    try {
      entries = fs.readdirSync(outputPath, { withFileTypes: true });
    } catch {
      // Not a directory, or not there: there is no bundle in it.
      continue;
    }

    for (const entry of entries) {
      if (!entry.name.endsWith(APP_EXTENSION)) {
        continue;
      }
      const candidate = path.join(outputPath, entry.name);
      if (isDirectory(candidate)) {
        bundles.push(candidate);
      }
    }
  }

  return bundles;
}

function isDirectory(candidate) {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Runs `codesign` and turns a failure into a failure of the build.
 *
 * The alternative — warning and carrying on — ships a `.dmg` whose app cannot
 * launch on arm64, which is the exact bug this plugin exists to prevent. So the
 * error carries the command, the exit code and the tool's own stderr, and it
 * is thrown rather than swallowed.
 */
async function runCodesign(args) {
  // `child_process` is imported dynamically so that the unit test can mock the
  // module: a static `require` would bind the real one before the mock applies.
  const childProcess = await import('child_process');
  const execFileSync = childProcess.execFileSync || childProcess.default?.execFileSync;

  try {
    execFileSync(CODESIGN, args, { stdio: 'pipe' });
  } catch (error) {
    throw new Error(failureMessage(args, error));
  }
}

function failureMessage(args, error) {
  const exitCode = typeof error?.status === 'number' ? error.status : 'unknown';
  const errorCode = error?.code ? `, code ${error.code}` : '';
  const stderr = error?.stderr ? String(error.stderr).trim() : '';

  return [
    `Ad-hoc code signing failed (exit code ${exitCode}${errorCode}).`,
    `Command: ${CODESIGN} ${args.map(quoteArgument).join(' ')}`,
    `stderr: ${stderr || '(empty)'}`,
  ].join('\n');
}

function quoteArgument(value) {
  return /\s/.test(value) ? JSON.stringify(value) : value;
}

module.exports = AdhocSignPlugin;
