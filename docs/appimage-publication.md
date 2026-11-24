# AppImage publication — packaging report

**App:** clavis
**Repository:** `ribaudequin/clavis`
**Goal:** publish the AppImage on **AppImageHub** (`appimage.github.io`), then on **Pling / OpenDesktop**
**Report date:** 2026-11-10
**Scope:** packaging only. No application-code changes are required.

---

## 1. Current state (verified 2026-11-10)

| Item | Value |
|---|---|
| Builder | Electron Forge 6.4.2 + `@reforged/maker-appimage` 5.3.1 |
| Electron | `^44.0.0` |
| AppImage | `clavis-1.0.1-x64.AppImage` (release asset) |
| License | MIT |
| Network calls | none in the app code — verified |

### What already passes

- `appdir-lint.sh` — **passes**. The only output is the `No appdata file present` warning.
- `.DirIcon` — present (symlink to `usr/share/icons/hicolor/512x512/apps/clavis.png`).
- `desktop-file-validate` — passes (one hint, see §2.4).
- Icon set — `icons/linux/` already carries 16/24/32/48/64/128/256/512 PNGs, and
  the AppImage ships the 512 px icon under `usr/share/icons/hicolor/`.

---

## 2. Blocking problems

### 2.1 No AppStream metainfo anywhere

There is **no metainfo file in the repository** and none in the AppImage. The
AppImage's `usr/share/` contains only `applications/` and `icons/`.

**Why it matters:** AppImageHub warns about it; software centres and the Pling
store read the description, screenshots and release notes from this file. Without
it the app is listed with no metadata at all.

### 2.2 The desktop file ID does not match the Flatpak ID

| | AppImage (generated) | Flatpak (canonical) |
|---|---|---|
| File name | `clavis.desktop` | `com.github.marcelosalvador.Clavis.desktop` |
| `Icon=` | `clavis` | `com.github.marcelosalvador.Clavis` |
| `Categories=` | `Utility;` | `Utility;Security;` |

There is no metainfo to align with yet, but the AppImage and the Flatpak already
disagree on the app ID. They should share one ID.

### 2.3 Two desktop files in the AppImage

`clavis.desktop` exists both at the AppDir root **and** at
`usr/share/applications/clavis.desktop`. `appdir-lint.sh` only counts the root
one, so it passes — but the duplicate is redundant and can confuse stores.

### 2.4 `Categories` hint

`Utility;Security;` — `Security` is not a main category and triggers a
`desktop-file-validate` hint suggesting `Settings` or `System` as an addition.

### 2.5 No update metadata

No `.zsync` file and no update configuration. AppImageUpdate cannot work.
Optional for AppImageHub, recommended for Pling — whose update transport is
`pling-v1-zsync`.

### 2.6 AppImage file name

`clavis-1.0.1-x64.AppImage`. The AppImage specification recommends
`<name>-<version>-stable-<arch>.AppImage` for the Pling update transport.
Not a blocker for AppImageHub.

### 2.7 The Flatpak manifest is stale and ships no metainfo

`flatpak/com.github.marcelosalvador.Clavis.yaml` still references
`Clavis-0.3.4-alpha.AppImage` while the current release is 1.0.1, and it
installs **no** metainfo. This is a separate track from the AppImage, but it
should be fixed in the same pass so both channels carry the same metadata.

### 2.8 Electron 44 raises the glibc floor

Electron 44 needs a newer glibc than Electron 31. AppImageHub requires the
AppImage to run on the oldest still-supported Ubuntu LTS. **This must be
verified explicitly** — if the floor is above that LTS, the AppImageHub build will
be red.

---

## 3. Recommendations (in order)

### R1 — Create the AppStream metainfo *(blocking)*

Add `com.github.marcelosalvador.Clavis.metainfo.xml` at the repository root,
using the **same app ID as the Flatpak** (`com.github.marcelosalvador.Clavis`):

