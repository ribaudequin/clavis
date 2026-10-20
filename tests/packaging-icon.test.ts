// The app icon, in the three places it has to be right: the packaged executable,
// the window at runtime, and the installers.
//
// This file exists because all three were wrong at once, and wrong SILENTLY.
//
// The packaged executable: `packagerConfig.icon` was `icons/linux/512x512.png`,
// and electron-packager resolves the platform's format by rewriting the
// extension in place — `.png` becomes `.ico` on Windows and `.icns` on macOS,
// in the same directory. `icons/linux/512x512.ico` and `icons/linux/512x512.icns`
// do not exist, so the packager printed
//
//     WARNING: Could not find icon "icons/linux/512x512.ico", not updating app icon
//
// and carried on. The Windows executable shipped with Electron's default icon.
// The macOS `.app` had the same defect. Nobody read the warning because the
// Windows and macOS builds had never been RUN — the e2e suite is Linux-only —
// and a build log nobody reads is not a guard.
//
// The window at runtime: `path.join(__dirname, '..', 'icons', …)` resolves to
// `<app root>/dist/icons/…`, which does not exist. The main process runs from
// `<app root>/dist/main` and the icons sit at `<app root>/icons`, a sibling of
// `dist`, so the path needed TWO levels up. The option was ignored and the
// window kept Electron's default icon.
//
// The fix is a layout, not a path: the three formats sit side by side with the
// same basename — `icons/clavis.png`, `icons/clavis.ico`, `icons/clavis.icns` —
// because the packager's rewrite can only find a format that is a sibling of
// the configured one. This file is what keeps that layout from rotting.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';

const nodeRequire = createRequire(__filename);
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')
) as {
  config: {
    forge: {
      packagerConfig: { icon?: string; ignore?: string[] };
      makers: Array<{ name: string; config?: Record<string, unknown> }>;
    };
  };
};

const APP_ROOT = path.resolve(__dirname, '..');

/**
 * electron-packager's own resolution, not a re-implementation of it.
 *
 * The packager rewrites the extension of `opts.icon` in place and, if the
 * rewritten file is missing, warns and returns undefined — which is exactly the
 * silent failure this file exists to catch. Using the packager's method means
 * the test keeps meaning what it means if the packager changes its rule; a
 * hand-written copy of the rule would only assert what the author believed.
 */
const Platform = nodeRequire('electron-packager/src/platform.js') as {
  prototype: IconResolver;
};

/** The slice of electron-packager's platform class this file uses. */
interface IconResolver {
  opts: { icon: string };
  normalizeIconExtension(targetExtension: string): Promise<string | undefined>;
}

async function resolveIcon(icon: string, extension: string): Promise<string | undefined> {
  const platform = Object.create(Platform.prototype) as IconResolver;
  platform.opts = { icon };
  return platform.normalizeIconExtension(extension);
}

// The format each platform's packager looks for. The packager's three platform
// classes ask for exactly these, in this order.
const PLATFORM_FORMATS: Array<{ platform: string; extension: string }> = [
  { platform: 'win32', extension: '.ico' },
  { platform: 'darwin', extension: '.icns' },
  { platform: 'linux', extension: '.png' },
];

describe('the packaged executable carries the app icon on every platform', () => {
  it('has a configured icon at all', () => {
    expect(pkg.config.forge.packagerConfig.icon).toBeTruthy();
  });

  it.each(PLATFORM_FORMATS)(
    'resolves to a file that exists for $platform',
    async ({ platform, extension }) => {
      const configured = pkg.config.forge.packagerConfig.icon;
      expect(configured, 'the packager has no icon configured').toBeTruthy();

      const resolved = await resolveIcon(configured as string, extension);

      // The failure this catches is a MISSING file, not a wrong path: the
      // packager resolves the extension in place, so a configured path whose
      // siblings do not exist resolves to nothing and the icon is skipped.
      expect(
        resolved,
        `the packager would skip the ${platform} icon: ${configured} has no ` +
          `${extension} sibling next to it`
      ).toBeTruthy();
      expect(fs.existsSync(resolved as string)).toBe(true);
    }
  );

  it('keeps the three formats side by side with the same basename', () => {
    // The layout the rewrite depends on. A file that moves into a directory of
    // its own, or takes a different basename, breaks the resolution for the
    // platforms that are not the configured one — silently, again.
    const configured = pkg.config.forge.packagerConfig.icon as string;
    const directory = path.dirname(configured);
    const basename = path.basename(configured, path.extname(configured));

    for (const { extension } of PLATFORM_FORMATS) {
      const sibling = path.join(directory, basename + extension);
      expect(fs.existsSync(sibling), `${sibling} is missing`).toBe(true);
    }
  });

  it('points every maker that takes a local icon at a file that exists', () => {
    for (const maker of pkg.config.forge.makers) {
      const config = maker.config ?? {};
      for (const [key, value] of Object.entries(config)) {
        if (typeof value !== 'string') continue;
        if (!key.toLowerCase().includes('icon')) continue;
        // `iconUrl` is a URL the installer downloads at install time, not a
        // local file — it is checked separately.
        if (key.toLowerCase() === 'iconurl') continue;
        expect(
          fs.existsSync(path.resolve(APP_ROOT, value)),
          `${maker.name}'s ${key} points at ${value}, which does not exist`
        ).toBe(true);
      }
    }
  });
});

describe('the window icon resolves at runtime', () => {
  const MAIN_SOURCE = path.resolve(APP_ROOT, 'src', 'main', 'index.ts');

  /** The `path.join(__dirname, …)` calls in the main process, as written. */
  function iconPathsInSource(): string[][] {
    const source = fs.readFileSync(MAIN_SOURCE, 'utf8');
    const joins = [...source.matchAll(/path\.join\(__dirname[^)]*\)/g)].map((match) => match[0]);
    return joins
      .filter((join) => join.includes("'icons'"))
      .map((join) => [...join.matchAll(/'([^']+)'/g)].map((segment) => segment[1]));
  }

  it('names one icon per platform, and every one of them exists', () => {
    const paths = iconPathsInSource();

    // Three: win32, darwin, and the fallback for everything else.
    expect(paths).toHaveLength(3);

    // `__dirname` is the main process's own directory: `<app root>/dist/main`,
    // in development and inside the packaged app alike. Resolving against it
    // is what the runtime does — resolving against the app root would climb
    // two levels *above* it, which is a different path entirely.
    const mainDir = path.join(APP_ROOT, 'dist', 'main');

    for (const segments of paths) {
      // The icons sit at `<app root>/icons`, a sibling of `dist`, so the path
      // has to climb TWO levels. One level resolves inside `dist`, where there
      // is no `icons`.
      //
      // `segments` holds the quoted parts only — `__dirname` is not one of
      // them, so nothing is dropped from the front: the segments ARE the
      // relative part of the path.
      const resolved = path.resolve(mainDir, ...segments);
      expect(
        fs.existsSync(resolved),
        `the window icon path resolves to ${resolved}, which does not exist`
      ).toBe(true);
      expect(resolved.startsWith(path.join(APP_ROOT, 'icons')), resolved).toBe(true);
    }
  });

  it('climbs two levels, because the icons are a sibling of dist and not inside it', () => {
    // The depth is the whole bug: with one `..` the path points at
    // `<app root>/dist/icons/…`, which no build produces.
    for (const segments of iconPathsInSource()) {
      expect(segments.filter((segment) => segment === '..')).toHaveLength(2);
    }
  });
});
