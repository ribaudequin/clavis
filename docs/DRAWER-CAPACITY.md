# How much text fits in a drawer

A short, factual reference for Clavis's storage limits. Every number here is traceable to a
constant in the source; the file-size figures were measured, not estimated.

> ⚠️ **Partially fixed (2026-10-16, commit `ff4efb7`).** The save path (`encrypt()` guard + `SaveDrawerSchema`) and the unlock path (`store.ts:271`) still measure different things — **code points** vs **UTF-8 bytes** — so non-ASCII text above ~10 MB of UTF-8 is refused at save (`SAV-03`) and reported correctly (`SAV-02`: `{ok:false,reason:'content_too_large'}` or `'too_large'`). Import (`SAV-01`) and all reads (`Block B`) now check `stat.size` / ciphertext length. The Zod `.max()` limit remains 10 M code points; the practical ceiling for accented Portuguese stays at ~9.1 M characters. See `TODO.md` SAV-01…SAV-06.

---

## The short version

| | |
|---|---|
| **Text you can save in a drawer** | **10 M code points** — ~9.1 M characters of accented Portuguese, ~2.7 M emoji |
| **Text you can open again** | **10 MB of UTF-8** — *a different number*, see below |
| **Text that survives an export → import round trip** | the same 10 M code points, but the round trip completing does **not** mean it reopens |
| **Size of the resulting `.clavis` file** | **2× the text**, because the payload is stored as hex |
| **Where these limits are enforced** | four places, all in `src/main`, in **three different units** |
| **Limit shown to the user** | none — and the refusal that does arrive says "Incorrect password" |

---

## The three limits

They are separate checks in separate places, and they do not all measure the same thing.

| Limit | Value | Where | Measures |
|---|---|---|---|
| Content on save | `10_000_000` code points (`validation.ts`) | **code points** (Zod 4.5.4) — `encrypt()` now throws `ContentTooLargeError` (`SAV-03`) |
| Ciphertext on unlock | `10_000_000` bytes (`store.ts`) | **bytes** — checked before `decrypt()` (`SAV-01`) |
| Decrypted content | `10_000_000` bytes (`encryption.ts`) | **bytes** — `decrypt()` enforces it; unreachable through the app (`SAV-01`) |
| Imported `.clavis` file | `20_004_096` chars (`store.ts`) | **characters of JSON** — derived (`MAX_DECRYPTED_SIZE * 2 + 4_096`) + `ABSOLUTE_IMPORT_CEILING` (`A4`) |
| Import ciphertext | floor(`len/2`) > `MAX_DECRYPTED_SIZE` (`store.ts:593`) | **bytes** of decoded ciphertext (`SAV-01`) |

**Fixed in code, not in the unit.** `unlockDrawer()` returns a typed `{ok:false,reason}` (`SAV-02`), `encrypt()` rejects oversized content (`SAV-03`), `importDrawerRaw()` rejects oversized ciphertext (`SAV-01`), and all read paths (`Block B`) use `stat.size` before allocating. The gap between code-point and byte counting remains by design — the fix is that an oversized drawer is refused clearly, not silently.

> ⚠️ **Until that is fixed, "10 MB" below means two different numbers depending on which check you
> are asking about.** For ASCII they coincide at 10 000 000. For anything else they do not.

