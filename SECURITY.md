# Security Policy — Clavis

## Supported Versions

| Version     | Supported |
|-------------|-----------|
| v0.3.2-alpha | ✅         |
| v0.3.1-alpha | ✅         |
| v0.2.x       | ✅         |
| v0.1.x       | ✅         |
| < v0.1.0     | ❌         |

## Reporting a Vulnerability

If you have found a security vulnerability in Clavis, we appreciate responsible disclosure.

**Do not open a public issue for security vulnerabilities.** Instead, please contact us directly:

- **Email:** (keep contact via private GitHub Issues or via the maintainer profile `@ribaudequin`)
- **Repository:** https://github.com/ribaudequin/clavis

We will respond within 72 hours. If you do not receive a response, please follow up with a reminder message.

## Security Model

- **Encryption:** AES-256-GCM per drawer; key derived via Argon2id (memory-hard, OWASP-recommended).
- **Passwords:** Minimum 8 characters enforced in the backend (`store.ts`) and in the frontend (Zod schemas).
- **Input validation:** All IPC handlers use `Zod` runtime validation (`.parse()`).
- **IPC security:** `import-drawer` uses a token whitelist (`allowedImportPaths` Map, 5-minute expiry) to prevent arbitrary file reads.
- **Content cap:** Decrypted content capped at 10 MB (`decrypt` cap).
- **Symlink rejection:** `import-drawer` rejects symbolic links (`fs.lstat` + `isSymbolicLink()`).
- **CSP / Sandbox:** Renderer runs with `sandbox` enabled; preload exposes only declared APIs.
- **No code signing:** Deliberately unsigned (no EV certificates). Users must accept the Gatekeeper / SmartScreen warning on first launch.

## Vulnerability Response

1. Confirm receipt.
2. Assess impact (P0 / P1 / P2 / P3) and create a patch.
3. Publish a release with the fix and update `CHANGELOG.md`.
4. Thank the researcher (if desired, with credit in `CHANGELOG.md`).

## Notes

- Passwords are irreversible: there is no password recovery by design. If a drawer password is lost, the content cannot be recovered.
- Backup: export `.clavis` files manually (`File` → `Export`) to a secure location.
- No cloud service or remote sync is integrated; the app is local-first.
