# Security Policy — Clavis

## Supported Versions

The current release (**`0.4.6-beta`**) is the supported version. Older releases are **best-effort** — fixes are not backported.

The one guarantee that does hold across versions: **drawer files created in the v0.3–v0.4 range remain unlockable**, because decryption always uses the KDF parameters stored inside each file rather than the parameters compiled into the running binary. A drawer written with the legacy 2^16 KiB Argon2id memory cost still opens in a current build.

## Reporting a Vulnerability

If you have found a security vulnerability in Clavis, we appreciate responsible disclosure.

**Do not open a public issue for security vulnerabilities.** Use GitHub's private reporting channel instead:

- **Report privately:** GitHub's private advisory form for this repository — [Report a vulnerability](https://github.com/ribaudequin/clavis/security/advisories/new). If the form is unavailable or you are unsure it reached the maintainer, contact [@ribaudequin](https://github.com/ribaudequin) through their GitHub profile and ask for a private channel.
- **Repository:** https://github.com/ribaudequin/clavis

Please include the version, the platform, the steps to reproduce, and the impact you observed.

## Security Model

### Encryption and key derivation

- **AES-256-GCM** per drawer, with a 16-byte random IV per save and a 16-byte random salt per save. Salt and IV are never reused across saves.
- **Argon2id** KDF, default parameters **timeCost 3, memory 2^18 KiB (256 MiB), parallelism 4**.
- **Legacy parameters stay supported.** Decryption reads `timeCost`, `memoryCost` and `parallelism` from the drawer's own metadata, so files created with earlier parameters decrypt correctly.
- Derived keys and password buffers are zeroed (`Buffer.fill(0)`) after use.
- **An unsuccessful unlock still performs a dummy key derivation** (`store.ts`), so a missing drawer, an invalid ID, or out-of-bounds KDF parameters take comparable time to a real attempt. This is a timing-attack mitigation, not a guarantee.

### KDF parameter bounds

KDF parameters are validated against explicit bounds (`encryption.ts`, enforced in `store.ts`):

- A **security floor** of 2^16 KiB (64 MiB) memory cost.
- A **crash-safety cap** at 2^20 KiB. 2^21 KiB was observed to crash the Electron main process with `SIGTRAP` during the native allocation; the cap keeps the app inside that boundary.

### Passwords

- Minimum **8 characters**, maximum **128**, for drawer creation and save.
- **Zod validation runs in the main process only.** The renderer's minimum-length check is a plain `password.length < 8` test counting UTF-16 code units, while the main process enforces a minimum of 8 **bytes** on the UTF-8 buffer. For some non-ASCII input the two disagree: a password the UI accepts can be rejected by the main process. The renderer check is a length test, not a Zod schema.
- Passwords are **irreversible**. There is no recovery path, by design.

### Unlock rate limiting

Progressive delays on failed unlock attempts, tracked per drawer in memory (`ipc-handlers.ts`):

| Failed attempts | Delay before next attempt |
|-----------------|---------------------------|
| 3 or more       | 1 second                 |
| 5 or more       | 5 seconds                |
| 10 or more      | 30 seconds               |

The counter resets after 2 minutes of inactivity and is cleared on a successful unlock. This is in-memory only — it does not survive an app restart.

### Input validation and IPC

- **All IPC handlers validate their arguments with Zod** (`.parse()`) in the main process.
- **UUID validation** on every handler that accepts a drawer ID (`store.ts`).
- **Import uses a single-use token whitelist** (`allowedImportPaths`). The token is minted from the native file dialog, expires after **5 minutes**, and is **deleted before the file is read** — a token cannot be replayed.
- **Symlinks are rejected** on import via `fs.lstat` / `isSymbolicLink()`.
- **Import cannot overwrite** an existing drawer: an import of an already-present ID fails with `DrawerAlreadyExistsError`. Duplicate *titles* are permitted; the UI warns about them.

### Content and file limits

- Decrypted content is capped at **10,000,000 bytes** (`encryption.ts`).
- Save is capped at the same 10,000,000 bytes via Zod (`validation.ts`).
- Import files are capped at **11,000,000 bytes**, with a **pre-decrypt size check on unlock** so an oversized payload is rejected before any decryption work is done.

### Process and window hardening

- Renderer runs with **`sandbox: true`, `nodeIntegration: false`, `contextIsolation: true`**. The preload script exposes only the declared API surface.
- **Navigation is blocked**: `will-navigate` and `will-attach-webview` are both prevented. `setWindowOpenHandler` denies all window creation, forwarding only `https://` URLs to the system browser.

