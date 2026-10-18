// One locator for the built application, shared by every e2e spec.
//
// Two kinds of build exist and they are not the same thing:
//
//   - `out/clavis-linux-x64/clavis` — what `electron-forge package` produces. The app is
//     fully packaged (asar, native modules unpacked) but no maker has run: no squashfs, no
//     deb, no dmg. Takes ~9s, which is what makes a per-push gate affordable.
//   - `out/make/AppImage/x64/*.AppImage` — what `npm run make` produces, on top of the
//     above. This is the file users download, so it is the one worth validating before a
//     release is cut.
//
// It existed inline in one spec and was duplicated (hardcoded, version-pinned) in a second,
// which is how a version bump broke that one. Locating by glob and reading the version from
// package.json is the fix; duplicating the logic is the problem, so it lives here once.
//
// The AppImage wins when both are present: it is the more finished artifact and the thing
// users download. The cost of that preference is a stale local AppImage beating a fresh
// `package` — which is why the resolved path is printed on every launch ([e2e] <kind>: …)
// and why the version assertion in each spec compares against package.json rather than
// against whatever the app happens to say.
import path from 'path';
import fs from 'fs';

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
) as { version: string };

export const APPIMAGE_DIR = path.resolve(__dirname, '../../out/make/AppImage/x64');
export const PACKAGED_DIR = path.resolve(__dirname, '../../out/clavis-linux-x64');

export function findAppImage(): string | null {
  // @reforged/maker-appimage writes to out/make/AppImage/<targetArch>.
  const names = fs.existsSync(APPIMAGE_DIR)
    ? fs.readdirSync(APPIMAGE_DIR).filter((name) => name.endsWith('.AppImage'))
    : [];

  // Newest build wins when several are present.
  return (
    names
      .map((name) => path.join(APPIMAGE_DIR, name))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null
  );
}

/** The packager output, which is the app with no maker run on top of it. */
export function findPackagedApp(): string | null {
  const out = path.resolve(__dirname, '../../out');
  for (const platform of ['clavis-linux-x64', 'clavis-win32-x64', 'clavis-darwin-x64']) {
    for (const binary of ['clavis', 'clavis.exe']) {
      const full = path.join(out, platform, binary);
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

export interface Target {
  /** The executable to hand Electron. */
  executablePath: string;
  /**
   * Whether the target has to be passed as the first argument as well as the executable.
   *
   * An AppImage is a self-extracting archive with its own argument handling: Electron is
   * inside it, so the AppImage path must appear in argv. The packager output is already a
   * plain Electron binary and passing its own path as argv[1] makes Electron try to load a
   * directory as an application. Measured — both were tried before writing this.
   */
  passAsArgument: boolean;
  kind: 'AppImage' | 'packaged';
}

export function resolveTarget(): Target {
  // An explicit override, so a CI job can say which artifact it means instead of relying on
  // whatever happens to be on disk.
  const override = process.env.CLAVIS_E2E_TARGET;
  if (override) {
    const resolved = path.resolve(override);
    if (!fs.existsSync(resolved)) {
      throw new Error(`CLAVIS_E2E_TARGET points at ${resolved}, which does not exist.`);
    }
    return {
      executablePath: resolved,
      passAsArgument: resolved.endsWith('.AppImage'),
      kind: resolved.endsWith('.AppImage') ? 'AppImage' : 'packaged',
    };
  }

  const appImage = findAppImage();
  if (appImage) return { executablePath: appImage, passAsArgument: true, kind: 'AppImage' };

  const packaged = findPackagedApp();
  if (packaged) return { executablePath: packaged, passAsArgument: false, kind: 'packaged' };

  throw new Error(
    'No built application found. Run `npm run package` for a ~9s packager build, or ' +
      `\`npm run make\` for a full one. Looked in ${PACKAGED_DIR} and ${APPIMAGE_DIR}.`
  );
}

export const APP_VERSION: string = pkg.version;