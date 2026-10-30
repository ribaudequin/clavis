<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/ribaudequin/ribaudequin/main/assets/bandua-light.svg">
    <img src="https://raw.githubusercontent.com/ribaudequin/ribaudequin/main/assets/bandua-dark.svg" alt="Bandua Studio" width="64">
  </picture>
</p>

<h1 align="center">clavis</h1>

<p align="center">Encrypted notes for passwords, PINs, bank details and safe codes.</p>

<p align="center"><sub>A <b>Bandua Studio</b> project · by Marcelo Salvador</sub></p>

---

**Clavis** is a cross-platform encrypted notes application for storing sensitive data such as banking information, PINs, website passwords, safe codes, and door codes.

Everything stays on your machine. Drawers are encrypted with AES-256-GCM, each one has its own password, and there is no account, no sync, and no analytics.

## Features

- **Encrypted Drawers**: Store data in encrypted "drawers" (passwords, PINs, bank details, etc.)
- **Per-Drawer Passwords**: Every drawer has its own password. There is no global master password.
- **Export & Import**: Back up any drawer as an encrypted `.clavis` file and import it back later
- **Deterministic Icons**: Each drawer gets a 3×3 colour grid generated from a hash of its own ID — the same drawer always looks the same
- **Unsaved-Changes Guard**: Leaving an edited drawer asks whether to save, discard, or cancel
- **In-App Update Check**: The Credits screen tells you when a newer release is published
- **Localised Interface**: European Portuguese or English, chosen from your system language

## Architecture

- **Electron + TypeScript**: Cross-platform desktop application
- **React + Tailwind CSS**: Modern frontend framework
- **AES-256-GCM**: Authenticated encryption for drawer contents
- **Argon2id**: Memory-hard key derivation for password-based encryption (with a `scrypt` fallback — see [SECURITY.md](SECURITY.md))
- **Electron Forge**: Single build system for all platforms (built via GitHub Actions)

## Installation

