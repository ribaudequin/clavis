# ADR 001: Desktop Stack — Electron + TypeScript

## Status
Accepted (2026-09-03). Implemented in `v0.1.0-alpha`.

## Context
Cross-platform desktop application requiring native packaging (AppImage, NSIS, Portable, Flatpak), secure encryption integration (AES-256-GCM + Argon2id), and a modern UI framework.

## Decision
Use **Electron + TypeScript** for the main process and renderer. React + Tailwind CSS for the frontend. Electron Forge as the single build system (electron-builder removed in `v0.1.7-alpha`).

## Consequences
- Multi-platform builds validated (`npm run make` produces `.deb`, `.AppImage`, `.rpm`).
- TypeScript ensures type safety across main/renderer boundary (IPC types in `src/shared/`).
- CommonJS preserved for main runtime; `.mts` for config files (`forge.config.mts`, `vite.config.mts`).
