// One locator for the packaged artifact, shared by the AppImage gate and the flow test.
//
// It existed inline in appimage-validation.spec.ts and was duplicated (hardcoded, version-
// pinned) in a second spec, which is how a version bump broke that one. Locating by glob
// and reading the version from package.json is the fix; duplicating the logic is the
// problem, so it lives here once.
import path from 'path';
import fs from 'fs';

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
) as { version: string };

export const APPIMAGE_DIR = path.resolve(__dirname, '../../out/make/AppImage/x64');

export function findAppImage(): string {
  // @reforged/maker-appimage writes to out/make/AppImage/<targetArch>.
  const names = fs.existsSync(APPIMAGE_DIR)
    ? fs.readdirSync(APPIMAGE_DIR).filter((name) => name.endsWith('.AppImage'))
    : [];

  // Newest build wins when several are present.
  const found = names
    .map((name) => path.join(APPIMAGE_DIR, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

  if (!found) {
    throw new Error(
      `No .AppImage found in ${APPIMAGE_DIR}. Run \`npm run make\` to build one before this test.`
    );
  }
  return found;
}

export const APP_VERSION: string = pkg.version;
