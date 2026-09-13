# ADR 005: Auto-Update — electron-updater + GitHub Releases

## Status
Implemented (`v0.1+` placeholder activated in `v0.1.0-alpha`; `v0.1.9.1-alpha` confirmed working).

## Context
Cross-platform release pipeline uses GitHub Actions (`release.yml`) to publish artifacts (`.AppImage`, `.deb`, `.rpm`, `.zip`, `.exe`) to GitHub Releases.

## Decision
- Use `electron-updater` with GitHub provider (`provider: 'github'`, `owner: 'ribaudequin'`, `repo: 'clavis'`).
- Feed URL configured in `main/index.ts` (`autoUpdater.setFeedURL`); guarded by `if (app.isPackaged)`.
- `checkForUpdatesAndNotify()` called at startup (packaged builds only).
- `latest.yml` file (BS-06) pending; Flatpak manifest references `AppImage` version (`v0.3.1-alpha`).

## Consequences
- Users receive update notifications when a new tag (`vX.Y.Z-alpha`) is pushed.
- No manual download required for updates.
- `latest.yml` must be updated per release (manual step; can be scripted later).
