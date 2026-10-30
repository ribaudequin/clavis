# Clavis User Guide

## Drawers
- Create: title + password (≥20 chars of any mix, or ≥12 chars with upper, lower, digit and symbol).
- Unlock: same password.
- Edit: content + save. Two ceilings apply, and the app says which one refused the save: **10 M characters**
  (code points) and **10 M UTF-8 bytes**. The same count of characters can weigh more than the byte limit allows
  — `ã` is one character and two bytes — so the counter shown next to the editor is not the only limit that matters.
- Import / Export: `.clavis` encrypted files. Import never overwrites an existing drawer.

## Password recovery
Not possible by design — AES-256-GCM + Argon2id, no backdoor.

## Security notes
- Drawer contents are AES-256-GCM ciphertext under an Argon2id key. Titles, timestamps and icon colours are
  plaintext in the `.clavis` file — see `SECURITY.md`.
- Passwords are never written to disk, and there is no recovery path.
- One instance per profile: a second launch on the same profile exits and focuses the first.
- The Linux `.deb` and `.AppImage` and the Windows/macOS builds are unsigned (macOS: ad-hoc signed, not
  notarised). `SECURITY.md` documents the consequences and the Gatekeeper/SmartScreen overrides.
