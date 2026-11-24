# Clavis User Guide

## Drawers
- Create: title + password (≥20 chars of any mix, or ≥12 chars with upper, lower, digit and symbol).
- Unlock: same password.
- Edit: content + save. Two ceilings apply, and the app says which one refused the save: **10 M characters**
  (code points) and **10 M UTF-8 bytes**. The same count of characters can weigh more than the byte limit allows
  — `ã` is one character and two bytes — so the counter shown next to the editor is not the only limit that matters.
- Import / Export: `.clavis` encrypted files. Import never overwrites an existing drawer.

## Backups
Clavis keeps **three generations of backup** for every drawer, written alongside the live `.clavis` file in the
drawers directory. On every save, the previous state is rotated through `.clavis.bak`, `.clavis.bak.1`, and
`.clavis.bak.2` — oldest overwritten, newest preserved. Backups are encrypted (same cipher, same password), so
they carry no additional confidentiality risk.

### Recovery
If a drawer opens with content you do not recognise — for example, after a save that ran while the disk was
full, or a crash between the two renames in `atomicWrite` — the previous state is in the backup file.

**Automatic recovery:** on startup, Clavis checks for `.bak` files whose live `.clavis` is missing (the crash
window). If found, the backup is renamed back into place automatically.

**Manual recovery:** if the live file exists but its content is wrong, you can restore a previous generation:

1. Quit Clavis.
2. Find the drawer file in your data directory:
   - **Linux:** `~/.config/Clavis/drawers/<id>.clavis`
   - **Windows:** `%APPDATA%/Clavis/drawers/<id>.clavis`
   - **macOS:** `~/Library/Application Support/Clavis/drawers/<id>.clavis`
3. Look for `<id>.clavis.bak` (previous state), `<id>.clavis.bak.1` (two saves ago), or `<id>.clavis.bak.2`
   (three saves ago).
4. Rename the backup you want to restore to `<id>.clavis` (overwriting the current file).
5. Restart Clavis and unlock the drawer with its password.

## Password recovery
Not possible by design — AES-256-GCM + Argon2id, no backdoor.

## Security notes
- Drawer contents are AES-256-GCM ciphertext under an Argon2id key. Titles, timestamps and icon colours are
  plaintext in the `.clavis` file — see `SECURITY.md`.
- Passwords are never written to disk, and there is no recovery path.
- One instance per profile: a second launch on the same profile exits and focuses the first.
- The Linux `.deb` and `.AppImage` and the Windows/macOS builds are unsigned (macOS: ad-hoc signed, not
  notarised). `SECURITY.md` documents the consequences and the Gatekeeper/SmartScreen overrides.
