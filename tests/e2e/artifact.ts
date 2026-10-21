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
//
// The packager output, on the other hand, is platform-shaped: a flat binary on Linux and
// Windows, a `.app` bundle on macOS, and the platform directory carries the
// architecture. The candidate is therefore derived from the host this process runs on
// (process.platform / process.arch) instead of from a hardcoded list. That list had no
// `darwin-arm64` entry at all and probed for a flat file at the root of the directory,
// so on the Apple Silicon macOS runner the locator found nothing and every test failed
// at launch — and, worse, a stray `out/clavis-linux-x64` left on a macOS machine would
// have been picked up and measured as if it were the native build.
import path from 'path';
import fs from 'fs';
import filenamify from 'filenamify';

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as {
  name: string;
  productName?: string;
  version: string;
};

// The name electron-packager puts in front of the platform and the architecture —
// `<name>-<platform>-<arch>` (electron-packager/src/common.js:14-16) — and every other
// path it derives comes from the same name: the Windows executable is
// `sanitizeAppName(name).exe` (src/win32.js:27), the Linux one `sanitizeAppName(name)`
// (src/linux.js:12) and the macOS bundle `sanitizeAppName(name).app` with the same
// name inside `Contents/MacOS` (src/mac.js:53, :111).
//
// The name is the one electron-packager *infers*, and it infers it from `productName`,
// not from `name` (src/infer.js:87-89: `opts.name = result.values.productName`, with
// get-package-info resolving `productName` and falling back to `name` itself).
// `productName` is the display name — the likelier of the two to be renamed — so this
// reads it, with `name` as the fallback, exactly as the packager does.
//
// And the packager sanitises the name before it builds a path from it —
// `filenamify(name, { replacement: '-' })` (src/common.js:10-12) — so the same
// sanitisation is applied here (filenamify is electron-packager's own dependency,
// declared here so the import is not a phantom one). That is what keeps the locator
// pointing at the packager's output after a rename, instead of at a directory that
// does not exist.
const APP_NAME = filenamify(pkg.productName ?? pkg.name, { replacement: '-' });

export const APPIMAGE_DIR = path.resolve(__dirname, '../../out/make/AppImage/x64');

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

/**
 * The path of the packaged executable for a platform and an architecture, relative to
 * `out/`.
 *
 * Pure on purpose — it is what makes the locator testable without a build on disk:
 *
 *   linux   out/clavis-linux-x64/clavis
 *   win32   out/clavis-win32-x64/clavis.exe
 *   darwin  out/clavis-darwin-<arch>/clavis.app/Contents/MacOS/clavis
 *
 * The macOS layout is a bundle, so the executable is not at the root of the platform
 * directory but inside `Contents/MacOS` of the `.app`, and the platform directory
 * carries the architecture (`macos-latest` is Apple Silicon, hence `darwin-arm64`).
 * Assembled with `path.join`: a hand-written '/' is a separator on macOS and Linux and
 * a literal character on Windows.
 */
export function packagedExecutableRelativePath(platform: NodeJS.Platform, arch: string): string {
  const dir = `${APP_NAME}-${platform}-${arch}`;
  if (platform === 'darwin') {
    return path.join(dir, `${APP_NAME}.app`, 'Contents', 'MacOS', APP_NAME);
  }
  return path.join(dir, platform === 'win32' ? `${APP_NAME}.exe` : APP_NAME);
}

/** The executable this host would launch, named in full for the error message below. */
export const PACKAGED_EXECUTABLE = path.resolve(
  __dirname,
  '../../out',
  packagedExecutableRelativePath(process.platform, process.arch)
);

/**
 * The packager output, which is the app with no maker run on top of it.
 *
 * One candidate, derived from the host: the search is scoped to the platform this
 * process runs on, so a build for another platform sitting in `out/` is never picked
 * up and measured as if it were the native one.
 */
export function findPackagedApp(): string | null {
  const out = path.resolve(__dirname, '../../out');
  const candidate = path.join(out, packagedExecutableRelativePath(process.platform, process.arch));
  return fs.existsSync(candidate) ? candidate : null;
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
      `\`npm run make\` for a full one. Looked for ${PACKAGED_EXECUTABLE} and in ` +
      `${APPIMAGE_DIR}.`
  );
}

export const APP_VERSION: string = pkg.version;