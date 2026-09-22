# Plan — Créditos e apoio Modal Redesign

**Date:** 2026-09-22  
**Scope:** `src/renderer/pages/HomeScreen.tsx` (lines 335–424) — inline Credits modal  
**Goal:** Transform the modal into a professional, aesthetically polished, guideline-compliant UI component.

---

## Current Issues Audit

### Visual Design
| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | No box shadow on modal card — floats flat against backdrop | High | `HomeScreen.tsx:343` |
| 2 | Backdrop uses legacy `bg-opacity-50` instead of `bg-black/50` | Low | `HomeScreen.tsx:338` |
| 3 | No `shadow-xl` / `shadow-2xl` for depth | High | `HomeScreen.tsx:343` |
| 4 | No `overscroll-behavior: contain` on modal | Medium | `HomeScreen.tsx:343` |
| 5 | Close button at bottom-right instead of top-right corner | Medium | `HomeScreen.tsx:414-420` |
| 6 | No animation/transition on modal open/close | Medium | `HomeScreen.tsx:335-424` |
| 7 | No backdrop click-to-close | Medium | `HomeScreen.tsx:335-424` |

### Typography
| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 8 | `text-md` is invalid Tailwind class (should be `text-base`) | High | `HomeScreen.tsx:370,378` |
| 9 | No `text-pretty` on heading (widow risk) | Low | `HomeScreen.tsx:345` |
| 10 | No visual weight contrast between body and headings | Medium | `HomeScreen.tsx:358-411` |

### Section Grouping & Hierarchy
| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 11 | No visual card/panel treatment for sections (Credits, Support) | High | `HomeScreen.tsx:369-409` |
| 12 | No icons or visual cues for section headers | Medium | `HomeScreen.tsx:370,378` |
| 13 | Crypto addresses displayed as raw text with minimal styling | Medium | `HomeScreen.tsx:388-389` |
| 14 | Support links section lacks visual grouping | Medium | `HomeScreen.tsx:391-408` |
| 15 | "From Portugal, with love" footer minimal — no accent color | Low | `HomeScreen.tsx:411` |

### Accessibility & Guidelines
| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 16 | Close button missing `focus-visible` styling (CSS has `* { outline: none }`) | High | `HomeScreen.tsx:346-355` |
| 17 | No `focus-visible:ring` on support link buttons | Medium | `HomeScreen.tsx:391-408` |
| 18 | No `prefers-reduced-motion` for animations | Medium | TBD (animation phase) |
| 19 | Crypto `<code>` blocks lack `translate="no"` (i18n guideline) | Medium | `HomeScreen.tsx:388-389` |

### UX Polish
| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 20 | No copy-to-clipboard for crypto addresses | High | `HomeScreen.tsx:388-389` |
| 21 | Modal width fixed at `480px` — no responsive breakpoint | Medium | `HomeScreen.tsx:343` |
| 22 | Scrollbar unstyled in `overflow-y-auto` container | Low | `HomeScreen.tsx:343` |

---

## Implementation Plan

### Phase 1 — Structure & Container (High Priority)

**1.1 — Modal container upgrade**
- Change `bg-white rounded-lg p-6 w-[480px]` → `bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto overscroll-behave-contain`
- Add responsive: `max-w-md` instead of fixed `w-[480px]`
- Add custom scrollbar styling via Tailwind or CSS

**1.2 — Backdrop modernization**
- `bg-black bg-opacity-50` → `bg-black/50 backdrop-blur-sm`
- Add `transition-opacity` for smooth backdrop fade

**1.3 — Close button reposition & polish**
- Move close button to top-right (absolute positioning within header)
- Add `focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded`
- Replace inline SVG with `XIcon` via `vite-plugin-svgr` (consistency — P2.16 in TODO.md)
- Add `p-2 hover:bg-gray-100 rounded-lg` for better touch target

### Phase 2 — Typography & Content Hierarchy (High Priority)

**2.1 — Fix invalid Tailwind classes**
- `text-md font-medium` → `text-base font-medium` (all occurrences)
- Add `text-pretty` to `h2` title

**2.2 — Title section redesign**
- Header: Icon (heart) + Title + close button in flex row
- Title: `text-xl font-bold text-gray-900` (was `text-lg font-semibold`)
- Subtitle/description: `text-sm text-gray-500` below title

**2.3 — Section card treatment**
- Wrap each section (App description, Credits, Support) in a `bg-gray-50 rounded-xl p-4 space-y-2` container
- Section headers: `text-sm font-semibold text-gray-800 uppercase tracking-wider` with icon
- Use `Lucide` icons or inline SVGs: `BookOpen` for description, `Users` for credits, `Heart` for support

