# Clavis Build Manual

Cross-platform build guide for Clavis encrypted notes app.

## Overview

Clavis is packaged with **Electron Forge 6.4.2** (single build system). Release binaries are built **remotely on GitHub Actions** native runners (Linux / Windows / macOS) and published automatically on tag push. Local Linux builds are also supported.

**Targets:** `.deb` + `.AppImage` (Linux) · Squirrel `.exe` + Portable `.zip` (Windows) · `.dmg` (macOS).

> **No `.rpm` target.** It was dropped — `rpmbuild` fails when stripping the argon2 prebuilds. See `/MEMORY/HISTORY.md` (2026-09-26).

Artefacts land in `out/make/<maker>/x64/` (Forge default `directories.output`, gitignored).

## Prerequisites

- Node.js 20+ (LTS recommended) — CI uses Node 22
- npm 10+
- Linux local builds: `dpkg-dev` + `fakeroot` for `.deb`, `squashfs-tools` for AppImage
- CI does the Windows/macOS builds (native runners) — no Wine needed
- GitHub CLI (`gh`) for manual releases

## Quick Start

```bash
# Install dependencies
npm ci

# Local Linux build (deb + AppImage, via Forge)
npm run build
npm run make

# Or the single command
npm run release
```

`npm run make` runs only the makers for the **current platform**, so on Linux you get `.deb` + `.AppImage` and nothing else.

For Windows/macOS artefacts, push a tag to trigger the GitHub Actions workflow (`release.yml`).

## Scripts

### `npm run build`
Compiles TypeScript + bundles renderer via Vite:
- `dist/main/` — main process (CommonJS)
- `dist/renderer/` — React app (Vite ESM)

### `npm run make`
`electron-forge make` — packages + makes all targets for the **current platform**:
- Linux: `.deb` + `.AppImage`
- Windows: Squirrel `.exe` + Portable `.zip` (`.nupkg` is an intermediate, also uploaded)
- macOS: `.dmg`

Restrict to one platform with `npm run make -- --platform=linux`.

> There is **no `postMake` hook**. A `postMake` (camelCase) script never fires — npm only looks for `pre<name>` / `post<name>` in lower case (`postmake`). It and `scripts/generate-latest-yml.mjs` were removed on 2026-10-03: they produced `latest.yml` metadata for `electron-updater`, which BS-06 replaced with a manual GitHub Releases check in the main process. Neither is referenced by the code or CI.

### `npm run release`
`clean && build && make` (all-in-one for the current platform).

### Quality gates (also run in CI)

| Command | Checks |
|---------|--------|
| `npm run lint` | ESLint (`no-explicit-any` must stay at 0) |
| `npm run typecheck` | `tsc --noEmit` — main + shared process sources |
| `npm run typecheck:test` | `tsc -p tsconfig.test.json` — test suite (excluded from `typecheck`) |
| `npm test` | Vitest |

`src/renderer` and the `*.tsx` component tests are **not** typechecked yet (known gap, tracked as P2.24 in `TODO.md`).

## Key Config Files

| File | Purpose |
|------|---------|
| `package.json` → `config.forge` | electron-forge config — single source of truth for makers, packager icon, `asar.unpack` for argon2 |
| `.github/workflows/release.yml` | CI: `quality` gates job + build matrix (ubuntu/windows/macos) + release job |
| `vite.config.mts` | Renderer bundling (React + Tailwind + SVGR, manual chunks) |
| `tsconfig.json` | TypeScript config — `module: CommonJS` (main process); `src/renderer` excluded |
| `tsconfig.test.json` | TypeScript config for the test suite (`src/main` + `src/shared` + `tests/**/*.ts`) |
| `scripts/build-appimage-local.mjs` | Local helper: `clean` → `build` → `make --platform=linux` |

> **`forge.config.mts` no longer exists.** Electron Forge 6.4.2 resolves config via `interpret`, whose extension map does **not** include `.mts`, so the file was silently ignored (no `makers` → `Could not find any make targets`). Config moved to `package.json` → `config.forge` in 2026-09-26. Do not re-introduce `forge.config.mts`.

## CI/CD Workflow