- `<id>com.github.marcelosalvador.Clavis</id>`
- `<launchable type="desktop-id">com.github.marcelosalvador.Clavis.desktop</launchable>`
- a `<summary>` and a `<description>` (the app's own words)
- at least one `<screenshot>` (the default one is used for the store listing)
- a `<releases>` block with the current version
- a **cached** `<icon>` — not a remote URL
- `<project_license>MIT</project_license>`

Validate it with `appstreamcli validate` before going further.

### R2 — Ship the metainfo inside the AppImage *(blocking)*

The maker builds the AppDir from the packaged output, so copy the metainfo into
the package directory **before** the maker runs. The repository already has a
Forge plugin (`scripts/forge-plugin-adhoc-sign.js`) with a `postPackage` hook —
extend it (or add a sibling plugin) to copy:

- `com.github.marcelosalvador.Clavis.metainfo.xml` → `<package>/usr/share/metainfo/`
- `com.github.marcelosalvador.Clavis.desktop` → `<package>/usr/share/applications/`

and to place the icon set at
`<package>/usr/share/icons/hicolor/<size>x<size>/apps/com.github.marcelosalvador.Clavis.png`.

**Verify after the build:** extract the AppImage and confirm the three paths.

### R3 — Align the desktop file ID *(blocking)*

Set the maker's `name` / executable name (or rename in the same hook) so the
desktop file is `com.github.marcelosalvador.Clavis.desktop` with
`Icon=com.github.marcelosalvador.Clavis`. One ID across AppImage, Flatpak and
metainfo.

### R4 — Remove the duplicate desktop file

Keep the copy under `usr/share/applications/`; drop the one at the AppDir root so
`appdir-lint.sh` still sees exactly one and the store reads the canonical one.

### R5 — Fix the Categories

Use a single main category (`Utility;`) and drop `Security` from the main slot.

### R6 — Add update metadata *(optional now, required for Pling)*

Generate a `.zsync` per release (e.g. `zsyncmake`) and publish it next to the
AppImage. Needed for AppImageUpdate and for the Pling `pling-v1-zsync` transport.

### R7 — Rename the artifact

`artifactName` → `clavis-${version}-stable-x64.AppImage`, matching the
specification.

### R8 — Update the Flatpak manifest *(same pass)*

Point `flatpak/com.github.marcelosalvador.Clavis.yaml` at the current release and
install the metainfo alongside the desktop file and icons, so both channels carry
identical metadata.

---

## 4. Verification checklist (run before submitting)

```bash
npm run make

./out/make/AppImage/x64/clavis-<version>-x64.AppImage --appimage-extract
appdir-lint.sh squashfs-root                          # expect: no fatal issues
desktop-file-validate squashfs-root/*.desktop
appstreamcli validate-tree squashfs-root

ls squashfs-root/usr/share/metainfo/                  # must exist
ls squashfs-root/usr/share/applications/              # must exist
ls squashfs-root/usr/share/icons/hicolor/*/apps/     # must exist

grep -h "^Icon=" squashfs-root/usr/share/applications/*.desktop
grep "<launchable" squashfs-root/usr/share/metainfo/*.xml   # IDs must agree

rm -rf squashfs-root
```

Additionally, confirm the glibc floor (§2.8) against the oldest supported Ubuntu
LTS before opening the AppImageHub pull request.

---

## 5. Submission steps

### AppImageHub

1. Open <https://github.com/AppImage/AppImageHub/new/master/data> and add a file
   named after the app.
2. The file contains **one line**: the URL of this repository's Releases page —
   `https://github.com/ribaudequin/clavis/releases`.
3. Send the pull request. Travis CI downloads the AppImage, runs it and validates
   it automatically.
4. A **red** build means a check failed — read the Travis log and fix it.
5. A **green** build merges, and the app appears at `appimage.github.io`.

AppImageHub does not track versions: re-submit only when the metadata inside the
AppImage changes.

### Pling / OpenDesktop (after AppImageHub)

1. Create an account at `opendesktop.org`.
2. Register the product at `opendesktop.org/product/add` — one product per
   artifact type, entered by hand.
3. Upload the AppImage and fill in the description, screenshots and source link.
4. Put the Ko-fi and Patreon links in the description. Pling no longer pays
   creators, so those links are the only revenue path.

---

## 6. Notes

- The app makes no network calls, which satisfies the AppImageHub rule
  "must run without an active Internet connection".
- The license is MIT, which both AppImageHub and Pling accept.
- The icon set is already complete in `icons/linux/`; the work is placement and
  naming, not artwork.
