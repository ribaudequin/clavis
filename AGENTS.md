# CRITICAL RULES - MUST FOLLOW

## SESSION START

- At the start of each session, read **only SUMMARY.md** first — it's the one-paragraph current-state summary, kept short for fast reading.
- Only read MEMORY.md, PLANO.md, TODO.md or `/MEMORY/HISTORY.md` **on demand**: when SUMMARY.md signals it's needed ("Read more if…"), when the requested task requires that context (e.g. technical decision → PLANO.md; task list → TODO.md), or when SUMMARY.md doesn't exist yet.
- If SUMMARY.md doesn't exist, warn the user and offer to create it (or read MEMORY.md/PLANO.md/TODO.md in full to generate it).

## QUICK COMMANDS

- `+date`: check the current system date and reply with it.
- `+memory`: update MEMORY.md with what was learned in the session.

## RESPONSES

- Keep responses concise and to the point - unless the user asks otherwise

## DOCUMENTATION LANGUAGE

- All technical documentation and notes (AGENTS.md, MEMORY.md, PLANO.md, TODO.md, SUMMARY.md, code comments, READMEs, changelogs, and any file under `/MEMORY/`) must be written in **English**, regardless of the language used in conversation with the user.
- This rule applies to files only. Direct communication with the user (chat replies) stays in the user's preferred language (European Portuguese, PT-PT), as set in their preferences.

## MEMORY AND SESSION

- Before compacting the session, update MEMORY.md first.
- When starting a new coding project, also create `PLANO.md` (initial project plan — goal, technical decisions, structure), `TODO.md` (milestones and progress), and `SUMMARY.md` (state summary, for fast reading).
- **PLANO.md is the fixed initial plan**: only edit it when an architecture/goal decision changes the project's original design. It is not a log — no per-session entries are appended.
- **Avoid duplication across files**: the detailed, dated history of what was implemented/fixed lives in MEMORY.md's "📋 Changelog" section (or in `/MEMORY/HISTORY.md` once partitioned). The "🪵 Recent Updates Log" records decisions/context that change the "current state" (e.g. stack change, user preference, new active project); the "📋 Changelog" records what was done, with a date.
- **SUMMARY.md must always stay up to date**: at the end of any session where the state changed (feature completed, new focus, version bump), update SUMMARY.md before finishing. Keep it to about a dozen lines — summarize, don't append.

## TODO.md SYNCHRONIZATION

- At the end of any session where something was implemented, fixed, or completed, update TODO.md before finishing: mark completed items with `[x]`, add newly discovered items, and update the "Progress" section (Done / Tested / Current focus).
- Never let TODO.md fall out of sync with MEMORY.md — if a milestone is marked done in MEMORY.md's "📋 Changelog", it must be checked `[x]` in TODO.md.
- End of session = update together, in order: MEMORY.md (changelog + log) → TODO.md (progress) → SUMMARY.md (summary). This order guarantees SUMMARY.md always reflects the latest state.

## MANAGING LARGE MEMORY FILES

- Concrete trigger: once MEMORY.md exceeds **150 lines**, or the "🪵 Recent Updates Log" or "📋 Changelog" section has **more than 10 entries**, partition immediately — don't wait for further growth.
- Partition into files under `/MEMORY/`, e.g. `/MEMORY/HISTORY.md` for the detailed historical log/changelog.
- When partitioning: move all entries to `/MEMORY/HISTORY.md` except the **3 most recent** per section, which stay in MEMORY.md. Leave a reference line in MEMORY.md, e.g. `Full history (older entries) in /MEMORY/HISTORY.md`.
- MEMORY.md must stay lean, holding only the **current context** (user profile, project rules, decisions, and current work focus).
- Other partitions may be created as the project grows, using the same 150-line trigger: `/MEMORY/GLOSSARY.md`, `/MEMORY/DECISIONS.md`, etc. — always indexed from MEMORY.md.

## PLANNING MODE

- Always ask clarifying questions
- Never assume design, tech stack or features
- Use deep-dive sub-agents to assist with research
- Use deep-dive sub-agents to review the different aspects of your plan before presenting to the user

## CHANGE / EDIT MODE

- Never implement features yourself when possible - use sub-agents!
- Identify changes from the plan that can be implemented in parallel, and use sub-agents to implement the features efficiently
- When using sub-agents to implement features, act as a coordinator only
- Use the best model for the task - premium models for complex tasks (like coding) and mid-tier models for simpler tasks, like documentation
- After completing features (large or small), always run commands like lint, type check and next build to check code quality

## DATABASE SCHEMA CHANGES

- Whenever you make changes to the database schema, ALWAYS run the drizzle generate and migrate commands
- NEVER run drizzle push!

## TESTING

- Use any testing tools, libraries available to the project for testing your changes
- Never assume your changes simply work, always test!
- If the project does not have any testing tools, scripts, MCP tools, skills, etc. available for testing, ask the user whether testing should be skipped.

## UI DESIGN

- Always follow the UI design system when creating or reviewing components or pages.
- Design System: @DESIGN.md
  <!-- Optional: if this project has no DESIGN.md, remove this line
       or delete the whole "UI DESIGN" section. Only applies to
       projects with visual UI components. -->
