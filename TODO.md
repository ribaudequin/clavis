# TODO — Clavis

## Milestones
- [x] Scaffold Electron + TypeScript + React project (package.json, tsconfig, eslint, vite)
- [x] Encryption module: AES-256-GCM + Argon2id key derivation (6 unit tests passing)
- [x] Drawer store: create/list/save/delete/export/import encrypted `.claxis` files
- [x] Icon generator: deterministic 3×3 grid from drawer hash
- [x] Main process: IPC bridge between renderer and store
- [x] Renderer: Home screen — list drawers with icons, create modal
- [ ] Renderer: View drawer screen (title edit, content edit, save, delete)
- [ ] Wire up Electron Forge + Vite plugin for dev/build
- [ ] Packaging: AppImage build (Linux)
- [ ] Packaging: NSIS + Portable installer (Windows)
- [ ] Packaging: Flatpak manifest
- [x] Tests: encryption round-trip, drawer CRUD
- [x] README + user docs
- [ ] Support/Credits section in README (Ko-fi, ETH, SOL)

## 🔨 Next Steps
- [ ] Configure Electron Forge + Vite plugin
- [ ] Verify app launches and main window renders
- [ ] Implement View/Edit drawer workflow (open → decrypt → render textarea)

## Progress
- **Done**: Project scaffolding, encryption, drawer store, home UI, create modal, encryption tests
- **Tested**: Encryption round-trip, same-key derivation, wrong-password rejection
- **Current focus**: Electron Forge + Vite integration to launch and test the full app
