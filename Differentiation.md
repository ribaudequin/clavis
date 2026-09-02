# Clavis — Differentiation & Long-Term Sustainability Strategy

> **Purpose**: Standalone strategic document expanding on the Post-Audit recommendations from `audits/audit_2026-08-30.md`.  
> **Audience**: Project maintainer (Marcelo) and potential contributors.  
> **Status**: Living document — update as decisions evolve.

---

## 1. Market Positioning & Differentiation

### 1.1 The Crowded Landscape

| Competitor | Strength | Weakness (Clavis Opportunity) |
|------------|----------|-------------------------------|
| **Obsidian** | Plugin ecosystem, graph view, massive community | Proprietary format, no native encryption, Electron bloat |
| **Standard Notes** | E2E encryption, cross-platform, open source | Subscription for advanced features, sync tied to their server |
| **Joplin** | Open source, sync flexibility (Nextcloud, WebDAV, S3), plugins | UI feels dated, sync conflicts, no deterministic offline identity |
| **Logseq** | Outliner-first, local-first, graph | Steep learning curve, not a traditional note-taker |
| **Notesnook** | E2E encryption, open source, beautiful UI | Newer, smaller ecosystem, sync service centralised |

### 1.2 Clavis's Unique Value Proposition (Draft)

> **"The offline-first encrypted notebook that you truly own — no accounts, no cloud, no lock-in. Your notes are portable `.clavis` files you can copy, backup, version-control, or move between devices like any other file."**

**Core Differentiators (ranked by uniqueness):**

| # | Differentiator | Why It Matters | Evidence in Codebase |
|---|----------------|----------------|----------------------|
| 1 | **Zero-dependency portability** | `.clavis` files are self-contained JSON with embedded crypto metadata. No database, no index, no external service. | `src/main/store.ts` — single-file per drawer |
| 2 | **Deterministic visual identity** | SHA-256 → 3×3 color grid = instant visual recognition without metadata. Works offline, no avatar upload. | `src/main/index.ts:21-31` (`generateIconData`) |
| 3 | **No account / no cloud by design** | Privacy-first users avoid cloud sync. Clavis embraces local-first explicitly. | Architecture decision (PLANO.md) |
| 4 | **Forward-compatible KDF params** | Argon2 parameters stored per-drawer → future re-derivation possible without migration scripts. | `src/main/encryption.ts:8-13`, `store.ts` |
| 5 | **Single binary, zero runtime deps** | AppImage / Portable .exe / NSIS — runs anywhere without install. | Electron Forge config |
| 6 | **Audit-friendly codebase** | Small (~2k LOC), typed IPC, 15 tests, clean separation. Security reviewers can actually read it. | This audit + 15 passing tests |

### 1.3 Positioning Statement (for README / Website)

> **Clavis is for people who:**
> - Want **true ownership** of their encrypted notes (files on disk, not rows in a DB)
> - Prefer **simplicity over features** — no plugins, no graph, no bloat
> - Work **offline-first** (air-gapped machines, travel, privacy contexts)
> - Value **auditability** — small, typed, tested codebase they can verify
> - Accept **manual sync** (Syncthing, rsync, USB, Git) as a feature, not a bug

> **Clavis is NOT for people who:**
> - Need real-time collaboration or shared notebooks
> - Want a plugin ecosystem or extensive customisation
> - Expect mobile apps today (roadmap only)
> - Require cloud sync with conflict resolution out of the box

---

## 2. Long-Term Sustainability Analysis

### 2.1 Technical Sustainability

| Factor | Current State | Risk | Mitigation |
|--------|---------------|------|------------|
| **Bus factor** | 1 (Marcelo) | 🔴 High | Document architecture (ADRs), write CONTRIBUTING.md, tag good-first-issues |
| **Dependency freshness** | Electron 44, React 19, TS 5.8 | 🟡 Medium | Quarterly `npm audit` + `npm outdated`; pinned major versions in package.json |
| **Native module risk** | `argon2` (native build) | 🟡 Medium | Test on all target arches (x64, arm64); consider fallback to pure-JS `argon2-browser` if needed |
| **Platform support** | Linux (AppImage, .deb), Windows (NSIS, Portable) | 🟢 Low | macOS build untested (no runner) — document limitation |
| **Test coverage** | 15 tests (encryption, store, components) | 🟢 Good | Add IPC integration tests, E2E with Playwright |