Pre-built binaries for every release: [GitHub Releases](https://github.com/ribaudequin/clavis/releases).

Each release publishes 6 files:

| Platform | Files | Architecture |
|----------|-------|-------------|
| Linux    | `.deb`, `.AppImage` | x86-64 |
| Windows  | `Setup.exe`, `.nupkg`, portable `.zip` | x86-64 |
| macOS    | `.dmg` | **arm64 only** |

> **Unsigned builds.** Clavis is not signed with a certificate (see [SECURITY.md](SECURITY.md)). On Windows, SmartScreen shows "unknown publisher" — choose *More info → Run anyway*. On macOS, the `.app` is ad-hoc signed (free, no certificate) but the `.dmg` is **unnotarized**, so right-click the app and choose **Open**, or run `xattr -d com.apple.quarantine /Applications/Clavis.app`.

> **Architectures, and what has actually been run.** The macOS build is **arm64 only** — the `.dmg` has no Intel (x86-64) or universal variant, and there is no arm64 build for Linux or Windows. The `.dmg` file name carries no architecture, so it does not look like the other two do. **All three platforms are executed by the end-to-end suite** — Linux on every push, and Windows and macOS on every release tag (measured on `v0.6.15-beta`, 2026-10-30: **14/14** on Linux and **14/14** on each of `windows-latest` and `macos-latest`, against the packaged build; 14 rather than 15 because `functional-flow.spec.ts` was deleted as redundant in QA-05). The **published** files themselves — the `.zip`, the `Setup.exe`, the `.dmg` — are still not the ones the suite runs, because it drives the packager output rather than the maker output. See [SECURITY.md](SECURITY.md) for the full list of known limitations.

> **Flatpak**: dropped (2026-10-30). The manifest (`flatpak/com.github.marcelosalvador.Clavis.yaml`) is pinned to `0.3.4-alpha`, never builds (`npm run clean` deletes its source path), and was never published to Flathub; it is not a v1.0.0 blocker. See `docs/MILESTONES.md`.

### From Source

1. Clone this repository:

   ```bash
   git clone https://github.com/ribaudequin/clavis.git
   cd clavis
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Package the application for your platform:

   ```bash
   npm run make
   ```

   Artifacts are written to `out/make/`. On Linux, install the `.deb`, run the `.AppImage`, or extract the portable `.zip`.

> **Running from source:** `npm start` expects a Vite dev server on port 3000. In a plain checkout there is no `dev` script to start it, so `npm start` alone opens a blank window. Either run `npx vite` in a second terminal first, or skip this step and run the packaged artifact from `out/make/`.

## Usage

### Creating a New Drawer

1. Click the **"New Drawer"** button in the header
2. Enter drawer title, password, and confirm password (**at least 20 characters of any mix, or at least 12 characters with an upper-case letter, a lower-case letter, a digit and a symbol** — maximum 128)
3. The drawer appears in your list with its own icon

### Accessing a Drawer

1. Click on a drawer in the list
2. Enter the drawer's password
3. View and edit the contents, then save

### Exporting and Importing a Drawer

Export uses the **Export** button on each drawer row in the list — there is no application menu bar.

- **Export**: Click **Export** on a drawer row. The file is downloaded automatically, with no destination prompt, into your OS default downloads folder and named `<drawer-uuid>.clavis`. Move it somewhere safe.
- **Import**: Click **Import** in the header and choose a `.clavis` file. Importing never overwrites an existing drawer.

### Leaving an Edited Drawer

Pressing **Back** with unsaved edits opens a dialog with three choices: **Cancel**, **Discard and leave**, or **Save and leave**.

> This guard applies to the **Back button only**. There is no `beforeunload` handler, so closing the app window with unsaved edits still discards them. Save before you quit.

### Viewing Credits and Support

1. Click the **heart icon** (❤️) in the top-right of the header
2. The Credits modal shows project info: maintainer, design, icons, security features, and support options (Ko-fi, GitHub, ETH, SOL)
3. If a newer release exists, a green **"New version available: vX.Y.Z"** button links straight to it
4. Close with the **Close** button, the ✕, a click outside the modal, or `Esc`

## Building for Distribution

### All Platforms (GitHub Actions, recommended)

Release binaries are built **remotely on GitHub Actions** native runners (Linux, Windows, macOS) and published to a GitHub Release automatically. The version bump is manual, so bump it first — a tag whose name and `package.json` disagree is how `v0.6.13-beta` ended up publishing `0.6.12` binaries (fixed by the CI tag/version guard, `scripts/check-tag-version.sh`, 2026-10-30). Push `main` first, then the tag; the `release` workflow verifies downloaded artifacts by checksum + name match before publishing.

```bash
npm version 0.6.15-beta --no-git-tag-version   # updates package.json and package-lock.json
git commit -am "v0.6.15-beta — <one-line summary>"
git push origin main                            # quality + e2e run first
git tag v0.6.15-beta
git push origin v0.6.15-beta                    # builds all 3 platforms and publishes
```

The workflow builds all 3 platforms and publishes 6 assets (`.deb` + `.AppImage` for Linux · Squirrel `Setup.exe` + `.nupkg` + portable `.zip` for Windows · `.dmg` for macOS) to [GitHub Releases](https://github.com/ribaudequin/clavis/releases). See `.github/workflows/release.yml` and `BUILD_MANUAL.md`.

To confirm a build carries the version its name claims, extract the app's `package.json` rather than trusting the file name:

```bash
npx @electron/asar extract-file out/clavis-linux-x64/resources/app.asar package.json
```

> Run that from a scratch directory: `extract-file` writes into the **current** one. And note what the check can and cannot show: `config.forge` is **deliberately removed** by Forge from the copy that goes into the asar, so `config: {}` is correct there — makers, plugins and the icon are verified in the source `package.json`.

### Local Build (Linux)

```bash
npm run build    # TypeScript + preload + renderer
npm run make     # .deb + .AppImage
npm run release  # clean + build + make
```

Windows and macOS targets are built in CI on native runners — no Wine cross-compile needed.

### Prerequisites (local Linux)

- Node.js 22+ (CI uses Node 24) and npm 10+ — see `BUILD_MANUAL.md`
- `dpkg-dev` and `fakeroot` for the `.deb`
- `squashfs-tools` for the AppImage

## Downloads

Pre-built binaries for each release: [GitHub Releases](https://github.com/ribaudequin/clavis/releases)

## Credits

- **Concept, design & development:** Marcelo Salvador
- **Thanks to:** all contributors and early testers

Source code, issues, and contributions are welcome on [GitHub](https://github.com/ribaudequin/clavis).

## Support

Clavis is free and open source. If it's useful to you, you can support the work:

<p>
  <a href="https://ko-fi.com/A0383T5"><img src="https://img.shields.io/badge/Ko--fi-Buy%20me%20a%20coffee-ff5f5f?style=flat&logo=ko-fi&logoColor=white" alt="Ko-fi"></a>
  <a href="https://www.patreon.com/banduastudio"><img src="https://img.shields.io/badge/Patreon-Support-f96854?style=flat&logo=patreon&logoColor=white" alt="Patreon"></a>
</p>

**Cryptocurrency** — the ETH address accepts any EVM-compatible chain:

| Coin | Address | Explorer |
|---|---|---|
| ETH | `0x466f0c3ee495a3dc851fafa5c4720ab2fdcd4af4` | [Etherscan](https://etherscan.io/address/0x466f0c3ee495a3dc851fafa5c4720ab2fdcd4af4) |
| SOL | `Hnw5z47sk1hS6FsnCLfgX8pZhDryQVnZpzWJjSSRV5Nf` | [Solscan](https://solscan.io/account/Hnw5z47sk1hS6FsnCLfgX8pZhDryQVnZpzWJjSSRV5Nf) |

These addresses are also available in the app's **Credits** modal (click the ❤️ icon in the header).

## Elsewhere

<p>
  <a href="https://x.com/banduastudio">X</a> ·
  <a href="https://www.linkedin.com/in/bandua-marcelo-salvador">LinkedIn</a> ·
  <a href="https://ko-fi.com/A0383T5">Ko-fi</a> ·
  <a href="https://www.patreon.com/banduastudio">Patreon</a>
</p>

---

*From Portugal, with love.*

## License

[MIT](./LICENSE) — see the [LICENSE](LICENSE) file for details.

## Security Notes

- Drawer contents are encrypted with AES-256-GCM using a key derived from that drawer's password
- Drawer titles, timestamps, and the icon colour data are stored in plaintext inside the `.clavis` file
- Passwords are irreversible: there is no recovery. If you lose a drawer's password, its content is gone
- Drawer passwords are never written to disk — not to the `.clavis` file, and not to any OS keychain
- Drawer files are created with owner-only permissions (mode 0o600) on Linux and macOS. The mode applies at creation only, so a file copied in or restored from a backup keeps the permissions it arrived with. On Windows the mode is ignored and the per-user data directory provides that protection instead
- Exported `.clavis` files are written by the browser download rather than by Clavis, so they do not carry those permissions. The content stays encrypted, but the plaintext title, timestamps and icon colours inside are readable by anyone who can read the file
- Use strong, unique passwords per drawer, and keep your exported `.clavis` files backed up somewhere safe

Full details, including known limitations, are in [SECURITY.md](SECURITY.md).

## UI Notes

- No menu bar at all: the application menu is disabled. The only menu is the right-click cut/copy/paste context menu
- Header contains the application title, an **Import** button, and a Credits button (❤️)
- The interface is localised (European Portuguese and English) from your system language; there is no in-app language selector
- All icons use inline SVG for reliability across packaging formats
