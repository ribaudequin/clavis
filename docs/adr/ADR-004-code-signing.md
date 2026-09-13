# ADR 004: Code Signing — Deliberately Skipped

## Status
Accepted (2026-09-03). Confirmed in `v0.3.2-alpha`.

## Context
EV code signing certificates cost ~$200–500/year. Project is open-source (MIT License) and distributed via GitHub Releases (AppImage, `.deb`, `.rpm`, Portable `.zip`, NSIS `.exe`).

## Decision
- **Skip EV certificates** and Apple notarization.
- Document unsigned status in `README.md` and `SECURITY.md`.
- Users accept Gatekeeper (macOS) / SmartScreen (Windows) warnings on first launch.
- Build artifacts validated locally (`AppImage` 245M, `PE32+` verified) before any tag push.

## Consequences
- No annual certificate cost.
- First-launch warnings expected; no blocking by OS security policies after user acceptance.
- If project reaches commercial scale (`v1.0+`), revisit (`P1.4` deferred in `TODO.md`).