The third is not an independent number: it is derived from the second as
`MAX_DECRYPTED_SIZE * 2 + 4_096`, because hex doubles the payload. See
[Why the import cap is derived](#why-the-import-cap-is-derived).

**There is no limit in the renderer.** No `maxLength` attribute exists anywhere under
`src/renderer/`. The textarea accepts whatever is pasted into it, and the refusal arrives
asynchronously from the main process with the message `Content too large (max 10MB)`.

**This is a denial-of-service guard, not a product limit.** It exists so that a hostile or
corrupt `.clavis` cannot make the main process allocate gigabytes — a real concern, since the
legacy migration path copies any `*.clavis` it finds with no size check at all.

But "nobody reaches 10 MB by accident" was the assumption that produced SAV-01, and it is false.
A user pasting a long document, or writing ordinary accented Portuguese at length, crosses the byte
ceiling without noticing anything, because the only feedback is a message about the wrong problem.

---

## What 10 MB means in practice

There are **two** ceilings and they are not the same number. The save schema allows 10 M **code
points**; the unlock guard allows 10 M **UTF-8 bytes**. Anything in between is accepted on save and
refused on open — it is written to disk and becomes unreadable.

| Content | Bytes per code point | Saves up to | **Stays openable up to** | Gap that bricks |
|---|---|---|---|---|
| English (ASCII) | 1.00 | 10.0 M chars | 10.0 M chars | none — the two coincide |
| **Portuguese with accents** | ~1.10 | 10.0 M chars | **~9.1 M chars** | 9.1 M – 10 M chars |
| Portuguese without accents | 1.00 | 10.0 M chars | 10.0 M chars | none |
| Chinese / Japanese / Korean | 3.00 | 10.0 M chars | 3.3 M chars | 3.3 M – 10 M chars |
| Emoji-heavy text | ~3.70 | 10.0 M chars | 2.7 M chars | 2.7 M – 10 M chars |

**Portuguese is not safe at the ceiling it advertises.** At ~1.10 bytes per character, a note of
10 M accented characters is 11 MB of UTF-8 — it saves and then refuses to open. The honest number
to plan around for accented Portuguese is **~9.1 M characters**, not 10 M.

Verified minimum trigger — one code point past the byte ceiling, no attacker:

| Input | Code points (schema) | UTF-8 bytes (guard) | Saves | Opens |
|---|---|---|---|---|
| `'x'.repeat(9_999_998) + '😀'` | 9 999 999 | **10 000 002** | yes | **no** |
| `'ã'.repeat(10_000_000)` | 10 000 000 | **20 000 000** | yes | **no** |
| `'x'.repeat(10_000_000)` | 10 000 000 | 10 000 000 | yes | yes |

At roughly 250 words per page and 90 000 words per novel, a full drawer holds **about 18
novels** of Portuguese prose — measured against the 9.1 M openable figure, not the 10 M
advertised one.

---

## Why the file on disk is twice the size of the text

`encrypt()` returns the ciphertext as a **hex** string (`src/main/encryption.ts:122`), and hex
encoding costs two characters per byte — a 100% expansion. The envelope around it adds **393
characters** for a short title, rising to 1 922 in the worst case: the id, title, timestamps, icon
data, the salt (32 hex chars), iv (32) and auth tag (32), the Argon2id parameters, and the 2-space
indentation of `JSON.stringify(drawer, null, 2)`. See
[Why 4 096 characters of envelope](#why-4-096-characters-of-envelope).

At the import cap of 20 004 096 characters, the largest payload that fits is
`20 004 096 − 393 = 20 003 703` hex characters, i.e. **10 001 851 bytes** — slightly *above*
`MAX_DECRYPTED_SIZE`, so the derived cap is not the binding constraint on save.

| Text | `.clavis` on disk | Passes the import cap? |
|---|---|---|
| 1 MB | 2.00 MB | yes |
| 5.5 MB | 11.00 MB | yes — this was the old cap's ceiling, and it failed |
| 10 MB | 20.00 MB | yes, with 3 703 characters to spare |

Note that the title, timestamps and icon colour data in that envelope are **plaintext** — they are
not encrypted. A drawer with a sensitive name discloses that name to anyone who can read the file.

---

## Why the import cap is derived

> **Partly closed, and the part that is still open is the dangerous one.** A drawer holding the
> maximum 10 MB of **ASCII** text can be created, unlocked, edited, exported and imported back.
> For any non-ASCII content the round trip *also* succeeds — and that is the problem, not the
> comfort. The export, the delete and the import all work, so the user's backup looks healthy,
> while the drawer itself cannot be opened. A round trip that completes is not a round trip that
> preserves anything.

Importantly, the failure is **not** caught at import either: `importDrawerRaw()` checks that
`encryptedData` is present and a string (`store.ts:419`) but never checks its length, so an
oversized drawer imports cleanly and appears in the drawer list under its plaintext title. See
SAV-04 in `TODO.md`.

`importDrawerRaw()` caps the **file** at `20_004_096` characters, and that number is no longer
typed by hand. It is computed from the limit that decides what may be saved in the first place:

```ts
const IMPORT_ENVELOPE_OVERHEAD = 4_096;
const MAX_IMPORT_FILE_SIZE = MAX_DECRYPTED_SIZE * 2 + IMPORT_ENVELOPE_OVERHEAD;
```

Two constants cannot drift apart if only one of them exists. This is not cosmetic: the cap used to
be an independent `11_000_000` whose own comment read

```ts
const MAX_IMPORT_FILE_SIZE = 11_000_000; // ~11MB; slightly above MAX_DECRYPTED_SIZE (10MB) to allow JSON overhead
```

"slightly above" is the arithmetic of base64, not of hex. Measured against hex's factor of two,
the cap landed at `N ≤ 5 499_700` bytes: anything above 5.5 MB exported cleanly and then failed to
import with a generic size error, with nothing warning the user. The comment documented an intent
the implementation did not meet.

The storage format is unchanged. Moving the payload from hex to base64 would have halved every
file, but it rewrites the on-disk form of every existing drawer, and the content is
irreversibly encrypted — a bad migration means permanent data loss. Raising the cap was the safe
direction.

**Why 4 096 characters of envelope.** The overhead is not free-form: it must cover every field of
the envelope `store.ts` writes, which is serialised with `JSON.stringify(drawer, null, 2)` — the
2-space indentation is part of the cost.

Measured against the exact shape `store.ts` writes, payload held constant at 1 000 000 characters
and subtracted:

| Title | Envelope |
|---|---|
| 1 character | **393** |
| 255 ASCII characters | **647** |
| 255 emoji (astral, so 510 UTF-16 units) | **902** |
| 255 × `U+0001` (escapes to `\u0001`, 6 chars each) | **1 922** |

**[corrected]** this section previously claimed "~560 for a short title, rising to ~815" and a
worst case of "~1 100". All three were wrong — measured, they are **393…1 922**. The earlier
reasoning also assumed Zod caps the title in UTF-16 code units; it caps **code points**, so a
255-emoji title passes Zod and costs 510 code units in `fileContent.length`.

The allowance still holds, but with less room than previously stated: 4 096 leaves **2 174
characters** of headroom over the 1 922 worst case, about **1.1×** — not the "roughly 3×" this
document used to claim. `iconData` is generated from the drawer id rather than supplied by the
user, so it does not scale with anything the user controls.

**The unlock path has its own, separate bound.** `unlockDrawer()` refuses ciphertext longer than
`MAX_DECRYPTED_SIZE` before attempting decryption. That is a count of decoded **bytes**, not file
characters, and AES-GCM ciphertext is exactly as long as its plaintext — so `MAX_DECRYPTED_SIZE`,
the same limit `decrypt()` enforces on the output, is also the longest ciphertext any drawer
Clavis writes can carry. It was once compared against `MAX_IMPORT_FILE_SIZE`, which counted
characters of a different artifact and sat so far above every legitimate payload that the guard
could never fire.

**This guard returns a bare `null`.** `unlockDrawer` has six distinct `null` returns — wrong
password, missing file, corrupt JSON, out-of-bounds KDF, oversized ciphertext, decryption failure —
and they are indistinguishable to the caller. An oversized drawer is therefore reported to the user
as **"Incorrect password or drawer not found"**, and the attempt increments the rate limiter, so
retrying with the correct password walks into the lockout. The message is not merely imprecise; it
actively misdirects. A typed reason instead of `null` is the only thing that can rescue drawers
already in this state — see SAV-02 in `TODO.md`.

Because this guard runs before `decrypt()`, the byte cap inside `decrypt()` (`encryption.ts:149`) is
**unreachable through the application**. It survives only because `tests/encryption.test.ts` calls
`decrypt()` directly. Any analysis that blames `decrypt()` for the refusal is looking at the wrong
line.

---

## Practical guidance

- For everyday notes, **10 MB is far more than enough** — about 6 600 pages of Portuguese.
- **Do not plan around 10 MB of non-ASCII text.** The save schema counts code points and the unlock
  guard counts bytes, so accented Portuguese starts failing to open above ~9.1 M characters and
  fails much earlier in CJK or emoji-heavy text. Unfixed — SAV-01…SAV-06.
- A successful export → import round trip does **not** prove a drawer is recoverable. Oversized
  drawers export and import successfully and still cannot be opened.
- A `.clavis` file at the limit is about **twice** the text: budget 20 MB of disk or backup space
  for a 10 MB drawer.
- A drawer at the limit is slow to unlock: Argon2id at 2^18 KiB dominates the wall time, not the
  content size.
- Losing a password is unrecoverable regardless of size — the key is derived from the password
  alone. Back up anything you cannot rewrite.

## Related

- [SECURITY.md](../SECURITY.md) — the full security model, including the export metadata exposure
- `src/main/validation.ts`, `src/main/encryption.ts`, `src/main/store.ts` — the constants above