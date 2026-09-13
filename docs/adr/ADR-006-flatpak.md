# ADR 006: Flatpak Manifest — Flatpak Flathub

## Status
Implemented (`v0.2.0-alpha` manifest updated; `v0.3.1-alpha` reference included). Pending Flathub publish.

## Context
Linux packaging targets: `.deb`, `.AppImage`, `.rpm`, Flatpak (`com.github.marcelosalvador.Clavis`). Flatpak manifest (`flatpak/com.github.marcelosalvador.Clavis.yaml`) requires version parameterization.

## Decision
- Keep Flatpak manifest in repo (`flatpak/` directory).
- Reference `AppImage` artifact for build source (version injected via manifest parameter or script).
- E2E Playwright reference (`tests/e2e/playwright.config.ts`) included in manifest for CI validation.
- Flatpak Flathub publish deferred (`P2` build blocker) until `latest.yml` (BS-06) and CI build validation confirmed.

## Consequences
- Manifest updated for `v0.3.1-alpha` (`AppImage` 245M validated).
- No Flatpak build job in CI (`P2.17` deferred); local `npm run make` sufficient.
- When Flathub publish is activated, manifest must reference correct `AppImage` tag.
