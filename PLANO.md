# PLAN — Clavis

Encrypted notes desktop application (passwords, PINs, bank data, safe codes) organized in "drawers" — each encrypted with its own unique password (or optional global password).

## Goal
- Cross-platform encrypted notes app for sensitive data (bank details, PINs, passwords, safe codes, door codes).
- Organize data in "drawers" — each drawer has its own unique password (or optional global password).
- Easy backup of encrypted data — export/import drawer files securely.

## Decisions
- **Desktop Stack**: Electron + TypeScript — proven multi-platform tooling, good packaging story for AppImage / Windows (NSIS + Portable) / Flatpak.
- **Frontend**: React + Tailwind CSS (consistent with Electron ecosystem, fast UI iteration).
- **Encryption**: AES-256-GCM per drawer; key derivation via **Argon2id** (memory-hard, OWASP-recommended).
- **Global vs Per-Drawer Password**: Support both — a global master password (optional) unlocks all drawers; otherwise each drawer has its own password. Stored metadata (titles, icons) is unencrypted; only drawer content is encrypted.
- **Persistence**: Drawers stored as encrypted JSON files (`*.clavis`) in a user-data directory (`~/.local/share/Clavis` on Linux). Icons generated deterministically from a hash of the drawer title.
- **Packaging**: Electron Forge — multi-platform builds (AppImage, NSIS, Portable, Flatpak manifest).
- **Versioning**: `A.B.C.D` — A=major (upgrade), B=feature, C=bugfix (resets B), D=code (resets C).

## Structure
```
clavis/
├── AGENTS.md
├── MEMORY.md
├── PLANO.md
├── TODO.md
├── SUMMARY.md
├── wireframes/          # Existing: images + markdown wireframes
├── package.json
├── tsconfig.json
├── forge.config.ts       # Electron Forge
├── src/
│   ├── main/             # Electron main process
│   │   ├── encryption.ts  # AES-256-GCM + Argon2id
│   │   ├── store.ts       # Drawer file management
│   │   └── index.ts       # Main process entry
│   ├── renderer/         # React frontend
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom hooks
│   │   └── pages/        # Screens (home, create, view)
│   └── shared/           # Types, constants
├── assets/              # Icons
├── tests/               # Jest / Playwright tests
└── releases/            # Build outputs
```

## 🛡️ Backup and Remote
- Remote configured: No (local-first app)
- Backup: Manual export of encrypted `.clavis` files (drag-out / drag-in import). Each drawer is self-contained.

## References
- Wireframe docs: see `wireframes/` directory for full specs.