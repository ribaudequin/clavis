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
| `--border-default` | `#e5e7eb` | Toast border, empty strength bar. Also the value bare `border` reaches — see [Form controls](#form-controls) |
| `--border-input` | `#8a8a8a` | **Every** form control boundary — the only boundary that has to carry a control |
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
| `--heart-surface` | `#e11d48` | The heart badge fill — the app's single warm accent |
| `--heart-on-surface` | `#ffffff` | The heart glyph inside that badge |

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
under [Focus indicators](#focus-indicators).) `--border-input` is the **sixteenth**, added later,
and is an exception in the other direction: it replaced nothing. It is a new value, chosen for a
measurement — see [Form controls](#form-controls).

The rule that follows: **prefer the utility whenever there is a choice.** A token is the fallback
for the cases a utility cannot reach. The tokenisation pass left exactly **35** Tailwind colour
utilities in the app, all of them used; `border-input` is the thirty-sixth.

**One token breaks the rule's rationale, on purpose.** `--border-input` is the only entry in the
table above that a `className` *can* reach — `tailwind.config.cjs` binds it to the `border-input`
utility. It is a token anyway because the value has to be stated once and justified once, next to
the measurement that chose it, rather than repeated as a bare hex across every form control in the
app. Every other token above is unreachable from a `className` and needs the token for exactly that
reason.

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
`red-500` was the same story at 3.76:1 and, until the fix recorded under
[Form controls](#form-controls), was still live as `text-red-500 text-xs` on `PasswordModal`'s
error line — a 12px string held to 4.5:1. All three bans are now enforced in code, not just in
this table.

**Control boundaries** — a different criterion, and measured against the surface each one is
actually drawn on:

| Boundary | Surface | Ratio | Verdict |
|---|---|---|---|
| `--border-input` (`#8a8a8a`) | white `#ffffff` | **3.45** | Pass |
| `--border-input` (`#8a8a8a`) | `gray-50` `#f9fafb` | **3.30** | Pass |
| `--border-input` (`#8a8a8a`) | `gray-100` `#f3f4f6` | **3.14** | Pass |
| `border` / `--border-default` (`#e5e7eb`) | white | 1.24 | Fail — the old input edge |
| `gray-400` (`#9ca3af`) | white | 2.54 | Fail |
| `gray-500` (`#6b7280`) | white | 4.83 | Pass, but visually heavy |
| `yellow-700` (`#a16207`) | `yellow-50` `#fefce8` | **4.76** | Pass — the duplicate-title alert |
| `yellow-600` (`#ca8a04`) | `yellow-50` | 2.84 | Fail — so the alert could not step up one |
| `yellow-300` (`#fcd34d`) | `yellow-50` | 1.39 | Fail — the old alert edge |

Two corrections are folded into that table rather than left as folklore. `yellow-300` in
tailwindcss 3.4 is `#fcd34d`, **not** `#fde047`, and against `yellow-50` it measures **1.39:1** —
an earlier version of this document recorded 1.27:1 for it, computed from the wrong hex. And
because `yellow-600` only reaches 2.84:1 here, the duplicate-title alert **could not have been
fixed one step up the ramp**: it had to jump to `yellow-700`.

### What the table implies

- Body text needs 4.5:1. The 3:1 allowance is for text ≥ 18.66px bold or ≥ 24px regular, and for
  non-text UI. There is no large body text in this app, so in practice: **everything you type is
  held to 4.5:1.**
- `text-gray-500` (4.83) is the floor for muted text on white. It is used for 12px captions and
  the strength meter's label, both of which are real content, not decoration.
- On `red-50`, `red-700` measures 5.91 and `red-800` 7.60 — both fine. Destructive text on the
  destructive panel uses the `-700`/`-800` end of the ramp.
- On `yellow-50`, `yellow-800` measures 6.62 — fine.
- **A boundary and a body of text are not the same object.** 3:1 is the bar for an edge, 4.5:1 for
  a word. That is why `--border-input` at 3.45:1 is a pass and `red-500` at 3.76:1 is a ban, and why
  the two decisions cannot be made from one number.

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
w-full border border-input rounded px-2 py-1 text-sm disabled:opacity-50            dialogs
w-full border border-input rounded px-3 py-2 text-sm mb-4 bg-white                  ViewDrawer
w-full border border-input rounded px-3 py-2 text-sm bg-white resize-none           textarea
```

**The boundary rule.** An input's edge is the only thing telling you where the control is, so
WCAG 1.4.11 requires **3:1** of it. Bare `border` — `#e5e7eb`, the same value as `--border-default`
reached the other way — measures **1.24:1 on white**. Every control boundary therefore carries
`border-input`, and it clears 3:1 on all three surfaces an input is drawn on: **3.45:1 on white**,
**3.30:1 on `gray-50`**, **3.14:1 on `gray-100`**.

`#8a8a8a` sits between `gray-400` and `gray-500` on the grey ramp, and both neighbours were
measured before it was picked:

| Candidate | Ratio on white | Verdict |
|---|---|---|
| `border` / `--border-default` `#e5e7eb` | 1.24 | Fail |
| `gray-400` `#9ca3af` | 2.54 | Fail — one step too light |
| `--border-input` `#8a8a8a` | **3.45** | **Pass** |
| `gray-500` `#6b7280` | 4.83 | Pass — but visibly heavy on every form in the app |

**`--border-default` is unchanged and still correct** for the borders it was chosen for. This fix
added a second token rather than moving the first, so no decorative border in the app shifted by
one pixel.

> ### `border border-input`, both classes. Never `border-input` alone.
>
> `border-input` sets only `border-color`. Tailwind's preflight resets `border-width: 0` on every
> element, so a lone `border-input` paints a **zero-width** border: invisible, and a strictly worse
> 1.4.11 failure than the one it was introduced to fix. The compiled CSS keeps the two concerns in
> separate rules, which is why one class cannot stand in for the other:
>
> ```
> .border{border-width:1px}
> .border-input{border-color:var(--border-input)}
> ```
>
> **Do not "tidy" `border border-input` down to `border-input`.** Six class strings carry the
> pair. An editor collapsing them breaks every form in the app with no build error, no type error
> and no failing test — the fields simply stop having a visible edge.

The six elements that changed: `PasswordModal.tsx:66`, `CreateDrawerModal.tsx:141`, `:156`, `:200`
(five inputs) and `ViewDrawer.tsx:111`, `:120` (an input and a textarea).

**Scope: control boundaries, not every border.** The 3:1 requirement was applied only to edges that
are the sole affordance for the thing they surround. The rest were deliberately left alone, and each
one below is at or below the threshold:

| Left alone | Measured | Why it is exempt |
|---|---|---|
| `HomeScreen.tsx:224` and `ViewDrawer.tsx:95`/`:124` header and footer rules (bare `border`) | 1.24 | Rules between regions. Nothing depends on the line to be found or understood |
| `CreditsModal` section and footer rules (`border-amber-100` 1.09, `border-amber-200` 1.22, `border-gray-100` 1.10) | 1.09–1.22 | Same. The surrounding text carries all the content |
| `DiscardChangesModal` panel and cancel button, `DeleteConfirmModal` cancel button (`border-gray-300`) | 1.47 | A dialog heading and a visible button label already identify these; the edge is not the only thing doing so, which is WCAG 1.4.11's own exemption |
| The outlined destructive buttons (`border-red-300`) | 1.90 | Same, and the label is `red-700` at 6.47:1 |
| `DeleteConfirmModal`'s panel border (`border-red-600`, 2px) | 4.41 on `red-50` | Clears 3:1 on its own |

That exemption is already argued for the toast borders under [Toasts](#toasts). The line is drawn
at *is this edge the only affordance for the thing it surrounds?* — not at *is this a border?* —
which is why `border-red-300` on a button and `border-yellow-700` on the duplicate-title alert get
different answers. The alert is the whole message: nothing inside it is a boundary.

Other notes:

- Every input has a real `<label htmlFor>`. There are no placeholder-only fields.
- Password fields carry `autoComplete` (`new-password` / `current-password`).
- The reveal toggle is an absolutely-positioned `text-gray-500` button with `aria-label` and
  `aria-pressed`; the input carries `pr-8` to clear it.
- Validation errors render in a `role="alert"` element, and in `text-red-700` (6.47:1 on white) —
  never `text-red-500`, which cannot carry a 12px string.

### Alerts and inline messages

Two patterns, both tinted backgrounds with a matching border:

```
bg-yellow-50 border border-yellow-700 rounded p-3 + text-yellow-800   duplicate title
bg-red-50 border-2 border-red-600 rounded-lg                          delete dialog panel
bg-amber-50/60 rounded-xl p-4 border border-amber-100                 support section
```

**The duplicate-title alert's border is a control boundary, not a tint.** It is `yellow-700`
(`#a16207`) against the `yellow-50` (`#fefce8`) panel — **4.76:1**, up from 1.39:1 with the
`yellow-300` it replaced. `yellow-600` was not an option: one step up the ramp from `yellow-700`
it measures 2.84:1 there and still fails 1.4.11, so the fix had to skip a step. The inner text was
already `text-yellow-800`, which measures 6.62:1 on the same panel. **A tinted alert panel is a
surface; its border is the boundary of the message, and the 3:1 bar applies.**

### Modals

There is **no base `Modal` component and no portal**. Each modal hand-rolls the overlay and
composes the same two hooks. This is the contract to follow when adding a sixth.

```
useFocusTrap(modalRef, { isActive: true })
useModalKeyboard(modalRef, { onEscape })
```

Both hooks attach `keydown` listeners to the **container ref**, so they must share it — and because
they share it, **each key must have exactly one owner.** Escape belongs to `useModalKeyboard`
alone. `useFocusTrap` takes no `onEscape` at all. See
[Escape has exactly one owner](#escape-has-exactly-one-owner) for why that is a rule and not a
detail.

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

### Escape has exactly one owner

**Escape is modal-keyboard behaviour, not focus-containment behaviour.** `useFocusTrap` keeps Tab
inside the panel and restores focus when the modal unmounts. It should never have handled a key.
`useModalKeyboard` is the sole owner of Escape and Enter, and it is the hook every modal passes
`onEscape` to. `onEscape` is not in `useFocusTrap`'s options interface at all — the option, the
latest-value ref that held it, and the effect that synced that ref are all gone.

All five modals pass `{ isActive: true }` to `useFocusTrap`, except `CreditsModal`, the one modal
that mounts conditionally, which passes `{ isActive: isOpen }`. The old escape handler also called
`e.preventDefault()`; `useModalKeyboard` does the same, so that behaviour is preserved exactly.

**What the double fire measured.** Both hooks used to attach a `keydown` listener for Escape to the
same container ref, so one press invoked `onEscape` twice. Reintroducing the duplicate handler
reproduces it exactly:

| Escape presses | `onEscape` invocations | Ratio |
|---|---|---|
| 1 | 2 | 2:1 |
| 2 | 4 | 2:1 |

It was invisible in the app only because every `onEscape` happens to be an idempotent
`setState(false)` — setting a boolean false twice is the same as setting it once. Any handler that
was not idempotent would have fired twice per press: a counter, an append, a request, an analytics
event, a nested confirm. **A double fire hidden by an idempotent handler is still a double fire.**
That is also why it survived review — nothing in the app could exhibit it.

**The dependency trap, and why it outlived the fix.** `useFocusTrap`'s main effect still depends
only on `[containerRef, isActive]`, and **that is still load-bearing.** Its cleanup restores focus
to whatever was focused *before* the modal opened, which is outside the dialog. Add any unstable
dependency and a parent re-render re-runs the effect, firing that cleanup:

| `useFocusTrap` shape | Focus after a parent re-render |
|---|---|
| As written — deps `[containerRef, isActive]` | stays on the dialog's own control |
| Any added dependency | jumps back to the opener, outside the dialog |

The second row was measured against the old two-key shape, but the cleanup code that produces it is
unchanged, so it still holds for any dependency you might be tempted to add. Every caller passes an
inline arrow to `useModalKeyboard`, so a new function identity arrives on every parent render. The
trap is now avoided by not having the key in this hook at all, rather than by a ref to make it
stable — but the consequence is identical, and the reason has not changed.

The symptom is a **focus escape, not a crash**: the modal stays open and the listener re-attaches,
so this never appears in an error report. Note that `useModalKeyboard` lists `onEscape` and
`onEnter` as ordinary dependencies, which is correct there because it has no focus-restoring
cleanup. The asymmetry is no longer a difference in technique; it is a difference in
responsibility, and it is the intended one.

**What guards it.** `tests/escapeSingleInvocation.test.tsx` — 5 tests, **no hook mocked**, because
the point is the real wiring — asserts the single-owner contract using **non-idempotent handlers**:
a state counter that must advance by exactly one per keypress. An idempotent `setState(false)`
cannot observe a double fire at all, which is precisely why the previous suite missed this.
Reintroducing the duplicate handler fails 4 of the 5 at exactly the 2:1 ratios above. Two more
guards sit alongside it: `tests/DiscardChangesModal.test.tsx` asserts statically that `onEscape` is
absent from the `useFocusTrap` options, and `tests/useFocusTrap.test.tsx` asserts that focus stays
inside the dialog across a caller re-render while Escape still closes it. The suite went from 143
to 148 tests with this fix; all five new ones fail if the double handling returns.

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
   and is therefore controllable. It is the app's single warm accent and stays one colour
   everywhere — see [The heart accent](#the-heart-accent) below for why it is a badge rather than
   a coloured glyph.
3. **Brand marks** — `ko-fi.svg`, `github.svg`, `eth.svg`, `sol.svg`. These carry baked
   `fill="#..."` presentation attributes and are rendered **uncoloured**, with no class. They must
   stay that way: recolouring the GitHub, ETH, SOL or Ko-fi logos would destroy recognition.

### The heart accent

The heart is the app's only warm accent, and it is **one colour in all four places it appears**.
An earlier iteration made it follow its surroundings instead; the owner rejected that, correctly —
it fixed the contrast but destroyed the accent, because a repeated colour is a signature and a
colour-that-matches-whatever-is-behind-it is not.

It is therefore a **badge, not a coloured glyph**: a rounded square filled with `--heart-surface`
(`#e11d48`) holding a white heart. That is what makes a single tone possible at all:

| Placement | Heart | Surface behind it | Measured |
|---|---|---|---|
| Credits header tile | white on `--heart-surface` | — | **4.70:1** |
| Credits support section | white on `--heart-surface` | — | **4.70:1** |
| Credits footer | `--heart-surface` | white | **4.70:1** |
| `HomeScreen` header | `--heart-surface` | white | **4.70:1** |

The badge is load-bearing. Painting the heart directly at `#e11d48` cannot reach 4.5:1 on any of
the surfaces it actually sits on — it measures 3.85:1 on the header tile's red, 4.27:1 on
`gray-100`, and no lighter red reaches the bar either (`red-50` gives 4.29:1). The old baked salmon
`#f8585e` was worse still: 2.63–3.21:1, failing even the 3:1 that an icon carrying meaning needs.
Inverting the relationship — coloured surface, white glyph — is what makes one consistent accent
survive the contrast requirement.

Use `--heart-surface` and `--heart-on-surface` rather than a raw hex, so the accent stays a single
editable decision.

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
| `CreditsModal` never focuses anything on mount | ESC does not close it until the user clicks or tabs into the panel | Live. Add the mount `focus()` + `window.focus()` the other four have. |
| No `prefers-reduced-motion` support | 0 occurrences in `src/` | The `animate-in`/`animate-pulse` transitions do not degrade for users who have asked for reduced motion. |
| Residual i18n leaks in the strength meter | `CreateDrawerModal.tsx:52` and `:59` hardcode `'Too short (min 8 chars)'`, `'Weak'`, `'Fair'`, `'Good'`, `'Strong'`, `'Excellent'` in English, while every other string goes through `t()`. The colours on those same lines are tokenised; the labels are not. | Part of the "not everything is tokenised yet" set. |
| **No dark mode** | — | `tailwind.config.cjs` sets `darkMode: 'class'` and the CSS is structured to allow it, but no `dark:` variant exists anywhere and no theme is defined. Deliberately deferred. Do not infer that adding `dark:` classes will work. |
| `--border-input` has no dark-mode companion value | `#8a8a8a` is a static hex under `:root`, with no `.dark` or `@media (prefers-color-scheme)` override | Currently inert, because nothing in `src/renderer` uses a `dark:` variant (0 occurrences) — so the light value is the only value that can ever be read. It becomes a live gap the moment either of those two things changes. It also has no `prefers-color-scheme` story, so a user whose OS is dark and whose app is light gets the same 3.45:1 with no adaptation. |
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