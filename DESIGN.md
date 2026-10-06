# Design System — Clavis

This document describes the interface **as the code actually implements it**. Every contrast
figure below was computed from the shipped colour values with the WCAG 2.x relative-luminance
formula; none of them are eyeballed or copied from documentation.

Where the code has a defect, this document names it as a defect rather than describing the
intent. Section [Known gaps](#known-gaps) is part of the specification, not a to-do list
appended to it — a reader using this document to write a component needs to know which
conventions are load-bearing and which are accidents.

There is **no component library and no Figma file**. The design system is: Tailwind's default
scale, a small set of CSS custom properties, two focus/keyboard hooks, and a repeated modal
pattern that is written out by hand in each file.

---

## Rules

The short version. These are the constraints that the existing code satisfies; follow them.

1. **Text is ≥ 4.5:1.** 3:1 is allowed only for text ≥ 18.66px bold or ≥ 24px regular.
2. **Non-text indicators — focus rings, control boundaries, icons that carry meaning — are ≥ 3:1**
   against the surface they sit on.
3. **`text-gray-400` is banned on white.** It measures 2.54:1. Use `text-gray-500` (4.83:1).
4. **A white label on a coloured button needs the `-700` shade or darker.** `amber-500` (2.15:1)
   and `yellow-600` (2.94:1) fail. `green-600` (3.30:1) is for large text and UI only.
5. **In a `className`, use a Tailwind utility. In a `style` prop or any other non-Tailwind API,
   use a CSS custom property.** Tokens exist only because `style` cannot take utilities.
6. **Never leave a colour class on an SVG that sets `fill` to a literal.** Make the SVG paint with
   `currentColor` first, or leave the icon uncoloured.
7. **A focus indicator on a coloured button needs two parts** — a local inset ring for the button
   face plus the global outline for the surrounding surface. No single colour clears 3:1 against
   both white and `blue-600`.
8. **ESC always goes to the cancel/close path.** Never to the destructive or committing action.
9. **Modal focus goes where a stray Enter lands safely** — the cancel button, or the action the
   dialog is recommending. Never the one that destroys something.

---

## Colour

### Tokens

Defined once, in `src/renderer/index.css` under `:root`. This is the complete list — there are
no others, and there is no theme file.

| Token | Value | Used for |
|---|---|---|
| `--focus-ring` | `#3b82f6` | The global `:focus-visible` outline |
| `--surface` | `#ffffff` | Toast background |
| `--text-primary` | `#1f2937` | Toast body text |
| `--border-default` | `#e5e7eb` | Toast border, empty strength bar |
| `--danger-border` | `#fca5a5` | Error toast border |
| `--danger-text` | `#7f1d1d` | Error toast text |
| `--success-border` | `#86efac` | Success toast border |
| `--success-text` | `#14532d` | Success toast text |
| `--info-border` | `#bfdbfe` | Loading toast border |
| `--info-text` | `#1e3a8a` | Loading toast text |
| `--strength-weak` | `#fca5a5` | Password meter, score 1 |
| `--strength-fair` | `#fdba74` | Password meter, score 2 |
| `--strength-good` | `#fde047` | Password meter, score 3 |
| `--strength-strong` | `#86efac` | Password meter, score 4 |
| `--strength-excellent` | `#4ade80` | Password meter, score 5 |

**Why tokens rather than utilities.** Two APIs in this codebase accept colour but not Tailwind
classes, because they are not `className`:

- `react-hot-toast`'s `toastOptions` in `src/renderer/components/ToastProvider.tsx` — the whole
  visual style of every toast is a `style` object.
- The password-strength meter's `backgroundColor`
  (`src/renderer/components/CreateDrawerModal.tsx:52`, `:53`, `:60`, `:180`).

These 15 properties replaced **18 hard-coded hex literals** — 9 in `ToastProvider.tsx`, 9 in
`CreateDrawerModal.tsx`. The values are **structure, not restyling**: every one is byte-identical
to what it replaced, so every pairing still measures what it measured before. (`--focus-ring` is
the fifteenth and is the exception — it replaced `#2563eb` in this same file, in the fix described
under [Focus indicators](#focus-indicators).)

The rule that follows: **prefer the utility whenever there is a choice.** A token is the fallback
for the cases a utility cannot reach. The app currently emits exactly **35** Tailwind colour
utilities, all of which are used.

### Measured contrast

All ratios are foreground-on-white unless stated otherwise.

**White label on a coloured button fill**

| Fill | Ratio | Verdict |
|---|---|---|
| `blue-800` | 8.72 | Pass |
| `blue-700` | 6.70 | Pass |
| `blue-600` | 5.17 | Pass — the default primary |
| `red-700` | 6.47 | Pass |
| `red-600` | 4.83 | Pass — the default destructive |
| `amber-800` | 7.09 | Pass |
| `amber-700` | 5.02 | Pass |
| `amber-600` | 3.19 | Large text / UI only |
| `amber-500` | **2.15** | **Banned** |
| `yellow-700` | 4.92 | Pass |
| `yellow-600` | **2.94** | **Banned** |
| `green-700` | 5.02 | Pass |
| `green-600` | 3.30 | Large text / UI only |

**Text colours on white**

| Colour | Ratio | Verdict |
|---|---|---|
| `gray-400` | **2.54** | **Banned** |
| `gray-500` | 4.83 | Pass — the lightest permitted body grey |
| `gray-600` | 7.56 | Pass |
| `red-500` | **3.76** | **Banned for body text** — fails at `text-xs`/`text-sm` |
| `--text-primary` (`#1f2937`) | 14.68 | Pass |
| `--danger-text` (`#7f1d1d`) | 10.02 | Pass |
| `--success-text` (`#14532d`) | 9.11 | Pass |
| `--info-text` (`#1e3a8a`) | 10.36 | Pass |

**The marked entries are not options.** They are listed so the reason they are absent from the
codebase is on the record: `amber-500` and `yellow-600` were both live WCAG AA failures, measured
at 2.15:1 and 2.94:1 against 14px white labels, and were raised to `-700` in commit `5ad6892`.

### What the table implies

- Body text needs 4.5:1. The 3:1 allowance is for text ≥ 18.66px bold or ≥ 24px regular, and for
  non-text UI. There is no large body text in this app, so in practice: **everything you type is
  held to 4.5:1.**
- `text-gray-500` (4.83) is the floor for muted text on white. It is used for 12px captions and
  the strength meter's label, both of which are real content, not decoration.
- On `red-50`, `red-700` measures 5.91 and `red-800` 7.60 — both fine. Destructive text on the
  destructive panel uses the `-700`/`-800` end of the ramp.
- On `yellow-50`, `yellow-800` measures 6.62 — fine.

---

## Focus indicators

### The global rule

`src/renderer/index.css` sets a single outline for the whole application:

```css
*:focus { outline: none; }
*:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; border-radius: 2px; }
```

`--focus-ring` is `#3b82f6`. It was `#2563eb` until commit `5ad6892`, which measured it at
**2.84:1 against `gray-800`** — a real surface in this app, used for header and panel text — and
therefore failed the 3:1 that a non-text indicator requires. `#3b82f6` is the only candidate that
clears every surface the ring is actually drawn on:

| Against | Ratio |
|---|---|
| `blue-50` | 3.38 |
| `gray-50` | 3.52 |
| `amber-50` | 3.55 |
| white | 3.68 |
| `gray-800` | 3.99 |
| `gray-900` | 4.82 |

Every one passes. Do not change `--focus-ring` without re-running those six measurements.

> The shipped CSS reads `:focus` and `:focus-visible` — Vite's minifier strips the leading `*`.
> A bare `:focus` is the implicit universal selector and is semantically identical. This predates
> the work above; do not "fix" it.

### The two-part rule

A focus ring on a coloured button cannot be a single colour, and this is measured, not stylistic
preference. Sweeping the full hue circle at full saturation, **zero** colours clear 3:1 against
both white and `blue-600` — white and blue are too close in luminance for anything to separate
from both. So the indicator needs two parts:

- **A local ring on the button face.** `CreditsModal`'s close button uses an *inset* white ring:

  ```
  focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white focus-visible:ring-opacity-100
  ```

  White against the `blue-600` face is **5.17:1**.
- **The global outline for the surrounding surface**, which supplies 3.68:1 against the white panel.

The previous version used `ring-offset-2`, which painted the ring *off* the button face and onto
the white panel — 3.68:1 there, and **1.41:1 against the button it was supposed to be marking**.
The defect was invisible in a contrast audit that measured against the panel. **When you audit a
focus indicator, audit it against the element it marks, not the space around it.**

### Ring opacity — a correction worth keeping

**Tailwind's bare ring colour is not 50% opacity.** tailwindcss 3.4.19 emits, for `ring-blue-500`:

```
.ring-blue-500 {
  --tw-ring-opacity: 1;
  --tw-ring-color: rgb(59 130 246 / var(--tw-ring-opacity, 1))
}
```

The `0.5` in the JS config's `ringOpacity.DEFAULT` never becomes the CSS fallback — the compiled
fallback is `1`. An audit that assumed 50% will produce a wrong number for every ring in the app.
The 1.19:1 figure that briefly circulated was an artefact of exactly that assumption; the real
defect was the `ring-offset`, above.

---

## Typography

There is no custom font stack and no type scale of our own. Everything uses Tailwind's defaults,
and the app stays inside four sizes.

| Token | Used for |
|---|---|
| `text-xs` (12px) | Captions, the strength meter's label, the credit links |
| `text-sm` (14px) | All button labels, form labels, body copy inside cards |
| `text-lg` (18px) | Modal titles |
| `text-xl` (20px) | The credits modal title, the error screen title |

Weights in use: `font-normal`, `font-medium`, `font-semibold`, `font-bold`. Section headings
inside cards add `uppercase tracking-wide`.

The body colour is `text-gray-900` (set on `body` in `index.css`). Muted copy is `text-gray-600`
or `text-gray-500`; both pass at 14px and at 12px.

---

## Spacing, radii, elevation

The app uses Tailwind's 4px base scale directly. There is no project spacing scale to follow.

- **Radii:** `rounded` (inputs), `rounded-lg` (buttons, panels), `rounded-xl` (cards, the update
  button), `rounded-2xl` (the credits panel). Match the neighbouring element rather than
  introducing a new radius.
- **Elevation:** `shadow-sm` (skeleton cards), `shadow-lg`, `shadow-xl` (dialog panels),
  `shadow-2xl` (the credits panel), plus the toast's own
  `0 10px 25px rgba(0,0,0,0.15)` box-shadow, which is a `style` value and so cannot be a utility.
- **Motion:** `transition-colors` on interactive elements; `transition-all` on the update button.
  `tailwindcss-animate` supplies `animate-in fade-in duration-200` and `zoom-in-95` on the credits
  panel, and `animate-pulse` on skeletons. **There is no `prefers-reduced-motion` handling
  anywhere** — see [Known gaps](#known-gaps).

---

## Components

There is no base component for any of these. The tables below are inventories of what exists, so
that a new component matches the house style instead of inventing a third variant.

### Buttons

Primary — filled, white label:

```
px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50
```

Used by `HomeScreen`, `ViewDrawer`, `CreateDrawerModal`, `PasswordModal`, `DiscardChangesModal`,
`ErrorBoundary`.

Destructive — same shape, red:

```
px-3 py-1 text-sm text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50
```

Used by `DeleteConfirmModal`. It is the only red filled button in the app.

Secondary — ghost, no fill:

```
px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50
```

The default cancel affordance in `CreateDrawerModal`, `PasswordModal`, `ViewDrawer`.

Tertiary outline — used inside dialogs where the actions must read as a pair:

```
px-4 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-100
px-3 py-1 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-100
```

`HomeScreen`'s per-card action uses a fifth variant,
`px-3 py-1 text-sm text-gray-700 bg-gray-200 rounded hover:bg-gray-300` — the only `bg-gray-200`
button, because it sits on the `gray-50` page rather than inside a panel.

Rules that hold across all of them: `text-sm` labels, `font-medium` on filled and outline
variants, `disabled:opacity-50` on anything that has a loading state, and a hover that darkens the
fill by one step.

### Form controls

```
w-full border rounded px-2 py-1 text-sm disabled:opacity-50          dialogs
w-full border rounded px-3 py-2 text-sm mb-4 bg-white                ViewDrawer
w-full border rounded px-3 py-2 text-sm bg-white resize-none         textarea
```

Notes:

- Bare `border` is Tailwind's default `#e5e7eb` — the same value as `--border-default`, reached the
  other way. It measures **1.24:1 on white**, which fails the 3:1 that WCAG 1.4.11 asks of a
  control boundary. This is a live gap, not a solved problem; see [Known gaps](#known-gaps).
- Every input has a real `<label htmlFor>`. There are no placeholder-only fields.
- Password fields carry `autoComplete` (`new-password` / `current-password`).
- The reveal toggle is an absolutely-positioned `text-gray-500` button with `aria-label` and
  `aria-pressed`; the input carries `pr-8` to clear it.
- Validation errors render in a `role="alert"` element.

### Alerts and inline messages

Two patterns, both tinted backgrounds with a matching border:

```
bg-yellow-50 border border-yellow-300 rounded p-3 + text-yellow-800   duplicate title
bg-red-50 border-2 border-red-600 rounded-lg                          delete dialog panel
bg-amber-50/60 rounded-xl p-4 border border-amber-100                 support section
```

### Modals

There is **no base `Modal` component and no portal**. Each modal hand-rolls the overlay and
composes the same two hooks. This is the contract to follow when adding a sixth.

```
useFocusTrap(modalRef, { isActive: true, onEscape })
useModalKeyboard(modalRef, { onEscape })
```

Both hooks attach `keydown` listeners to the **container ref**, so they must share it.

**Overlay.** All five use `fixed inset-0 … flex items-center justify-center z-50`. The opacity
is not uniform, and this is drift rather than intent:

| Modal | Overlay classes (the part that differs) |
|---|---|
| `DeleteConfirmModal` | `bg-black bg-opacity-60` |
| `DiscardChangesModal` | `bg-black bg-opacity-60` |
| `PasswordModal` | `bg-black bg-opacity-50` |
| `CreateDrawerModal` | `bg-black bg-opacity-50` |
| `CreditsModal` | `bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200` |

For a new modal use `bg-black bg-opacity-60`; it is the value the two confirmation dialogs use,
and `60` is what the destructive overlay needs to separate the panel from the app behind it.

**Semantics.** Every modal carries `role="dialog"`, `aria-modal="true"` and `aria-labelledby`.
`aria-describedby` is present where there is body copy (`DeleteConfirmModal`,
`DiscardChangesModal`) and absent where there is not. Note that `PasswordModal` sets
`aria-describedby="password-error"` unconditionally while the element with that id only renders
when there is an error — a dangling reference in the common case.

**ESC goes to cancel.** In all five modals `onEscape` is the cancel or close handler.

**Mount focus.** Both hooks bind on the container, so something must hold focus inside the modal
for ESC to fire at all. Each modal therefore focuses something on mount:

| Modal | Focused on mount | `window.focus()`? |
|---|---|---|
| `DeleteConfirmModal` | **Cancel** — the safe action | yes |
| `DiscardChangesModal` | **"Save and leave"** — the recommended action | yes |
| `CreateDrawerModal` | The title input | yes |
| `PasswordModal` | The password input | no |
| `CreditsModal` | *nothing* | no |

The reasoning behind the two that are not simply "the first field": focus goes where a stray Enter
should land **safely**, or where the dialog is **recommending**. `DeleteConfirmModal` focuses
cancel, so a reflexive Enter dismisses rather than destroys. `DiscardChangesModal` focuses the
save action, because that is what the dialog is telling you to do. **Never focus the destructive
action on mount.**

`window.focus()` is called alongside the element focus so the Electron window takes keyboard
focus; without it the first keypress can be swallowed by the OS.

**`CreditsModal` has no mount focus at all.** Until the user clicks or tabs into the panel, ESC
does nothing. This is a live gap — see below.

**Danger actions are red; the primary is blue.** `DiscardChangesModal` is the interesting case: it
has three actions and its primary is *saving*, so it uses `blue-600` for save, an outlined
`red-700`/`red-300` button for discard-and-leave, and it **deliberately omits `danger.svg`**. A
red skull above a dialog whose main button saves would mislabel the whole thing. **The icon has to
agree with the action the dialog recommends, not with the presence of a destructive option.**

### The `onEscape` dependency trap

`useFocusTrap` holds `onEscape` in a latest-value ref, updated by its own effect, and the main
effect depends only on `[containerRef, isActive]`. **This is load-bearing. Do not put `onEscape`
back in the dependency array.**

Every caller passes an inline arrow (`onEscape: onCancel`), so a new function identity arrives on
every parent render. With `onEscape` in the dependency array that re-runs the effect, and the
effect's cleanup restores focus to whatever was focused *before the modal opened* — which is
outside the dialog. Reproduced by running both hook shapes against the same test:

| `useFocusTrap` shape | Focus after a parent re-render |
|---|---|
| As written — latest-value ref, deps `[containerRef, isActive]` | stays on the dialog's own control |
| `onEscape` added to the deps | jumps back to the opener, outside the dialog |

The trap is not torn down visibly — the modal stays open and the listener is re-attached — so the
symptom is a focus escape, not a crash. Note that `useModalKeyboard` does **not** use this pattern;
it lists `onEscape` and `onEnter` as ordinary dependencies. That is safe there because it has no
cleanup that restores focus. The asymmetry is deliberate, not an oversight.

### Toasts

Configured in one place, `ToastProvider.tsx`, via `toastOptions`. Because the whole appearance is
a `style` object, it uses tokens throughout.

- Position `bottom-right`, `duration: 4000`, `className: 'text-sm'`.
- Base: `background: var(--surface)`, `color: var(--text-primary)`,
  `border: 1px solid var(--border-default)`, `border-radius: 8px`, `padding: 12px 16px`, plus a
  drop shadow.
- Variants override border and colour only: `error` → danger, `success` → success,
  `loading` → info. Each carries an emoji icon.

**Toast borders are decorative and deliberately not re-valued.** They measure 1.24 (`--border-default`),
1.40 (`--success-border`), 1.42 (`--info-border`) and 1.90 (`--danger-border`) against the toast
surface. WCAG 1.4.11 exempts boundaries that are not the only thing identifying the component, and
the toast also has a drop shadow and text at 9:1 or better. They are not required to pass.

### Loading states

`SkeletonCard` in `SkeletonLoader.tsx` is a `bg-white rounded-lg shadow-sm` block of
`bg-gray-200`/`bg-gray-300` bars under `animate-pulse`. The wrapper is
`role="status" aria-label={t('label.loading_drawers')}`. These are placeholders, not content, so
they are outside the contrast requirement.

### Icons

Icons come from three sources, and they do not behave the same way:

1. **Inline SVG, `stroke="currentColor"`** — the copy, close and eye icons. Fully controllable by
   a Tailwind colour class.
2. **`icons/svg/*.svg` imported with `?react`** (SVGR). `heart.svg` uses `style="fill:currentColor"`
   and is therefore controllable by a colour class. It follows its context — `text-red-500` on the
   credits header tile, `text-amber-700` in the support section, `text-gray-500` in the footer,
   `text-gray-600` on `HomeScreen`. It is no longer one salmon accent everywhere.
3. **Brand marks** — `ko-fi.svg`, `github.svg`, `eth.svg`, `sol.svg`. These carry baked
   `fill="#..."` presentation attributes and are rendered **uncoloured**, with no class. They must
   stay that way: recolouring the GitHub, ETH, SOL or Ko-fi logos would destroy recognition.

**The rule.** A `text-*` class sets the CSS `color` property. An SVG that paints itself with a
literal `fill` — whether `fill="#f8585e"` as a presentation attribute, or `style="fill:#f8585e"`
as an inline declaration — never reads `color`, so the class does nothing at all. Both forms
existed in `icons/svg/`, and **nine `text-*` classes were silently inert** for that reason: the
icons were rendering at their baked literals while the code claimed to recolour them.

So there are exactly two valid states:

| SVG paints with | Colour class | Verdict |
|---|---|---|
| `fill="currentColor"` or `stroke="currentColor"` | works | Correct |
| `fill="#hex"` or `style="fill:#hex"` | silently ignored | Either convert it to `currentColor`, or delete the class |

> Never leave a colour class on an SVG that sets `fill` to a literal. Either make the SVG
> `currentColor`, or leave the icon uncoloured.

If you add an icon and the colour class appears to do nothing, open the SVG and look for `fill`
before assuming the class is wrong.

---

## Known gaps

These are live. They are documented here so that nobody reads this file and concludes the codebase
is fully conformant.

| Gap | Measured | Status |
|---|---|---|
| `danger.svg` contains **two** `style="fill"` declarations — `#f32929` and `#131112` — and the near-black one is painted last | `#131112` on the `red-50` panel is **17.19:1**; the icon is effectively invisible | Undiagnosed. Whether `#131112` was meant to be a stroke or is an export artefact is unknown. Needs an asset decision. |
| The GitHub mark on the `green-600` update button | **1.20:1** | Pre-existing. Fixing it needs a brand-asset or surface decision — the mark cannot be recoloured without ceasing to be the GitHub logo. |
| `PasswordModal` error text is `text-red-500 text-xs` on white | **3.76:1**, below the 4.5:1 that 12px text needs | Live WCAG AA text failure. Not touched by commit `5ad6892`; it was outside that pass's scope. Use `text-red-700` (5.91:1 on `red-50`, 6.47:1 on white) or the `--danger-text` token. |
| Input boundaries use bare `border` (`#e5e7eb`) on white | **1.24:1**, below the 3:1 that WCAG 1.4.11 requires of a control boundary | Live. Would need a `-400` or `-500` border, which changes the visual weight of every form in the app. |
| The duplicate-title alert's `border-yellow-300` on `yellow-50` | **1.27:1** | Live boundary failure, same criterion. |
| `CreditsModal` never focuses anything on mount | ESC does not close it until the user clicks or tabs into the panel | Live. Add the mount `focus()` + `window.focus()` the other four have. |
| Both hooks attach `keydown` on the same container, so ESC invokes `onEscape` **twice** per press | Measured: 2 invocations | Benign today only because every `onEscape` is an idempotent `setState(false)`. A non-idempotent handler would fire twice. |
| No `prefers-reduced-motion` support | 0 occurrences in `src/` | The `animate-in`/`animate-pulse` transitions do not degrade for users who have asked for reduced motion. |
| Residual i18n leaks in the strength meter | `CreateDrawerModal.tsx:52` and `:59` hardcode `'Too short (min 8 chars)'`, `'Weak'`, `'Fair'`, `'Good'`, `'Strong'`, `'Excellent'` in English, while every other string goes through `t()`. The colours on those same lines are tokenised; the labels are not. | Part of the "not everything is tokenised yet" set. |
| **No dark mode** | — | `tailwind.config.cjs` sets `darkMode: 'class'` and the CSS is structured to allow it, but no `dark:` variant exists anywhere and no theme is defined. Deliberately deferred. Do not infer that adding `dark:` classes will work. |
| `index.html`'s `<meta name="theme-color" content="#ffffff">` | — | Outside the CSS cascade, so it cannot be tokenised. Must be changed by hand. |
| `PasswordModal`'s `aria-describedby="password-error"` | — | Points at an element that only exists when there is an error. |

---

## Not covered

This document does **not** describe, and you should not look here for:

- **Dark mode or any second theme.** There is one, light, and it is the only one.
- **A component library.** There is no `Modal`, no `Button`, no `Input` export. Every pattern is
  copied from a sibling file by hand, which is why the drift above exists.
- **Responsive breakpoints.** There are none. The renderer is a fixed-width Electron window and
  contains no `sm:`/`md:`/`lg:` variants. Do not add them speculatively.
- **Figma, or any visual source of truth.** `wireframes/` exists but is not maintained against the
  code and is not normative.
- **Print styles, or high-contrast / forced-colours handling.** Neither is implemented.
- **Animation timing as a specification.** Only `duration-200` exists, on one panel.

If you need one of these, it does not exist yet — say so rather than assuming a pattern is
available.