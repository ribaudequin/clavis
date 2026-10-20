# Clavis User Guide

## Drawers
- Create: title + password (≥20 chars of any mix, or ≥12 chars with upper, lower, digit and symbol).
- Unlock: same password.
- Edit: content + save (10 M bytes / 10 M code points cap; byte limit governs save).
- Import / Export: `.clavis` encrypted files.

## Password recovery
Not possible by design — AES-256-GCM + Argon2id, no backdoor.

## Security notes
- Use isolated `--user-data-dir` (default: profile isolation).
- AppImage verified via ASAR + `PE32+`.
