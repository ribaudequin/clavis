# Security Policy — Clavis

## Supported Versions

The current release (**`0.6.5-beta`**) is the supported version. Older releases are **best-effort** — fixes are not backported.

The one guarantee that does hold across versions: **drawer files created in the v0.3–v0.4 range remain unlockable**, because decryption uses the KDF parameters stored inside each file rather than the parameters compiled into the running binary. A drawer written with the legacy 2^16 KiB Argon2id memory cost still opens in a current build. Since SEC-01 the same is true of the recorded backend: a scrypt drawer opens on an argon2 build, and an argon2id drawer on a build without the native module fails as `KDF_UNAVAILABLE` rather than being decrypted with the wrong KDF.

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

- **A new drawer password is accepted on either of two branches: at least 20 characters of any mix, or at least 12 characters with an upper-case letter, a lower-case letter, a digit and a symbol** (maximum 128). They are alternatives, not a sequence — the second is the short path, the first is the passphrase path. **The floor is 12, not 20:** a 19-character mixed password is accepted, and nothing in Clavis requires 20 characters as such.
- **Length is counted in code points**, not in UTF-16 code units, so an astral character counts once: ten emoji are ten characters, not the twenty `String.length` would report. The schema's own 128-character maximum is measured the same way (Zod folds surrogate pairs), so the policy's minimum and the schema's maximum are in the same unit.
- **Length is checked before shape, and that order is the point.** Users answer a composition rule in predictable ways. A user with a 30-character passphrase who is *required* to comply applies a **deterministic transformation** to it — `correct horse battery staple1!` — and that transformation is one an attacker's rules dictionary already enumerates. So the compliance step does not add entropy; it collapses a large set of possible secrets onto a much smaller one. The length branch exists so that the secret the user actually meant to keep is not thrown away.
- **What the rule is not: an entropy check.** It constrains length, and below 20 characters it also constrains shape. `Passw0rd!!!1` satisfies the composition branch today and has almost no guess resistance, and Clavis ships **no common-password blocklist**, so nothing stops a user from choosing a password a dictionary already contains. See [Known Limitations](#5-the-password-policy-constrains-length-and-shape-not-entropy).
- **One module owns the rule** (`src/shared/password-policy.ts`). The main process enforces it twice — by `CreateDrawerSchema` and by the store — and the renderer **calls the same module**, so the create form and the schema cannot disagree: the user sees the reason before submitting, and the main process is what decides.
- **The rule is a create-time rule, deliberately.** There is no change-password channel, so a save can only re-use the password that already opens the drawer, and drawers created under an older rule still open with the passwords they were created with. `SaveDrawerSchema` and `UnlockDrawerSchema` therefore carry sanity bounds only (1–128 characters, no composition rule): enforcing the policy there would strand exactly those users, who could unlock a drawer and then not save it.
- **The policy is not stored in the `.clavis` file** — the file records the drawer's `keyDerivation` parameters, not the rule that was applied to it — so there is no migration and no format change, and no drawer written by any version is affected. Almost every password the previous policy accepted is still accepted; the one exception is a password that carried an astral character, because the previous rule counted UTF-16 units and this one counts code points. A drawer created with such a password still opens and still saves, because the rule is create-time only.
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
- **Crypto fields are shape-checked** (`EncryptedDrawerSchema`, used on import, list and unlock): `salt`, `iv` and `authTag` are exactly 32 hex characters (16 bytes), and `encryptedData` is even-length hex. An empty ciphertext is valid — empty content encrypts to an empty string.
- **Metadata is schema-validated** on import, list and unlock: `title`, `iconData`, `createdAt` and `updatedAt` are typed and bounded. `iconData` must parse as a JSON array of at most 64 strings, each at most 64 characters.
- **Corrupt metadata does not count as a guess.** Unlock returns `INVALID_JSON` (`corrupt_metadata`) and the attempt is not added to the unlock rate limiter.
- **`listDrawers()` skips a file whose internal `id` does not match its filename**, so it never lists an entry that `getDrawerFilePath()` cannot open.

### Content and file limits

- Decrypted content is capped at **10,000,000 bytes** (`encryption.ts`).
- Save is capped at the same 10,000,000 by Zod (`validation.ts`) — but Zod 4.5.4's `.max()` counts **code points**, not UTF-16 code units and not bytes. A code point may be up to 4 UTF-8 bytes, so the save ceiling is worth up to 40 MB of UTF-8.
- A **pre-decrypt size check on unlock** (`store.ts:333`, via `isCiphertextOverCap` at `store.ts:117`) rejects a payload longer than **10,000,000 decoded bytes** before any decryption work is done. That bound is the decrypted-content limit, because AES-GCM ciphertext is exactly as long as its plaintext; a separate, larger file-size constant would have left the guard unable to fire.
- ✅ **Fixed (2026-10-16, commit `d2bdb98`; `ff4efb7` is an orphaned duplicate of the same change).** The save schema (`Zod .max()` — code points) and the unlock guard (UTF-8 bytes) count different things by design, and that gap is now handled rather than open. `encrypt()` now throws `ContentTooLargeError` (`SAV-03`); `unlockDrawer()` returns `{ok:false,reason:'content_too_large'}` or `'too_large'` (`SAV-02`); `importDrawerRaw()` rejects oversized ciphertext (`SAV-01`, `store.ts:598`); and all read paths (`listDrawers`, `unlockDrawer`, `saveDrawer`, `readDrawerRaw`, migration) measure `stat.size` before allocating (`Block B`). The practical ceiling for accented Portuguese remains ~9.1 M characters. See `docs/DRAWER-CAPACITY.md`.
- `unlockDrawer()` now returns `{ok:false,reason}` (`SAV-02`) — six distinct reasons including `'too_large'`, so an oversized drawer is not misreported as a wrong password or rate-limited incorrectly.
- Import files are capped at **20,004,096 characters of JSON**, derived from the decrypted-content limit rather than set independently: the payload is hex, so a file costs two characters per byte of text, and the cap is `MAX_DECRYPTED_SIZE * 2 + 4_096` (`store.ts`).
- `importDrawerRaw()` now validates `encryptedData` length (`store.ts:598`) (`SAV-01` / `SAV-04`), so oversized drawers are refused at import rather than imported cleanly. The derived cap (`MAX_DRAWER_FILE_SIZE`) is sound, but a drawer saved before the fix that exceeds the byte ceiling cannot be recovered — it must be rebuilt from a backup.

### Process and window hardening

- Renderer runs with **`sandbox: true`, `nodeIntegration: false`, `contextIsolation: true`**. The preload script exposes only the declared API surface.
- **Navigation is blocked**: `will-navigate` and `will-attach-webview` are both prevented. `setWindowOpenHandler` denies all window creation, forwarding only `https://` URLs to the system browser.
- **Only one process may run against a data directory.** The main process takes Chromium's single-instance lock (`app.requestSingleInstanceLock()`) at startup, before the app is ready. A second process on the same profile writes the refusal to the log file and quits **without** creating a window, registering the IPC handlers or touching the drawer store; the instance that holds the lock is brought forward instead, restoring a minimized window and focusing it.
  - **Why it is a control and not a nicety:** `saveDrawer` is a read-modify-write with no lock of its own. Without the process lock, two instances on the same profile would both load a drawer, and the last write would silently discard the other's content.
  - **The lock is per data directory**, not per executable: a second instance started with a *different* profile is an independent application and is not affected. On Linux the lock files (`SingletonLock`, `SingletonSocket`) live inside the `userData` directory.
  - The refusal path is verified end to end against the packaged build: a second instance on the same profile exits by itself, the primary instance keeps running, and the refused process never reaches `app.whenReady()`.

### Filesystem permissions

Drawers are stored in a `drawers` subdirectory of Electron's `userData` path. The directory is created with mode **`0o700`** (`store.ts`, `ensureDataDir`); each drawer file is written with mode **`0o600`** on create (`store.ts:205`), save (`:356`) and import (`:453`).

- **Linux and macOS:** the mode is applied when the file is created, and the process umask can only clear bits, never add them. `0o600` is therefore an upper bound on what a newly created drawer file can be, not a lower bound.
- **An existing file is never tightened.** The Node.js documentation states that the `mode` option of `fs.writeFile()` "only affects the newly created file", and `fs.mkdir()`'s likewise applies at creation only. A drawer file that is already in place with looser permissions — restored from a backup, copied in by hand, or unpacked from an archive — keeps them, and saving it again does not change them. **This holds on Linux and macOS too; it is not a Windows-only gap.**
- **The old-data migration is the exception.** It copies each file with `fs.copyFile()` and then calls `fs.chmod(dst, 0o600)` on the copy (`store.ts:116-117`), because a copy carries the source's permissions across. Migrated drawers are tightened whatever the original had.
- **Windows:** `mode` is ignored. Node.js documents `fs.mkdir()`'s `mode` as "not supported on Windows", and file modes do not apply there either. Protection comes instead from the ACL inherited from the per-user `%APPDATA%` directory that `userData` resolves to, which Windows restricts to that user by default. The practical outcome is comparable, but **the control is the operating system's, not Clavis's**.
- **Exports get none of this** — see [3. Exported `.clavis` files do not inherit the app's file permissions](#3-exported-clavis-files-do-not-inherit-the-apps-file-permissions).

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

**The check is bounded and fails closed.** It carries a **5-second** deadline after which the request is destroyed, listens for an error on the response as well as on the request, treats any non-2xx status as *no information* rather than parsing the body, and validates the payload with Zod. Every one of those paths resolves "no update known" instead of propagating: a stalled or hostile response can cost the About card its version line, and cannot hang the renderer, crash the main process, or leave the app believing it is up to date when it is not.

### Code signing and notarization

There are no EV certificates and no Apple notarization credentials.

- **Windows**: the release workflow passes two optional, unset secrets (`WINDOWS_CERT_FILE`, `WINDOWS_CERT_PASSWORD`). Because no signing happens, the `.exe` shows **"unknown publisher"** in SmartScreen and requires an explicit *More info → Run anyway*.
- **macOS**: the `.app` bundle is **ad-hoc signed** — `codesign --force --deep --sign -`, which needs no certificate, no Apple account and no money, and is what makes the bundle launchable on arm64 (an invalid signature is a SIGKILL at launch). It is **not notarized**, because notarization needs the paid Apple Developer ID certificate, which this project does not have. So the `.dmg` is still built with `format: "ULFO"` and Gatekeeper still blocks the first launch: right-click the app → **Open**, or `xattr -d com.apple.quarantine /Applications/Clavis.app`.

## Known Limitations

Five items are documented honestly rather than presented as working controls.

### 1. The KDF is not unconditionally Argon2id

`encryption.ts` lazily `require()`s the `argon2` native module. **If that module fails to load** — most commonly when a wrong-architecture `argon2.node` is bundled, such as a Windows build cross-compiled on Linux — the code **falls back to Node's `scrypt`** (`N` clamped to 2^14–2^17, `r = 8`, `p` from the stored parameters).

- The main process **logs a warning** at startup and per derivation, but there is **no user-visible indication** that a drawer was encrypted with a different KDF.
- Drawer metadata **records the backend that actually derived the key** (`encryption.ts` returns it, `store.ts` writes it). Decryption and re-encryption read `keyDerivation.algorithm` and use that backend, so a scrypt drawer keeps opening on a machine where `argon2` did load. Re-encrypting on save uses the same backend and rewrites the same value; the label can no longer disagree with the ciphertext.
- If a drawer asks for `argon2id` and the native module is absent, the unlock fails with `KDF_UNAVAILABLE` — not `WRONG_PASSWORD`. The key is never derived with a different KDF, because that could only ever produce a wrong key. Legacy files with no `algorithm` field keep the previous behaviour (the backend this build supports).
- The scrypt fallback now passes an explicit `maxmem`. Node's 32 MiB default was below the 64 MiB needed at the default memory cost (2^18 → `N = 2^16`), so the fallback used to throw `ERR_CRYPTO_INVALID_SCRYPT_PARAMS` instead of creating a drawer.
- **Impact is limited to the KDF, not the cipher.** AES-256-GCM and the `.clavis` file format are unaffected.

### 2. `frame-ancestors 'none'` provides no protection

Described in full under [Content-Security-Policy](#content-security-policy) above. The directive is present but inert in a meta-delivered policy, so there is no active clickjacking defence.

### 3. Exported `.clavis` files do not inherit the app's file permissions

Export never writes the destination file from the main process. The raw drawer JSON is returned over IPC (`ipc-handlers.ts`, `EXPORT_DRAWER`) and handed to Chromium as a `Blob`, which triggers an `<a download>` (`HomeScreen.tsx`); Chromium creates the file in the OS downloads folder with its own default permissions, and the `0o600` mode described under [Filesystem permissions](#filesystem-permissions) never reaches it. On Linux and macOS no restrictive mode is applied to it, so it lands with the creating process's default — commonly `0o644`, readable by other local accounts.

**What this exposes is metadata, not content.** The drawer body is AES-256-GCM ciphertext, so a readable export still discloses nothing without the password. What it does disclose is the plaintext metadata listed under [Notes](#notes): the drawer title, the creation and update timestamps, and the icon colour data.

### 4. The published artifacts cover two architectures, and only one of them has ever been run

**Architectures.** Linux and Windows are published for **x86-64** (`.deb` amd64, `.AppImage` x64, `Setup.exe`, `.nupkg`, portable `.zip`). macOS is published as a single **arm64** `.dmg` — the CI runner is Apple Silicon, and the built binary is `Mach-O 64-bit arm64` (measured on the published `clavis.dmg`). **There is no Intel (x86-64) macOS build, no universal binary, and no arm64 build for Linux or Windows.** The `.dmg` file name carries no architecture, unlike the other two platforms' assets, so the gap is not visible from the release page.

**What has been executed.** The **Linux** artifacts are exercised by the end-to-end suite on every push and on every release tag, against both the packager output and the AppImage, in two locales. The **Windows and macOS** artifacts are built and published, and **no test, no CI job and no user has run them** since the Electron 44 series began. The structural checks pass — the Windows binary is a valid PE32+ x86-64 executable, the macOS binary a valid Mach-O arm64 one, and the native Argon2 prebuild for each platform is present as a real PE DLL / Mach-O bundle — but "the file is the right shape" is not "the app runs".

**Why that matters, concretely.** `encryption.ts` loads the native Argon2 module lazily and **falls back to Node's scrypt** if it cannot be loaded. The fallback is silent apart from a log warning, and a drawer that records `argon2id` then **fails to unlock** with `KDF_UNAVAILABLE` rather than being decrypted with a different KDF — a deliberate fail-closed choice (SEC-01). A platform where the native module does not load is therefore a platform where drawers created elsewhere cannot be opened, and **nothing has run the Windows or macOS builds to establish whether that is the case**.

### 5. The password policy constrains length and shape, not entropy

The create-time policy is a **length-and-shape gate**: it constrains length, and below 20 characters it also constrains shape. It is **not an entropy check**. `Passw0rd!!!1` satisfies the composition branch today and has almost no guess resistance — the composition rule was never an entropy check either, so the passphrase branch does not make the worst password worse; it makes an existing weakness visible.

**Clavis ships no common-password blocklist.** There is no account, no server and no breach corpus to screen against, so a user can choose a password a dictionary already contains and nothing will stop them.

**What this means for whoever holds an exported `.clavis` file.** The attacker's cost is the key derivation, not the guess, and the derivation is the project's own: Argon2id at **2^18 KiB (256 MiB)**, roughly half a second per attempt. That bounds the attacker's **rate**, not the **number** of guesses:

- A dictionary hit costs one derivation.
- A composition-compliant human password falls in roughly 2^20–2^30 candidates — minutes of CPU, or a few hundred dollars of rented memory.
- A three-to-four word passphrase falls in roughly 2^33–2^44 — out of reach for that budget.

**The passphrase branch — 20 characters or more — is worth 10–20 bits of effective entropy against a realistic attacker, and it is the only part of the policy that does anything for this threat model. The 12-character floor buys almost nothing.**

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
