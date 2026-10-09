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

| Platform | Files |
|----------|-------|
| Linux    | `.deb`, `.AppImage` |
| Windows  | `Setup.exe`, `.nupkg`, portable `.zip` |
| macOS    | `.dmg` |

> **Unsigned builds.** Clavis is deliberately unsigned (see [SECURITY.md](SECURITY.md)). On Windows, SmartScreen shows "unknown publisher" — choose *More info → Run anyway*. On macOS, the `.dmg` is unnotarized, so right-click the app and choose **Open**, or run `xattr -d com.apple.quarantine /Applications/Clavis.app`.

> **Flatpak**: a manifest exists in `flatpak/` but is experimental and does not currently build.

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
2. Enter drawer title, password, and confirm password (minimum 8 characters, maximum 128)
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

Release binaries are built **remotely on GitHub Actions** native runners (Linux, Windows, macOS) and published to a GitHub Release automatically. Just push a version tag matching `package.json`:

```bash
git tag v0.4.6-beta
git push origin v0.4.6-beta
```

The workflow builds all 3 platforms and publishes 6 assets (`.deb` + `.AppImage` for Linux · Squirrel `Setup.exe` + `.nupkg` + portable `.zip` for Windows · `.dmg` for macOS) to [GitHub Releases](https://github.com/ribaudequin/clavis/releases). See `.github/workflows/release.yml` and `BUILD_MANUAL.md`.

### Local Build (Linux)

```bash
npm run build    # TypeScript + preload + renderer
npm run make     # .deb + .AppImage
npm run release  # clean + build + make
```

Windows and macOS targets are built in CI on native runners — no Wine cross-compile needed.

### Prerequisites (local Linux)

- Node.js 20+ (CI uses Node 22) and npm 10+ — see `BUILD_MANUAL.md`
- `dpkg-dev` and `fakeroot` for the `.deb`
- `squashfs-tools` for the AppImage

## Downloads

Pre-built binaries for each release: [GitHub Releases](https://github.com/ribaudequin/clavis/releases)

# Credits & support

Clavis is an open-source, cross-platform encrypted notes app built to keep your passwords, PINs, bank details, and safe codes private and secure.

Source code, issues, and contributions are welcome on [GitHub](https://github.com/ribaudequin/clavis).

## Credits

- **Concept, design & development:** Marcelo Salvador
- **Thanks to:** all contributors and early testers

## Support this project

Clavis is free and open source. If it's useful to you, consider supporting its development — every bit helps keep it maintained and improving.

**Ko-fi:** https://ko-fi.com/A0383T5

**Cryptocurrency** (any EVM-compatible chain for ETH):
- **ETH:** `0x466f0c3ee495a3dc851fafa5c4720ab2fdcd4af4`
- **SOL:** `Hnw5z47sk1hS6FsnCLfgX8pZhDryQVnZpzWJjSSRV5Nf`

---

*From Portugal, with love.*

## License

This project is open source and available under the MIT License.

## Security Notes

- Drawer contents are encrypted with AES-256-GCM using a key derived from that drawer's password
- Drawer titles, timestamps, and the icon colour data are stored in plaintext inside the `.clavis` file
- Passwords are irreversible: there is no recovery. If you lose a drawer's password, its content is gone
- Drawer passwords are never written to disk — not to the `.clavis` file, and not to any OS keychain
- Use strong, unique passwords per drawer, and keep your exported `.clavis` files backed up somewhere safe

Full details, including known limitations, are in [SECURITY.md](SECURITY.md).

## UI Notes

- No menu bar at all: the application menu is disabled. The only menu is the right-click cut/copy/paste context menu
- Header contains the application title, an **Import** button, and a Credits button (❤️)
- The interface is localised (European Portuguese and English) from your system language; there is no in-app language selector
- All icons use inline SVG for reliability across packaging formats
