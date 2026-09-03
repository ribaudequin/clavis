# Clavis — CI/CD: Builds & Releases via GitHub Actions

> Reference doc for the CI/CD setup **implemented on 2026-09-03**. Describes the single Electron Forge build system consolidated from the previous dual (Forge + electron-builder) setup, and the GitHub Actions workflow that builds all targets remotely on native runners.

## Context

The repo [ribaudequin/clavis](https://github.com/ribaudequin/clavis) is an Electron + TypeScript / React app packaged with **Electron Forge**. GitHub Actions builds the binaries on native runners for **Linux, Windows and macOS** and publishes them to a **GitHub Release** automatically when a tag `v*` is pushed. Free on a public repo (unlimited minutes, macOS runners included).

## Target matrix (final)

| Platform | Format | Maker |
|---|---|---|
| Linux | `.deb` | `@electron-forge/maker-deb` |
| Linux | `.rpm` | `@electron-forge/maker-rpm` |
| Linux | `.AppImage` | `@reforged/maker-appimage` |
| Windows | Portable `.zip` | `@electron-forge/maker-zip` |
| Windows | Installer `.exe` (Squirrel) | `@electron-forge/maker-squirrel` |
| macOS | `.dmg` | `@electron-forge/maker-dmg` |

> **Note on the Windows installer:** Electron Forge has **no NSIS maker**. The former NSIS installer was produced by electron-builder (removed in the consolidation). The Forge-native Windows installer is **Squirrel** (`maker-squirrel`), which is what the workflow now produces.

## Build system — single Electron Forge

The dual build system (electron-builder for AppImage/Portable/NSIS + Forge for deb) was **consolidated to a single Electron Forge setup**. `electron-builder`, the `build` block in `package.json`, and its scripts (`make:appimage`, `make:windows`) were removed.

### `forge.config.ts`

Uses `process.platform` to pick the packager icon per OS and declares one maker per platform:

- Linux: `MakerDeb` + `MakerRpm` + `MakerAppImage` (@reforged)
- Windows: `MakerSquirrel` + `MakerZIP`
- macOS: `MakerDMG`

`packagerConfig.asar = { unpack: '**/node_modules/argon2/**/*' }` keeps the native `argon2` binary unpacked from the ASAR (required for it to load at runtime).

### `package.json`

- `npm run build` — TypeScript main + copy preload + Vite renderer
- `npm run make` — `electron-forge make` (all makers for current platform)
- `npm run release` — `clean && build && make`
- `make:appimage`, `make:windows`, electron-builder removed

## Workflow — `.github/workflows/release.yml`

Triggers on tag `v*`. Two jobs:

1. **build** — matrix over `ubuntu-latest`, `windows-latest`, `macos-latest`:
   - checkout, setup Node 20 (cached), `npm ci`
   - **Linux only:** `apt-get install rpm rpm2cpio` (needed by `maker-rpm`; `mksquashfs` is preinstalled on ubuntu-latest)
   - `npm run build` → `npm run make` (optionally passing cert secrets for Windows signing)
   - uploads artifacts (`out/make/**/*.{deb,rpm,AppImage,dmg,exe,zip}`)
2. **release** — on `ubuntu-latest`, downloads all artifacts (merged) and publishes a GitHub Release via `softprops/action-gh-release@v2` with auto-generated notes.

## Release

```bash
git tag v0.1.3-alpha
git push origin v0.1.3-alpha
```

Watch progress at `https://github.com/ribaudequin/clavis/actions`. The Release appears at `https://github.com/ribaudequin/clavis/releases` with 6 files (3 Linux + 2 Windows + 1 macOS).

## Notes

- **Cost:** zero (public repo).
- **Windows cert** (`WINDOWS_CERT_FILE`/`WINDOWS_CERT_PASSWORD`): optional. Without them the build works; the `.exe` shows "unknown publisher" in SmartScreen. Add as Repository Secrets if a cert is ever obtained.
- **macOS signing:** no Apple Developer account (99 USD/yr) → `.dmg` works but shows "unidentified developer" on first open. Normal for unsigned open-source apps.
- **Windows argon2:** the old `scripts/afterPack.js` ELF-stripping hack is **no longer needed** because Win32 builds now run on the native `windows-latest` runner (argon2 is compiled as PE32+ natively), not cross-compiled via Linux/Wine. It is kept in `scripts/backup/` for reference.
- **AppImage:** the runner `ubuntu-latest` has `mksquashfs` preinstalled.
- **Workflow trigger:** only on tags `v*`; normal pushes to `main` do not trigger builds.

## Old local build scripts

`build-all-platforms.sh`, `build-all-targets.sh`, `build-releases.sh` and `afterPack.js` (electron-builder based) were moved to `scripts/backup/`. Local Linux builds are now just `npm run build && npm run make` (deb + rpm + AppImage); Windows/macOS builds happen in CI.
