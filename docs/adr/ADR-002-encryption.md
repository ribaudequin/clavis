# ADR 002: Encryption — AES-256-GCM + Argon2id

## Status
Accepted (2026-09-03). Implemented in `v0.1.0-alpha`.

## Context
Storage of sensitive user data (passwords, PINs, bank details) in encrypted "drawers" (`.clavis` files). Must resist brute-force and side-channel attacks.

## Decision
- **Cipher:** AES-256-GCM (authenticated encryption, standard, OWASP-recommended).
- **Key derivation:** Argon2id (memory-hard, OWASP-recommended for password-based encryption).
- **Per-drawer password:** Each drawer uses its own unique password; optional global master password not implemented (post-MVP).
- **Content cap:** Decrypted content capped at 10 MB (`decrypt` cap, `v0.1.7-alpha`).
- **Input validation:** Zod schemas (`SaveDrawerSchema.content.max(10_000_000)`) enforce limits before encryption/decryption.

## Consequences
- All drawer contents encrypted; only metadata (title, icon hash) stored unencrypted.
- No password recovery by design (`SECURITY.md`).
- `CHAN-01` deferred (`inline CHANNELS`); channel names centralized in `src/shared/channels.ts`.