**2.4 — Crypto addresses**
- Wrap in `bg-gray-100 rounded-lg px-2 py-1` code blocks (enhance existing)
- Add **copy button** next to each address (clipboard icon, `translate="no"` attribute)
- Use `break-all` + `select-all` for better UX

### Phase 3 — Section Redesign Details

**3.1 — Description section**
- Card: `bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4`
- Text: `text-sm text-gray-700 leading-relaxed`
- GitHub link: `text-blue-600 hover:text-blue-700 hover:underline font-medium`

**3.2 — Credits section**
- Card: `bg-gray-50 rounded-xl p-4`
- Each credit as a flex row with avatar/dot separator
- "Thanks to" line in italic `text-gray-500`

**3.3 — Support section**
- Card: `bg-amber-50/50 rounded-xl p-4 border border-amber-100`
- Ko-fi link as primary CTA button: `bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-4 py-2 text-sm font-medium`
- Crypto addresses in styled code blocks with copy buttons
- Support platform links as icon buttons in a `flex gap-2` row

**3.4 — Footer**
- "From Portugal, with love" — center with `text-xs text-gray-400 italic`
- Add small heart icon before text
- Top border: `border-t border-gray-200 pt-4 mt-4`

### Phase 4 — Interactions & Animations (Medium Priority)

**4.1 — Modal entrance animation**
- Container: `animate-in fade-in zoom-in-95 duration-200` or equivalent Tailwind classes
- Respect `prefers-reduced-motion`: conditional class or `@media (prefers-reduced-motion)` CSS

**4.2 — Backdrop click-to-close**
- Add `onClick` handler on backdrop `div` that checks `e.target === e.currentTarget`
- Close modal on backdrop click

**4.3 — Copy-to-clipboard feedback**
- Click copy button → toast notification "Address copied" (reuse existing `toast` from react-hot-toast)
- Copy button has `focus-visible:ring` and `hover:bg-gray-200` states

### Phase 5 — Close Button & Final Actions

**5.1 — Close button at bottom**
- Keep a "Fechar" (Close) button at bottom, centered or right-aligned
- Style: `px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus-visible:ring`
- Add `disabled:opacity-50` for consistency

**5.2 — Keyboard accessibility**
- Verify `Escape` still closes (already via `useModalKeyboard`)
- Verify `focus-visible` rings work on all interactive elements (CSS already sets `*:focus-visible { outline: 2px solid #2563eb }`)

---

## Design Reference

The modal should match the visual language of existing components:
- **DeleteConfirmModal**: uses `shadow-xl`, colored background (`bg-red-50`), border treatment, centered icon — adapt this pattern for section cards
- **CreateDrawerModal**: uses `space-y-3`, form labels, consistent button styling — match spacing rhythm
- **PasswordModal**: uses `rounded-lg`, `p-6`, `w-80` — consistent modal sizing

---

## Component Extraction

Per **P1.6** (TODO.md) and **P2.16/F4** (PLANO.md): Extract inline modal into `src/renderer/components/CreditsModal.tsx` with props:

```tsx
interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

This eliminates the 90-line inline block in `HomeScreen.tsx` and follows the established pattern.

---

## Files to Modify

1. **Create**: `src/renderer/components/CreditsModal.tsx` — new extracted component
2. **Modify**: `src/renderer/pages/HomeScreen.tsx` — remove inline modal, integrate `CreditsModal`
3. **Modify**: `src/renderer/index.css` — custom scrollbar styling (optional)
4. **Modify**: `src/renderer/components/CreditsModal.tsx` — add `XIcon` via vite-plugin-svgr (or inline SVG as stopgap)

---

## Acceptance Criteria

- [ ] Modal has visible shadow and depth (not flat)
- [ ] All sections have clear visual grouping (cards/panels)
- [ ] `text-md` → `text-base` (no invalid Tailwind classes)
- [ ] Close button has visible focus ring and is positioned top-right
- [ ] Backdrop click closes modal
- [ ] Modal entrance has subtle animation (with `prefers-reduced-motion` respect)
- [ ] Crypto addresses have copy-to-clipboard buttons
- [ ] Support section has CTA-styled Ko-fi button
- [ ] All interactive elements have `focus-visible` styling
- [ ] Component extracted from `HomeScreen.tsx`
- [ ] `npm run lint` — 0 errors
- [ ] `npm run typecheck` — clean
- [ ] `npm run test` — all pass
- [ ] `npm run build` — succeeds

---

## Priority Order

1. **P0 — Structure**: Container shadow, backdrop, close button fix, invalid class fix
2. **P1 — Content**: Section cards, typography hierarchy, crypto address styling
3. **P2 — Polish**: Animations, copy-to-clipboard, responsive, scrollbar
4. **P3 — Extract**: Move to separate component file
