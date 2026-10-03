# Clavis — CI/CD: Builds & Releases via GitHub Actions

> Reference doc for the CI/CD setup **implemented on 2026-09-03**. Describes the single Electron Forge build system consolidated from the previous dual (Forge + electron-builder) setup, and the GitHub Actions workflow that builds all targets remotely on native runners.
>
> **Updated 2026-10-02:** Forge downgraded to **6.4.2** (supply-chain, 30 CVEs), config moved from `forge.config.mts` to `package.json` → `config.forge`, `.rpm` target dropped, and a `quality` job (lint + typecheck + typecheck:test + test) now gates the build.

## Context

The repo [ribaudequin/clavis](https://github.com/ribaudequin/clavis) is an Electron + TypeScript / React app packaged with **Electron Forge**. GitHub Actions builds the binaries on native runners for **Linux, Windows and macOS** and publishes them to a **GitHub Release** automatically when a tag `v*` is pushed. Free on a public repo (unlimited minutes, macOS runners included).

## Target matrix (final)

| Platform | Format | Maker |
|---|---|---|
| Linux | `.deb` | `@electron-forge/maker-deb` |
| Linux | `.AppImage` | `@reforged/maker-appimage` |
| Windows | Portable `.zip` | `@electron-forge/maker-zip` |
| Windows | Installer `.exe` (Squirrel) | `@electron-forge/maker-squirrel` |
| macOS | `.dmg` | `@electron-forge/maker-dmg` |

> **Note on the Windows installer:** Electron Forge has **no NSIS maker**. The former NSIS installer was produced by electron-builder (removed in the consolidation). The Forge-native Windows installer is **Squirrel** (`maker-squirrel`), which is what the workflow now produces.

## Build system — single Electron Forge

The dual build system (electron-builder for AppImage/Portable/NSIS + Forge for deb) was **consolidated to a single Electron Forge setup**. `electron-builder`, the `build` block in `package.json`, and its scripts (`make:appimage`, `make:windows`) were removed.

### `package.json` → `config.forge`

One maker per platform, with `platforms` gating each to its OS:

- Linux: `maker-deb` + `maker-appimage` (@reforged)
- Windows: `maker-squirrel` + `maker-zip`
- macOS: `maker-dmg`

> **There is no `forge.config.mts` any more.** Electron Forge 6.4.2 resolves config through `interpret`, whose extension map does not include `.mts`, so the file was **silently ignored** (symptom: `Could not find any make targets`). Since 2026-09-26 the single source of truth is `package.json` → `config.forge`.

`packagerConfig.asar = { unpack: '**/node_modules/argon2/**/*' }` keeps the native `argon2` binary unpacked from the ASAR (required for it to load at runtime).

### npm scripts

- `npm run build` — TypeScript main + copy preload + Vite renderer
- `npm run make` — `electron-forge make` (all makers for current platform)
- `npm run release` — `clean && build && make`
- `npm run typecheck` / `npm run typecheck:test` / `npm run lint` / `npm test` — quality gates
- `make:appimage`, `make:windows`, electron-builder removed

## Workflow — `.github/workflows/release.yml`

Three jobs:

1. **quality** (`ubuntu-latest`, every push and PR): `npm ci` → `npm run lint` → `npm run typecheck` → `npm run typecheck:test` → `npm test`.
2. **build** (`needs: quality`, gated to `v*` tags) — matrix over `ubuntu-latest`, `windows-latest`, `macos-latest`:
   - checkout, setup Node 22 (cached), `npm ci` (Windows uses `--ignore-scripts` to keep the argon2 prebuilds)
   - **Windows only:** copy `electron-winstaller/vendor/7z-x64.exe` → `7z.exe` (forge#3892)
   - **Linux only:** `apt-get install dpkg-dev fakeroot build-essential g++ make python3 python3-dev squashfs-tools`
   - `npm run build` → `npm run make` (optionally passing cert secrets for Windows signing)
   - uploads artefacts as `clavis-<os>-<ref>` (`out/make/**/*.{deb,AppImage,dmg,exe,zip,nupkg}`)
3. **release** — on `v*` tags, `ubuntu-latest`: downloads all artefacts (merged) and publishes a GitHub Release via `softprops/action-gh-release@v2` with auto-generated notes.

## Release

```bash
git tag v0.1.3-alpha
git push origin v0.1.3-alpha
```

Watch progress at `https://github.com/ribaudequin/clavis/actions`. The Release appears at `https://github.com/ribaudequin/clavis/releases` with 6 assets (2 Linux + 3 Windows + 1 macOS).

## Notes

- **Cost:** zero (public repo).
- **Windows cert** (`WINDOWS_CERT_FILE`/`WINDOWS_CERT_PASSWORD`): optional. Without them the build works; the `.exe` shows "unknown publisher" in SmartScreen. Add as Repository Secrets if a cert is ever obtained.
- **macOS signing:** no Apple Developer account (99 USD/yr) → `.dmg` works but shows "unidentified developer" on first open. Normal for unsigned open-source apps.
- **Windows argon2:** the old `scripts/afterPack.js` ELF-stripping hack is **no longer needed** because Win32 builds now run on the native `windows-latest` runner (argon2 is compiled as PE32+ natively), not cross-compiled via Linux/Wine. It is kept in `scripts/backup/` for reference.
- **AppImage:** `squashfs-tools` is installed explicitly on the Linux runner.
- **Forge version:** pinned to **6.4.2** across all `@electron-forge/*` packages (7.11.2 pulled 30 CVEs via `tar`, `extract-zip`, `image-size`, `tmp`). Forge 6.4.2 has **no NSIS maker** and cannot read `.mts` config files.
- **Workflow trigger:** `quality` runs on every push and PR; `build` and `release` only on tags `v*`.

## Old local build scripts

`build-all-platforms.sh`, `build-all-targets.sh`, `build-releases.sh` and `afterPack.js` (electron-builder based) were moved to `scripts/backup/`. Local Linux builds are now just `npm run build && npm run make` (deb + AppImage), or `node scripts/build-appimage-local.mjs` for the `clean` → `build` → `make --platform=linux` sequence; Windows/macOS builds happen in CI.
