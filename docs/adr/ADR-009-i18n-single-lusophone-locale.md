# ADR 009: i18n — Single Lusophone Locale (pt-PT) + English

## Status
Accepted (2026-10-05). Supersedes ADR-003's locale model (the `pt-PT` → `pt-BR` → `en` fallback chain).

## Context
ADR-003 shipped three UI locales: `pt-PT`, `pt-BR` and `en`, selected by prefix-matching `navigator.language`. Two problems made that model wrong.

1. **It was only half implemented.** Nothing enforced dictionary parity, so keys added to `en` never reached the Portuguese dicts. The app advertised itself as multilingual while `CreditsModal` rendered hardcoded English prose ("About", "Cryptocurrency", "Buy me a coffee"), hardcoded Portuguese ("Nova versão disponível"), and an English `aria-label`, regardless of the system language. A real capture under a Portuguese system locale showed "Fechar" (translated) sitting next to an English body. ESLint could not catch it and neither could `tsc`; the renderer was not typechecked at all until P2.24.
2. **Three locales were more than the project wanted to maintain.** Every new string needed three translations, and the `pt-BR` column was Brazilian Portuguese that the owner does not want to ship.

The product decision: the app follows the **system** language, and there is exactly **one** Portuguese variant. Any Portuguese-speaking system gets **pt-PT**; everything else gets **English**. There is no in-app language selector.

## Decision
- **Two** UI locales only: `pt-PT` and `en`. The `pt-BR` dictionary is deleted, not merged — its values were Brazilian variants and promoting them would have corrupted the European wording.
- `detectLocale()` compares the **BCP-47 primary language subtag**, not a string prefix:
  ```ts
  const primarySubtag = lang.trim().replace(/_/g, '-').split('-')[0].toLowerCase();
  if (primarySubtag === 'pt') return 'pt-PT';
  return 'en';
  ```
  A prefix match was rejected because it is case-sensitive (`PT-br` fell through to English) and over-matches non-lusophone tags that merely start with those letters (`ptx`, `ptt`). Normalising to the primary subtag makes `pt`, `pt-PT`, `pt-PT-x-fonipa`, `pt-BR`, `pt-AO`, `pt-MZ`, `pt_BR` and `PT-br` all resolve to `pt-PT`, and everything else to `en`.
- `process.env.CI` still forces `en`, so the suite is deterministic regardless of the runner's locale.
- `t()` gained an optional `params` argument substituting `{token}` placeholders (needed by `msg.update_available`), leaving every existing single-argument call site behaviourally identical. A missing key still returns the key itself, and the params path cannot throw.
- `translations` is exported so tests can compare dictionaries.
- All remaining user-facing text is routed through `t()`: `CreditsModal`, `ErrorBoundary`, `SkeletonLoader` (its `aria-label` is screen-reader text). Data is not translated — crypto addresses, currency tickers, brand names, URLs, the author's name, console output and error dumps.
- **Guards, because the original bug was silent:**
  - `tests/i18n.test.ts` asserts exact key parity between `pt-PT` and `en`, a non-trivial key count so an empty dictionary cannot pass vacuously, and that `pt-BR` cannot reappear.
  - A routing test asserts every lusophone tag resolves to `pt-PT` and every non-lusophone or malformed tag to `en`.
  - A quarantine test scans `pt-PT` values for Brazilian-only markers (`senhas`, `aplicativo`, `Excluir`, `Salvar`, `Arquivo`, "Me pague um café") so they cannot creep back.
  - `tests/CreditsModal.test.tsx` selects the update link by `href` and asserts the label is translated per locale, so re-hardcoding a literal fails the suite.

## Consequences
- ADR-003's title and fallback chain are now historical; this ADR supersedes them rather than rewriting them.
- `src/main/ipc-handlers.ts` keeps an **independent** `getLocale()` for main-process error messages, reading `LANG`/`LC_ALL`/`LC_MESSAGES`. It already maps any `pt*` to Portuguese with European strings, so it is consistent with this decision today, but it is a second locale decision that can drift from `detectLocale()` and is worth unifying later.
- Docs that recorded the old chain (`docs/MILESTONES.md`, `PLANO.md`, `CHANGELOG.md`, audits) are left as history except where they describe current behaviour.
