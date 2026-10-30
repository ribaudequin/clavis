# Clavis — CI/CD: Builds & Releases via GitHub Actions

> Reference doc for the CI/CD setup **implemented on 2026-09-03**. Describes the single Electron Forge build system consolidated from the previous dual (Forge + electron-builder) setup, and the GitHub Actions workflow that builds all targets remotely on native runners.
>
> **Updated 2026-10-02:** Forge downgraded to **6.4.2** (supply-chain, 30 CVEs), config moved from `forge.config.mts` to `package.json` → `config.forge`, `.rpm` target dropped, and a `quality` job (lint + typecheck + typecheck:test + test) now gates the build.
>
> **Updated 2026-10-19:** actions bumped to their Node 24 majors (`checkout@v5`, `setup-node@v5`, `upload-artifact@v6`, `download-artifact@v7`, `action-gh-release@v3`) and CI `node-version` moved from 22 to 24; the `e2e` job is documented below.

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

Five jobs (actions run on the Node 24 runtime; CI uses `node-version: 24`). A tag run is therefore **9 job instances**: `quality`, `e2e` ×2 locales, `e2e-cross` ×2 platforms, `build` ×3 platforms, `release`.

1. **quality** (`ubuntu-latest`, every push and PR): `npm ci` → `npm run lint` → `npm run typecheck` → `npm run typecheck:test` → `npm test`.
2. **e2e** (`needs: quality`, `ubuntu-latest`, every push and PR) — `language: [en, pt]` matrix: `npm ci` → `npm run build` → `npm run package` → `xvfb-run -a npm run test:e2e` against `out/clavis-linux-x64/clavis`. Both locales are run because every selector in the suite is a two-locale pattern; Chromium reads `LANGUAGE`, not `LANG`.
3. **e2e-cross** (`needs: quality`, matrix `windows-latest` / `macos-latest`, tag or `workflow_dispatch`): the same suite against the packaged build on each platform. It is **informational** — nothing `needs:` it, so an unavailable runner cannot block a release. `workflow_dispatch` is the manual channel: a tag cannot be iterated on, and a dispatch publishes nothing because `release` requires a push event.
4. **build** (`needs: [quality, e2e]`, gated to `v*` tags) — matrix over `ubuntu-latest`, `windows-latest`, `macos-latest`:
   - checkout, setup Node 24 (cached), `npm ci` (Windows uses `--ignore-scripts` to keep the argon2 prebuilds)
   - **Windows only:** copy `electron-winstaller/vendor/7z-x64.exe` → `7z.exe` (forge#3892)
   - **Linux only:** `apt-get install dpkg-dev fakeroot build-essential g++ make python3 python3-dev squashfs-tools`
   - `npm run build` → `npm run make` (optionally passing cert secrets for Windows signing)
   - uploads artefacts as `clavis-<os>-<ref>` (`out/make/**/*.{deb,AppImage,dmg,exe,zip,nupkg}`)
   - **Linux only:** runs the e2e suite against the packaged AppImage before upload
   - **macOS only:** renames the maker's `clavis.dmg` to `clavis-<version>.dmg`, because the release job requires the version in every artifact name
5. **release** (`needs: build`, `ubuntu-latest`, push event on a `v*` tag): downloads all artefacts (merged), verifies each name against the tag's version and prints its SHA-256, then publishes a GitHub Release via `softprops/action-gh-release@v3` with auto-generated notes.

## Release

The version bump is still **manual**, but it is guarded: `scripts/check-tag-version.sh` runs in `quality` and fails when the tag name and `package.json` disagree. That guard exists because `v0.6.13-beta` was tagged while `package.json` still read `0.6.12-beta`, so six assets were published under the older name and every 0.6.12 user was offered a byte-identical "update".

```bash
npm version <version> --no-git-tag-version      # package.json + package-lock.json, together
GITHUB_REF_NAME=v<version> npm run check:tag    # exits 1 on a mismatch
git commit -am "v<version> — <summary>"
git push origin main                            # quality + both e2e locales run first
git tag v<version>
git push origin v<version>                      # build ×3 + release
```

`main` is pushed **before** the tag on purpose: the gate then runs against the commit that will be released, not after the fact. Watch progress at `https://github.com/ribaudequin/clavis/actions`. The Release appears at `https://github.com/ribaudequin/clavis/releases` with 6 assets (2 Linux + 3 Windows + 1 macOS).

Before tagging, confirm locally that the packaged app carries the version the tag will claim — `npx @electron/asar extract-file out/clavis-linux-x64/resources/app.asar package.json` from a scratch directory (`extract-file` writes into the **cwd**). That check covers the version only: Forge deletes `config.forge` from the copy it puts in the asar, so `config: {}` is correct there and the makers/plugins/icon have to be read from the source `package.json`.

## Notes

- **Cost:** zero (public repo).
- **Windows cert** (`WINDOWS_CERT_FILE`/`WINDOWS_CERT_PASSWORD`): optional. Without them the build works; the `.exe` shows "unknown publisher" in SmartScreen. Add as Repository Secrets if a cert is ever obtained.
- **macOS signing:** no Apple Developer account (99 USD/yr) → `.dmg` works but shows "unidentified developer" on first open. Normal for unsigned open-source apps.
- **Windows argon2:** the old `scripts/afterPack.js` ELF-stripping hack is **no longer needed** because Win32 builds now run on the native `windows-latest` runner (argon2 is compiled as PE32+ natively), not cross-compiled via Linux/Wine. It is kept in `scripts/backup/` for reference.
- **AppImage:** `squashfs-tools` is installed explicitly on the Linux runner.
- **Forge version:** pinned to **6.4.2** across all `@electron-forge/*` packages (7.11.2 pulled 30 CVEs via `tar`, `extract-zip`, `image-size`, `tmp`). Forge 6.4.2 has **no NSIS maker** and cannot read `.mts` config files.
- **Workflow trigger:** `quality` and `e2e` run on every push and PR; `e2e-cross` runs on tags (and on `workflow_dispatch`, where it publishes nothing); `build` on tags; `release` only on a **push** of a `v*` tag.

## Old local build scripts

`build-all-platforms.sh`, `build-all-targets.sh`, `build-releases.sh` and `afterPack.js` (electron-builder based) were moved to `scripts/backup/`. Local Linux builds are now just `npm run build && npm run make` (deb + AppImage), or `node scripts/build-appimage-local.mjs` for the `clean` → `build` → `make --platform=linux` sequence; Windows/macOS builds happen in CI.
