# Clavis Build Targets Guide

## Status Atual (Linux)

✅ **Linux .deb** — Gerado com sucesso (213MB)
- Localização: `release_artifacts/clavis_0.1.0~alpha_amd64.deb`
- Ferramenta: Electron Forge maker-deb
- Comando: `npm run make`

✅ **Linux AppImage** — FIXED 2026-09-02 (121M, `release_artifacts/Clavis-0.1.0-alpha.AppImage`)
- Ferramenta: electron-builder
- Comando: `npm run make:appimage`
- Fix: `electron-log` moved from `devDependencies` → `dependencies` (`package.json:100`); `build.files` cleaned; verified `asar list` 47 files, runtime `Clavis started` log. Previous `Cannot find module 'electron-log'` was due to `!**/node_modules/**` default exclusion negating the workaround.

⏸️ **Windows Portable** — Requer Windows ou Wine
- Ferramenta: electron-builder
- Comando: `npx electron-builder --win portable -p never`
- Nota: Cria `.exe` portable standalone

⏸️ **Windows NSIS Installer** — Requer Windows ou Wine
- Ferramenta: electron-builder
- Comando: `npx electron-builder --win nsis -p never`
- Nota: Cria instalador com wizard

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
| `Clavis-0.1.0-alpha.AppImage` | 121MB | Linux | ✅ Ready (FIXED 2026-09-02) |
| `Clavis-Portable-0.1.0-alpha.exe` | ~106MB | Windows | ⏸️ Build Windows |
| `Clavis-Setup-0.1.0-alpha.exe` | ~106MB | Windows | ⏸️ Build Windows |

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
   npm run make           # .deb ✅
   npm run make:appimage  # AppImage (if needed)
   ```

2. **Windows (on Windows machine)**:
   ```bash
   npm run build
   npm run make:windows   # Portable + NSIS
   ```

3. **GitHub Release**:
   Upload all 4 artifacts to GitHub Release v0.1.0-alpha

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
- Requires Windows or Wine/Proton
- NSIS requires Windows tools
- Alternative: Build in CI/CD (GitHub Actions, AppVeyor)

### ASAR Issues
- Package.json `files` must include all dist files
- Rebuild clears cache: `npm run clean && npm run build`
- Verify `dist/main/index.js` exists: `ls dist/main/index.js`

---

## Release Checklist

- [x] Version bumped to 0.1.0-alpha
- [x] Build tested and passing
- [x] Tests passing (51/51)
- [x] Linux .deb generated
- [x] Linux AppImage generated (121M, FIXED 2026-09-02, verified boot)
- [ ] Windows Portable generated
- [ ] Windows Installer generated
- [ ] All 4 artifacts uploaded to GitHub Release

---

**Build configuration is ready. Ready to generate cross-platform artifacts.**
