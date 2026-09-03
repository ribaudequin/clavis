# Clavis Build Manual

Cross-platform build guide for Clavis encrypted notes app.

## Overview

Clavis is packaged with **Electron Forge** (single build system). Release binaries are built **remotely on GitHub Actions** native runners (Linux / Windows / macOS) and published automatically on tag push. Local Linux builds are also supported.

**Targets:** `.deb`, `.rpm`, `.AppImage` (Linux) · Portable `.zip`, Squirrel installer `.exe` (Windows) · `.dmg` (macOS).

## Prerequisites

- Node.js 20+ (LTS recommended)
- npm 10+
- Linux local builds: `dpkg` + `fakeroot` for `.deb`, `mksquashfs` for AppImage, `rpmbuild` (`rpm`) for `.rpm`
- CI does the Windows/macOS builds (native runners) — no Wine needed
- GitHub CLI (`gh`) for manual releases

## Quick Start

```bash
# Install dependencies
npm ci

# Local Linux build (deb + rpm + AppImage, via Forge)
npm run build
npm run make

# Or the single release command
npm run release
```

For Windows/macOS artefacts, push a tag to trigger the GitHub Actions workflow (`release.yml`).

## Scripts

### `npm run build`
Compiles TypeScript + bundles renderer via Vite:
- `dist/main/` — main process (CommonJS)
- `dist/renderer/` — React app (Vite ESM)

### `npm run make`
`electron-forge make` — packages + makes all targets for the **current platform**:
- Linux: `.deb` + `.rpm` + `.AppImage`
- Windows: Squirrel `.exe` + Portable `.zip`
- macOS: `.dmg`

### `npm run release`
`clean && build && make` (all-in-one for the current platform).

## Key Config Files

| File | Purpose |
|------|---------|
| `forge.config.ts` | electron-forge config — all makers, per-platform icon, `asar.unpack` for argon2 |
| `.github/workflows/release.yml` | CI: build matrix (ubuntu/windows/macos) + release job |
| `vite.config.ts` | Renderer bundling (React + Tailwind + SVGR) |
| `tsconfig.json` | TypeScript config (main: CommonJS, renderer: ESM) |

## CI/CD Workflow

`.github/workflows/release.yml`:
- Triggers on tags `v*`.
- **build** job (matrix `ubuntu-latest` / `windows-latest` / `macos-latest`): `npm ci` → `npm run build` → `npm run make`. Ubuntu installs `rpm` first. Uploads artifacts.
- **release** job: merges artifacts and publishes a GitHub Release with auto-generated notes.

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

CI (recommended): push a `v*` tag → workflow builds all 6 targets and creates the Release.

Manual fallback (Linux only): after `npm run make`, the artefacts are in `out/make/`.

## Troubleshooting

### `.rpm` fails with "rpmbuild not found"
The `@electron-forge/maker-rpm` requires `rpmbuild` (package `rpm`). In CI the workflow installs it on the ubuntu runner. Local: `sudo apt-get install rpm`.

### AppImage "Cannot find module electron-log"
Ensure `electron-log` is in `dependencies` (not `devDependencies`) in package.json.

### ASAR integrity / missing native modules
`argon2` is unpacked from the ASAR via `packagerConfig.asar.unpack`. Verify:
```bash
npx asar list out/<platform>/resources/app.asar >/dev/null
ls out/<platform>/resources/app.asar.unpacked/node_modules/argon2/build/Release/
```

### Windows `argon2` invalid Win32 application (legacy)
Previously cross-built via Linux/Wine, fixed by `scripts/afterPack.js` (now in `scripts/backup/`). **No longer needed** — Windows builds run on the native `windows-latest` runner, so `argon2` is compiled as PE32+ natively.

## Artifacts Checklist

Before release, verify all 6:
- [ ] `.deb` — installs on Ubuntu/Debian, launches, creates drawer
- [ ] `.rpm` — installs on Fedora/RHEL/openSUSE, launches, creates drawer
- [ ] `.AppImage` — runs on Arch/Fedora/Ubuntu (FUSE), creates drawer
- [ ] `Portable.zip` — runs on Windows 10/11 without install, creates drawer
- [ ] `Setup.exe` — installs on Windows, creates Start Menu entry, creates drawer
- [ ] `.dmg` — mounts + launches on macOS, creates drawer

## Security Notes

- Binaries are **unsigned** (code signing skipped)
- `argon2id` + `AES-256-GCM` encryption
- Token-based import (5-min expiry, single-use)
- CSP + sandbox enabled in renderer