### Filesystem permissions

- Data directory created with mode **`0o700`**.
- Drawer files written with mode **`0o600`**.

### Content-Security-Policy

The renderer ships a CSP via an HTML `<meta>` tag (`src/renderer/index.html`):

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
object-src 'none'; base-uri 'self'; form-action 'self';
frame-ancestors 'none'; connect-src 'self';
```

**Enforced:** `default-src`, `script-src`, `object-src`, `base-uri`, `form-action`, and `connect-src 'self'`. `connect-src 'self'` is what forces the update check to run in the main process — the renderer cannot make the request itself.

**Not enforced:** `frame-ancestors 'none'` is a **no-op here**. Per spec, `frame-ancestors` (like `report-uri` and `sandbox`) is ignored in meta-delivered policies and only functions as an HTTP response header. There is no header path: no `onHeadersReceived` handler is registered, and the packaged app loads over `file://`, which cannot carry response headers. **Clavis therefore has no active clickjacking protection**, despite the directive being present. Practical risk is low — nothing remote is ever rendered — but the directive should not be read as an active control.

### Network posture

The application makes **exactly one outbound request**, from the main process:

```
https://api.github.com/repos/ribaudequin/clavis/releases/latest
```

It is made **only when the Credits modal is opened**, and only to compare the latest `tag_name` against the running version. No telemetry, no analytics, no crash reporting, no update feed, and no `electron-updater`. Logs are written locally to the data directory.

### No code signing

Deliberately unsigned — there are no EV certificates and no Apple notarization credentials.

- **Windows**: the release workflow passes two optional, unset secrets (`WINDOWS_CERT_FILE`, `WINDOWS_CERT_PASSWORD`). Because no signing happens, the `.exe` shows **"unknown publisher"** in SmartScreen and requires an explicit *More info → Run anyway*.
- **macOS**: the `.dmg` is built with `format: "ULFO"` (unnotarized). Gatekeeper blocks first launch and requires an explicit override: right-click the app → **Open**, or `xattr -d com.apple.quarantine /Applications/Clavis.app`.

## Known Limitations

Two items are documented honestly rather than presented as working controls.

### 1. The KDF is not unconditionally Argon2id

`encryption.ts` lazily `require()`s the `argon2` native module. **If that module fails to load** — most commonly when a wrong-architecture `argon2.node` is bundled, such as a Windows build cross-compiled on Linux — the code **falls back to Node's `scrypt`** (`N` clamped to 2^14–2^17, `r = 8`, `p` from the stored parameters).

- The main process **logs a warning** at startup and per derivation, but there is **no user-visible indication** that a drawer was encrypted with a different KDF.
- Worse, drawer metadata **hardcodes `algorithm: "argon2id"`** (`store.ts`) regardless of which backend actually ran. **In the fallback case the file's stated KDF is inaccurate.**
- **Impact is limited to the KDF, not the cipher.** AES-256-GCM and the `.clavis` file format are unaffected, and drawers created under either backend remain unlockable, because decryption uses the per-file stored parameters.

### 2. `frame-ancestors 'none'` provides no protection

Described in full under [Content-Security-Policy](#content-security-policy) above. The directive is present but inert in a meta-delivered policy, so there is no active clickjacking defence.

### Password length check mismatch

Also described above under [Passwords](#passwords). The renderer's UTF-16 length test and the main process's UTF-8 byte test can disagree on non-ASCII input.

## Vulnerability Response

1. Confirm receipt.
2. Assess impact (P0 / P1 / P2 / P3) and create a patch.
3. Publish a release with the fix and update `CHANGELOG.md`.
4. Thank the researcher (if desired, with credit in `CHANGELOG.md`).

## Notes

- **Passwords are irreversible.** If a drawer password is lost, the content cannot be recovered. This applies to the app's own storage as well as to exported `.clavis` files.
- **Backup:** export `.clavis` files from the **Export** button on each drawer row (there is no `File` menu) and keep them somewhere secure. Export triggers a browser-style download into the OS default downloads folder with no destination prompt, and names the file after the drawer's UUID.
- **Plaintext metadata:** drawer titles, timestamps, and icon colour data are stored unencrypted inside the `.clavis` file. Treat titles as sensitive.
- **No cloud service or remote sync is integrated.** The app is local-first.