### 2.2 Operational Sustainability

| Activity | Frequency | Owner | Status |
|----------|-----------|-------|--------|
| Security dependency updates | Monthly | Marcelo | Manual (Dependabot PRs merged) |
| Electron version upgrades | Quarterly | Marcelo | Major version = breaking changes; test thoroughly |
| Release process | Per feature/bugfix | Marcelo | `npm run release` → tags + GitHub Release + binaries |
| Issue triage | Weekly | Marcelo | Labels: `bug`, `enhancement`, `good first issue`, `security` |
| Community response | Ad-hoc | Marcelo | No SLA — set expectations in README |

### 2.3 Financial Sustainability

| Cost Item | Annual Estimate | Funding Source | Decision |
|-----------|-----------------|----------------|----------|
| Code signing (Windows EV + macOS Developer ID) | €300–500/yr | **None** | **Intentionally omitted** — documented in audit |
| GitHub Actions minutes | Free (public repo) | GitHub | ✅ Covered |
| Domain / landing page | €10–15/yr | Personal | Optional |
| Flathub publishing | Free | Flathub | ✅ Free for open source |

**Verdict**: Project is **financially sustainable at zero cost** as long as code signing remains optional. If future funding appears (sponsors, grants), code signing becomes Priority 1.

---

## 3. Strategic Roadmap (Prioritised)

### Phase 0 — Foundation (Weeks 1–2) ✅ *Mostly Done*
- [x] Critical bugs fixed (IPC, path traversal, Tailwind, tests)
- [x] Security hardening (sandbox, CSP, file perms, password policy)
- [x] Unlock UI flow (password modal + view/edit screen)
- [x] Store extraction + forward-compat KDF
- [x] 15/15 tests, clean lint/tsc, 4 package targets building

### Phase 1 — Distribution & Retention (Weeks 3–6)
| Task | Effort | Impact | Notes |
|------|--------|--------|-------|
| Auto-updater (`electron-updater` + GitHub Releases) | Medium | 🔴 Critical | Enables security patch delivery |
| Flatpak manifest + Flathub submission | Low | 🟡 High | Linux discoverability |
| Windows install docs (SmartScreen bypass) | Low | 🟡 High | Reduces support friction |
| `.deb` package in GitHub Releases | Low | 🟢 Medium | Already building — just attach |

### Phase 2 — UX Polish & Accessibility (Weeks 7–10)
| Task | Effort | Impact | Notes |
|------|--------|--------|-------|
| Empty state + skeleton loaders | Low | 🟡 High | First-run experience |
| Keyboard shortcuts (Cmd/Ctrl+N, E, Esc) | Low | 🟡 High | Power user retention |
| ARIA + focus management in modals | Medium | 🟢 Medium | Accessibility compliance |
| Theme color + native titlebar (done) | ✅ Done | — | v0.0.3 |

### Phase 3 — Community & Contributors (Weeks 11–14)
| Task | Effort | Impact | Notes |
|------|--------|--------|-------|
| CONTRIBUTING.md + code of conduct | Low | 🟢 Medium | Lowers contributor barrier |
| Good First Issues (3–5 tagged) | Low | 🟢 Medium | First PRs |
| Issue templates (bug/feature/security) | Low | 🟢 Low | Triage efficiency |
| ADR folder (`docs/adr/`) | Low | 🟢 Medium | Decision history |

### Phase 4 — Strategic Decisions (Month 4+)
| Decision | Options | Recommended | Rationale |
|----------|---------|-------------|-----------|
| **Mobile strategy** | Capacitor / PWA / React Native / None | **None for v1** | Focus desktop excellence first; document explicitly |
| **Sync protocol** | CRDT (Automerge/Yjs) / Last-write-wins / Git-based | **Design doc first** | Don't implement until UX clear; conflict resolution is hard |
| **Plugin system** | None / Internal API / WebExtensions | **None** | Scope creep risk; differentiator is simplicity |
| **Monetisation** | Donations / Sponsors / Pro features / None | **Donations only (Ko-fi)** | Aligns with open source ethos; no feature gating |

---

## 4. Success Metrics (Leading Indicators)

