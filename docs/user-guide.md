# Clavis User Guide

## Drawers
- Create: title + password (≥12 chars, mixed).
- Unlock: same password.
- Edit: content + save (10 M bytes / 10 M code points cap; byte limit governs save).
- Import / Export: `.clavis` encrypted files.

## Password recovery
Not possible by design — AES-256-GCM + Argon2id, no backdoor.

## Security notes
- Use isolated `--user-data-dir` (default: profile isolation).
- AppImage verified via ASAR + `PE32+`.