`.github/workflows/release.yml`:
- **quality** job (`ubuntu-latest`, every push/PR): `npm ci` → `lint` → `typecheck` → `typecheck:test` → `test`.
- **build** job (matrix `ubuntu-latest` / `windows-latest` / `macos-latest`, `needs: quality`, gated to `v*` tags): `npm ci` (Windows uses `--ignore-scripts` to keep argon2 prebuilds) → Squirrel `7z.exe` fix → Linux packaging tools → `npm run build` → `npm run make`. Uploads artefacts as `clavis-<os>-<ref>`.
- **release** job (`v*` tags only): downloads all artefacts and publishes the GitHub Release with auto-generated notes.

```bash
git tag v0.1.3-alpha
git push origin v0.1.3-alpha
```

## Version Bump

```bash
# Update version in package.json (takes version from package.json)
npm version 0.1.3-alpha --no-git-tag-version
```

## Releases

CI (recommended): push a `v*` tag → workflow builds all 3 platforms and creates the Release with 6 assets (`.deb`, `.AppImage`, `.exe`, `.nupkg`, `.zip`, `.dmg`).

Manual fallback (Linux only): after `npm run make`, the artefacts are in `out/make/deb/x64/` and `out/make/AppImage/x64/`.

## Troubleshooting

### Missing maker targets ("Could not find any make targets")
Forge 6.4.2 ignores `forge.config.mts`. The single source of truth is `package.json` → `config.forge.makers` (array of `{ name, platforms, config }`). Verify with `node -e "console.log(require('./package.json').config.forge.makers)"`.

### AppImage "Cannot find module electron-log"
Ensure `electron-log` is in `dependencies` (not `devDependencies`) in package.json.

### ASAR integrity / missing native modules
`argon2` is unpacked from the ASAR via `config.forge.packagerConfig.asar.unpack`. Note that the prebuilt binaries live in `prebuilds/<platform>/`, **not** `build/Release/`. Verify on an unpacked AppImage:
```bash
cd /tmp && /path/to/clavis-x64.AppImage --appimage-extract
ls squashfs-root/usr/lib/clavis/resources/app.asar.unpacked/node_modules/argon2/prebuilds/linux-x64/
npx asar list squashfs-root/usr/lib/clavis/resources/app.asar | grep '@phc/format'   # argon2 dep, must be inside the ASAR
```
Then confirm the native module actually works (returns a 32-byte raw hash):
```bash
node -e "const a=require('./squashfs-root/usr/lib/clavis/resources/app.asar.unpacked/node_modules/argon2/argon2.cjs'); a.hash(Buffer.from('x'),{type:a.argon2id,timeCost:3,memoryCost:65536,parallelism:4,salt:require('crypto').randomBytes(16),raw:true}).then(h=>console.log(h.length))"
```

### Headless smoke test of a built AppImage
```bash
HOME=/tmp/clavis-test XDG_CONFIG_HOME=/tmp/clavis-test/config XDG_DATA_HOME=/tmp/clavis-test/data \
  timeout 25 ./out/make/AppImage/x64/clavis-<version>-x64.AppImage --no-sandbox
```
Expect `Clavis started` followed by `Drawers listed {count:N}` — the second line proves the renderer loaded and completed an IPC round-trip. `exit=124` just means `timeout` stopped it.

### Windows `argon2` invalid Win32 application (legacy)
Previously cross-built via Linux/Wine, fixed by `scripts/afterPack.js` (now in `scripts/backup/`). **No longer needed** — Windows builds run on the native `windows-latest` runner, so `argon2` is compiled as PE32+ natively.

## Artifacts Checklist

Before release, verify all 6 published assets:
- [ ] `.deb` — installs on Ubuntu/Debian, launches, creates drawer
- [ ] `.AppImage` — runs on Arch/Fedora/Ubuntu (FUSE), launches, creates drawer
- [ ] `Portable.zip` — runs on Windows 10/11 without install, creates drawer
- [ ] `Setup.exe` (Squirrel) — installs on Windows, creates Start Menu entry, creates drawer
- [ ] `.nupkg` — Squirrel intermediate published alongside the installer
- [ ] `.dmg` — mounts + launches on macOS, creates drawer

## Security Notes

- Binaries are **unsigned** (code signing skipped)
- `argon2id` + `AES-256-GCM` encryption
- Token-based import (5-min expiry, single-use)
- CSP + sandbox enabled in renderer