| Metric | Target (6 months) | Tool |
|--------|-------------------|------|
| GitHub stars | 100+ | GitHub |
| Flathub downloads | 500+ | Flathub stats |
| Contributors (non-author) | 3+ | GitHub insights |
| Issues closed / opened ratio | > 0.8 | GitHub |
| Release frequency | Monthly | GitHub Releases |
| Test coverage | > 80% (lines) | Vitest + c8 |
| Security advisories | 0 critical | GitHub Dependabot + manual audit |

---

## 5. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Electron major version breaks API** | High (annual) | High | Pin Electron in `package.json`; test beta channels; allocate 1 week/quarter for upgrade |
| **Argon2 native build fails on new Node** | Medium | Medium | CI matrix: test Node LTS + Current; consider `argon2-browser` fallback |
| **Zero contributors ever** | High | Medium | Acceptable for personal tool; document for solo maintainability |
| **User loses password = data loss** | Certain (by design) | High | **Document prominently**: "No recovery. No backdoor. Backup your password." |
| **macOS notarisation required for distribution** | Medium (Apple policy) | High | Budget for Developer ID if macOS users materialise; otherwise "download from GitHub, right-click → Open" |

---

## 6. Decision Log (Key Strategic Choices)

| Date | Decision | Rationale | Revisit Trigger |
|------|----------|-----------|-----------------|
| 2026-08-30 | **No code signing** | EV cert cost unjustified for unfunded OSS | Sponsor appears / macOS user demand > 100 |
| 2026-08-30 | **English-only UI** | Avoids i18n complexity; technical audience speaks EN | Community requests PT-PT/PT-BR + contributor for translation |
| 2026-08-30 | **No cloud sync** | Core differentiator = local-first ownership | User research shows demand + contributor for sync engine |
| 2026-08-30 | **Flatpak over Snap** | Flathub larger audience; distro-agnostic | Snap store policy changes |
| 2026-08-30 | **AppImage + Portable + NSIS only** | Covers 95% desktop users; no dmg/pkg (no macOS runner) | macOS runner available (GitHub Actions macOS-latest) |

---

## 7. Appendix: Competitor Comparison Matrix (Detailed)

| Feature | Clavis | Obsidian | Standard Notes | Joplin | Logseq |
|---------|--------|----------|----------------|--------|--------|
| **License** | MIT | Proprietary | AGPL-3.0 | MIT | AGPL-3.0 |
| **Encryption** | AES-256-GCM + Argon2id (local) | None (plugin only) | AES-256-GCM (E2E) | AES-256-CBC (optional) | None |
| **File Format** | `.clavis` (JSON + crypto) | `.md` (plain) | Proprietary (SQLite) | `.md` + SQLite | `.md` + EDN |
| **Sync** | Manual (user-managed) | Paid (Obsidian Sync) | Built-in (their server) | WebDAV/Nextcloud/S3 | Git / paid sync |
| **Mobile** | ❌ Planned | ✅ iOS/Android | ✅ iOS/Android | ✅ iOS/Android | ✅ iOS/Android |
| **Plugins** | ❌ No | ✅ 1000+ | ⚠️ Limited (paid) | ✅ 100+ | ⚠️ Limited |
| **Graph View** | ❌ No | ✅ Core feature | ❌ No | ❌ No | ✅ Core feature |
| **Outliner** | ❌ No | ⚠️ Plugin | ❌ No | ❌ No | ✅ Core feature |
| **Offline-First** | ✅ By design | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Auditability** | ✅ Small codebase | ❌ Closed source | ✅ Open | ✅ Open | ✅ Open |
| **Price** | Free | Free / $8/mo sync | Free / $10/yr pro | Free | Free / $10/mo sync |

---

## 8. Next Actions for Marcelo

1. **Review & approve** this differentiation strategy — adjust positioning if needed
2. **Pick Phase 1 task** to start (auto-updater recommended as highest impact)
3. **Create GitHub Issues** for Phases 1–3 with labels and milestones
4. **Publish v0.0.4** with auto-updater + Flatpak as first "post-audit" release
5. **Add this file to repo** as `docs/Differentiation.md` (or keep in `.github/` for internal use)

---

*Generated: 2026-08-31*  
*Based on audit findings from `audits/audit_2026-08-30.md` and strategic analysis by Hermes Agent.*  
*This document reflects the maintainer's intent for an unfunded, open-source, privacy-first desktop application.*