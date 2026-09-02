# Clavis Build Targets Guide

## Status Atual (Linux)

✅ **Linux .deb** — Gerado com sucesso (213MB)
- Localização: `release_artifacts/clavis_0.1.0~alpha_amd64.deb`
- Ferramenta: Electron Forge maker-deb
- Comando: `npm run make`

✅ **Linux AppImage** — FIXED 2026-09-02 (121M, `release_artifacts/Clavis-0.1.1-alpha.AppImage`)
- Ferramenta: electron-builder
- Comando: `npm run make:appimage`
- Fix: `electron-log` moved from `devDependencies` → `dependencies` (`package.json:100`); `build.files` cleaned; verified `asar list` 47 files, runtime `Clavis started` log. Previous `Cannot find module 'electron-log'` was due to `!**/node_modules/**` default exclusion negating the workaround.

✅ **Windows Portable** — Gerado com sucesso (96M, `release_artifacts/Clavis-Portable-0.1.1-alpha.exe`)
- Ferramenta: electron-builder + Wine 10
- Comando: `npx electron-builder --win portable -p never` (separado de nsis)
- Nota: Built 2026-09-02, ASAR 47 ficheiros `electron-log`, publicado no GitHub

✅ **Windows NSIS Installer** — Gerado com sucesso (96M, `release_artifacts/Clavis-Setup-0.1.1-alpha.exe`)
- Ferramenta: electron-builder + Wine 10
- Comando: `npx electron-builder --win nsis -p never` (separado de portable; combinado falha `ENOENT nsis.7z`)
- Nota: Built 2026-09-02, ASAR 47 ficheiros, publicado no GitHub

---

## Build Commands

### Build All (Linux)
```bash
npm run build        # TypeScript + Renderer
npm run make         # Linux .deb
npm run make:appimage # Linux AppImage (optional)
```

### Build All (Windows)
```bash
npm run build        # TypeScript + Renderer
npm run make:windows # Windows Portable + NSIS Installer
```

### Build All (All Platforms)
```bash
npm run release      # Everything (requires cross-platform env)
```

---

## Release Artifacts

Generated in `release_artifacts/`:

| Target | Size | Platform | Status |
|--------|------|----------|--------|
| `clavis_0.1.0~alpha_amd64.deb` | 213MB | Linux | ✅ Ready |
| `Clavis-0.1.1-alpha.AppImage` | 121MB | Linux | ✅ Ready (FIXED 2026-09-02) |
| `Clavis-Portable-0.1.1-alpha.exe` | 96M | Windows | ✅ Ready (2026-09-02, Wine 10) |
| `Clavis-Setup-0.1.1-alpha.exe` | 96M | Windows | ✅ Ready (2026-09-02, Wine 10) |

---

## Configuration

### Package.json Build Section
```json
{
  "build": {
    "appId": "com.github.ribaudequin.clavis",
    "productName": "Clavis",
    "directories": {
      "buildResources": "icons",
      "output": "release_artifacts"
    },
    "files": ["dist/**/*", "package.json"],
    "linux": {
      "target": ["AppImage"],
      "icon": "icons/linux/512x512.png"
    },
    "win": {
      "target": ["portable", "nsis"],
      "icon": "icons/windows/clavis.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

### Forge Config
Configured in `forge.config.ts` with:
- Squirrel (Windows installer)
- DEB (Linux package)

---

## Next Steps

1. **Linux (this machine)**:
    ```bash
    npm run build          # Clean build
    npm run make           # .deb ✅ 213M
    npm run make:appimage  # AppImage ✅ 121M (FIXED)
    ```

2. **Windows (via Wine 10 on Linux)**:
    ```bash
    npm run build
    npx electron-builder --win portable -p never  # Portable ✅ 96M (separado)
    npx electron-builder --win nsis -p never      # NSIS ✅ 96M (separado; combinado falha ENOENT nsis.7z)
    # ou: npm run make:windows (tenta ambos; se falhar, correr separados)
    ```

3. **GitHub Release (2026-09-02 16:48 UTC)**:
    `gh release upload v0.1.1-alpha release_artifacts/Clavis-*.AppImage release_artifacts/Clavis-*.exe release_artifacts/clavis_*.deb --clobber` — 4 assets substituídos, tag `v0.1.1-alpha` movida para `a038ea9`

---

## Troubleshooting

### AppImage Build Issues
- Ensure `dist/` is clean: `npm run clean`
- Rebuild: `npm run build`
- Try: `npm run make:appimage` with fresh build

### AppImage Runtime: Cannot find module 'electron-log' (FIXED 2026-09-02)
- **Symptom:** `Error: Cannot find module 'electron-log' Require stack: dist/main/logger.js` at AppImage launch.
- **Cause:** `electron-log` was in `devDependencies` (`package.json:85`) so electron-builder excluded it from ASAR. Workaround `build.files: ["node_modules/electron-log/**/*"]` was negated by default `!**/node_modules/**` in `release_artifacts/builder-debug.yml` — verified `npx asar list ... | grep electron-log` returned 0.
- **Fix:** Move `electron-log` to `dependencies` (`package.json:100`), set `build.files: ["dist/**/*","package.json"]` + `asarUnpack: ["**/node_modules/argon2/**/*"]`. Rebuild: `npm run build && npm run make:appimage`. Verify: `npx asar list release_artifacts/linux-unpacked/resources/app.asar | grep electron-log` should show 47 files; runtime log should contain `Clavis started`.
- **Prevention:** Never put runtime deps in `devDependencies`; `electron-builder` only packages `dependencies` by default. Do not rely on `files` to re-include dev deps.

### Windows Build Issues
- Requires Wine 10 (present on this machine). Combined `electron-builder --win portable nsis` fails with `ENOENT nsis.7z` — build separately.
- NSIS requires Wine + NSIS tooling (handled by electron-builder)
- Alternative: Build in CI/CD (GitHub Actions, AppVeyor)

### ASAR Issues
- Package.json `files` must include all dist files
- Rebuild clears cache: `npm run clean && npm run build`
- Verify `dist/main/index.js` exists: `ls dist/main/index.js`

---

## Release Checklist

- [x] Version bumped to 0.1.1-alpha
- [x] Build tested and passing
- [x] Tests passing (51/51)
- [x] Linux .deb generated
- [x] Linux AppImage generated (121M, FIXED 2026-09-02, verified boot)
- [x] Windows Portable generated (96M, Wine 10, 2026-09-02)
- [x] Windows Installer generated (96M, Wine 10, 2026-09-02)
- [x] All 4 artifacts uploaded to GitHub Release (replaced 16:48 UTC, `gh release upload --clobber`)

---

**All 4 targets built and published 2026-09-02 — v0.1.1-alpha on main/master/tag a038ea9.**
