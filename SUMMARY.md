# SUMMARY — Current State (1 paragraph)

> Always read at session start. Keep this to about a dozen lines — if it grows, summarize. The other files (MEMORY.md, PLANO.md, TODO.md, /MEMORY/HISTORY.md) are only read when this summary signals more context is needed.

**Project:** Clavis — cross-platform encrypted notes app (passwords, PINs, bank data, safe codes) using "drawers" (each with its own password or optional global password).

**Current version:** 0.0.0-alpha.

**State:** Scaffolding complete and **app launches successfully**. Encryption module (AES-256-GCM + Argon2id) implemented and tested (6/6 unit tests passing). Full drawer CRUD + IPC bridge implemented. Home screen + Create Modal UI working. TypeScript compiles, ESLint passes clean. Known toolchain issues resolved (TS downgrade, ESLint flat config migration, JSX namespace fix).

**Focus this phase:** Implement View/Edit drawer screen (open → decrypt → render textarea → save), refine UI styling per wireframes, prepare packaging configs.

**Read more if:** technical details → PLANO.md | task list → TODO.md | wireframes → wireframes/README.md

_Last updated: 2026-08-30_
