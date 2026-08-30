# Assistant Long-Term Memory

> This file holds only the **current context**. If it grows too large, partition into `/MEMORY/*.md` and index it here.

## 🎯 User Profile and Preferences
- Name: Marcelo Salvador
- Location: Sines, Portugal
- Communication preferences:
  - For coding, writing, editing, or summarizing tasks: ask up to 4 clarifying questions before executing. Simple or conversational tasks → answer directly.
  - Language: European Portuguese (PT-PT)
- Technical level: intermediate / advanced
- Age: 46

## 🛠️ Project Scope Rules and Standards

## 📌 Decision History and Current Context
- **Active project:** Clavis — cross-platform encrypted notes app (Electron + TypeScript + React)
- **Tech decisions:**
  - Desktop: Electron 44 + TypeScript 5.8 + React 19
  - Encryption: AES-256-GCM + Argon2id (OWASP-recommended)
  - Build: Electron Forge + Vite (renderer compiled via tsc → dist/)
  - Data: encrypted `.clavis` JSON files in `~/.local/share/Clavis/drawers/`
  - Icons: deterministic 3×3 color grid from SHA-256 hash of drawer ID
  - Packaging: AppImage (Linux), NSIS+Portable (Windows), Flatpak (Linux)
- **Status:** Initial scaffolding complete. App launches successfully. Encryption tested (6/6 tests pass).

## 🪵 Recent Updates Log
- Added README.md with full docs and support/credits section (Ko-fi, ETH, SOL)
- Scaffolded full project structure: src/main (IPC, encryption, store), src/renderer (React+Tailwind pages)
- Implemented encryption module (src/main/encryption.ts) — AES-256-GCM + Argon2id
- Implemented drawer store (src/main/index.ts) — create/list/save/delete/export/import
- Created HomeScreen + CreateDrawerModal in src/renderer/pages/HomeScreen.tsx
- Verified TypeScript compiles cleanly (tsc) and ESLint passes
- Verified Electron app launches successfully (PID confirmed running)

## 📋 Changelog
- **[2026-08-30]** [Initial scaffolding] Electron + TypeScript + React project structure created, encryption module implemented and tested, drawer store implemented, Home Screen UI built, app launches successfully.

## 🛠️ Troubleshooting
- **[TypeScript 7 incompatibility]**: @typescript-eslint does not support TS 7.0 — downgraded to TypeScript 5.8.3
- **[ESLint v9 format]**: `.eslintrc.js` no longer supported — migrated to `eslint.config.js` (flat config)
- **[JSX namespace]**: React 19 uses `React.JSX.Element` instead of `JSX.Element`
- **[Electron preload path]**: Preload must be compiled to `dist/main/preload.js`, loaded via `path.join(__dirname, 'preload.js')`
- **[package.json main entry]**: Must point to `dist/main/index.js` after TypeScript compilation
