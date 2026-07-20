# DevVault — Design.md

Visual design system and interaction patterns. This is the reference for
"does this new screen look and behave like the rest of DevVault" — colors,
type, spacing, motion, component conventions, and the responsive/mobile
rules established during this project's mobile-optimization pass.

---

## 1. Brand concept

**"A vault for what you build."** The name and visual language lean into a
warm, mechanical, slightly old-world "vault/safe" metaphor (brass tones, a
dial-like logomark, a ticking micro-animation) deliberately contrasted
against a modern, dark, developer-tool aesthetic (deep ink backgrounds,
monospace accents for anything code-like). The result should feel more like
a well-made physical tool than a generic SaaS dashboard.

## 2. Color system

Colors are defined as CSS custom properties (`:root` for dark, `.light` — or
equivalent selector — for light), consumed through Tailwind's `darkMode:
'class'` config so components never hardcode hex values, only semantic
Tailwind tokens (`bg-ink`, `text-text-muted`, `border-border`, etc.).

### 2.1 Semantic surface/text tokens (theme-aware)

| Token | Dark value | Light value | Use |
|---|---|---|---|
| `ink` | `#0f1420` | `#f7f8fb` | Page background |
| `ink-soft` | `#141a2a` | `#ffffff` | Secondary background (sidebar, panels) |
| `surface` | `#161c2c` | `#ffffff` | Card background |
| `surface-raised` | `#1d2438` | `#f2f4f9` | Inputs, elevated chips |
| `surface-hover` | `#232b42` | `#eceff5` | Hover state background |
| `border` | `#262e42` | `#e4e7ef` | Default border |
| `border-soft` | `#1d2436` | `#edf0f6` | Subtler dividers |
| `text` | `#e6e9f0` | `#1a1f2e` | Primary text |
| `text-muted` | `#8890a4` | `#5a6278` | Secondary text |
| `text-faint` | `#5a6278` | `#8890a4` | Tertiary/disabled text |

Note the muted/faint values intentionally swap between themes rather than
just inverting lightness — this keeps perceived contrast hierarchy
consistent (muted is always "one step down from primary," not a fixed hex).

### 2.2 Accent palette (theme-independent)

| Token | Value(s) | Use |
|---|---|---|
| `brass.400` | `#E8A33D` | Primary accent — active nav state, primary buttons, focus ring, logomark |
| `brass.50–600` | `#FBF3E4` → `#B77620` | Tints/shades of the above for hover/pressed/subtle-background states |
| `mint.400–600` | `#5EEAD4` → `#14B8A6` | Secondary accent (used sparingly — e.g. medium-priority badges) |
| `ok` | `#4ADE80` | Success states |
| `warn` | `#E8A33D` | Warning states (shares the brass hue deliberately) |
| `danger` | `#F87171` | Destructive actions, errors |
| `onaccent` | `#14181f` | Fixed dark text color for content sitting *on* an accent-colored surface (e.g. text inside a brass button) — exists specifically so contrast holds in both light and dark mode, since a theme-aware text token would invert incorrectly here |

**Rule of thumb:** brass = primary/active/brand; mint = secondary
accent, used lightly; ok/warn/danger = semantic only, never decorative.

## 3. Typography

Three typefaces, each with a specific job — don't mix their roles:

| Font | Tailwind class | Role |
|---|---|---|
| Space Grotesk (500/600/700) | `font-display` | Headings, the DevVault logotype, anything that should feel like a "title" |
| Inter (400/500/600/700) | `font-body` | All body copy, labels, buttons, UI chrome (this is the default — `body` sets it globally) |
| JetBrains Mono (400/500/600) | `font-mono` | Anything code-adjacent: snippet code, timestamps/IDs, the logomark's ticking dial numerals |

Loaded via Google Fonts `<link>` in `index.html` with `preconnect` hints —
not self-hosted. If self-hosting becomes a priority (e.g. for
privacy/performance), swap the `<link>` tags for local `@font-face`
declarations; the Tailwind `fontFamily` config doesn't need to change.

## 4. Spacing, radius, shadow

- **Radius scale** is slightly larger than Tailwind's default across the
  board (`sm: 6px`, `DEFAULT: 10px`, `lg: 14px`, `xl: 20px`) — this is what
  gives cards and inputs their slightly "soft/machined" feel rather than
  sharp SaaS-dashboard corners.
- **`shadow-vault`** — the default card shadow (`0 1px 0 rgba(255,255,255,0.03)
  inset, 0 8px 24px -8px rgba(0,0,0,0.5)`): a subtle inner highlight plus a
  soft drop shadow, used via the `.card` utility class. Gives depth without
  looking like a generic Material-style elevation.
- **`shadow-glow`** — a brass-tinted glow (`0 0 0 1px rgba(232,163,61,0.25),
  0 0 24px -4px rgba(232,163,61,0.35)`), reserved for emphasizing an
  actively-focused or actively-important element (not yet heavily used —
  candidate for hover states on primary CTAs).

## 5. Component conventions

Defined once in `styles/globals.css` under `@layer components`, consumed
everywhere as plain class names — never re-implemented ad hoc per page:

```css
.card         /* bg-surface, border, rounded-lg, shadow-vault */
.btn          /* base: inline-flex, centered, gap-2, rounded, text-sm, disabled state */
.btn-primary  /* .btn + brass background */
.btn-ghost    /* .btn + transparent bg, bordered */
.btn-danger   /* .btn + danger-tinted */
.input        /* w-full, ink-soft background, border, rounded, focus:border-brass-400 */
```

**Rule:** any new button/input/card should use these classes, not
one-off Tailwind combinations, so a future palette or radius change
propagates everywhere automatically.

## 6. Iconography

`react-icons/fi` (Feather icons) exclusively — thin, consistent stroke
weight matches the overall restrained, technical aesthetic. Icon sizes are
typically `13–16px` inline with text, `18–28px` for standalone icon
buttons/avatars. Don't mix in a second icon set.

## 7. Motion

Two custom keyframes, used sparingly and specifically:

- **`animate-fade-up`** (`0.35s ease-out`) — page-level content entrance
  (used on the main dashboard content area on route change). Small
  vertical offset (6px) + opacity fade, not a large slide.
- **`animate-dial-tick`** (`2.4s ease-in-out infinite`) — a subtle rotating
  tick on the vault-dial logomark, reinforcing the brand's
  mechanical-vault metaphor at idle.

**Accessibility:** both are disabled via a global
`prefers-reduced-motion: reduce` media query in `globals.css` (durations
collapsed to near-zero) — any new animation must respect this same query
rather than adding its own opt-out.

## 8. Layout patterns

### 8.1 Auth pages (`AuthLayout`)
Split-screen on desktop (`lg:grid-cols-2`): a left panel with a lazy-loaded
Three.js scene (`AuthScene3D`, code-split so it doesn't block the form) plus
brand copy, and a right panel with the actual form, capped at `max-w-sm`.
**The left panel is `hidden` below `lg`** — on mobile it's just the form,
centered, full-width up to `max-w-sm`, with `p-6` (growing to `p-12` on
larger screens). This was already mobile-correct from early in the project.

### 8.2 App shell (`DashboardLayout`)
Sidebar + Navbar + main content area. This is the one place where the
mobile/desktop behavior genuinely diverges rather than just reflowing:

- **Desktop (`lg` and up):** `Sidebar` is a normal static, sticky, in-flow
  element (`lg:static lg:sticky lg:top-0`), always visible, 256px wide.
- **Mobile (below `lg`):** `Sidebar` becomes a `fixed`, full-height,
  off-canvas drawer (`translate-x-0` / `-translate-x-full` toggle), opened
  by a hamburger button in `Navbar` (only rendered below `lg`) and closed by
  tapping a backdrop overlay or selecting a nav item. This is a genuine mode
  switch, not just a breakpoint-driven resize — treat it as such if you're
  modifying `Sidebar.tsx` or `Navbar.tsx`.
- Main content padding is responsive (`p-4` mobile → `p-6` desktop). Any
  page that uses the `-mx-{n} px-{n}` "full-bleed sticky toolbar" trick
  (see Notes/Snippets/Projects list pages) must mirror this exact padding
  value at each breakpoint, or the toolbar will misalign against the page
  content beneath it.

## 9. Responsive & touch design rules

Established (and, in places, retrofitted) during this project's mobile
pass — treat these as binding rules for new UI, not just historical notes:

1. **No hover-only affordances.** Any control that reveals itself via CSS
   `:hover` (e.g. a delete icon that fades in on card hover) must default to
   visible below the `sm` breakpoint and can be hover-gated only from `sm:`
   up (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`). Touchscreens
   have no hover state — a hover-only control is simply unreachable on
   mobile, not just harder to find.
2. **No HTML5 drag-and-drop without a non-drag equivalent.** `draggable`
   doesn't fire on touch. Anywhere drag-and-drop is the primary interaction
   (the Kanban board), provide an alternate control that achieves the same
   result (the task card's "Move to…" `<select>`).
3. **No fixed-pixel-width controls in a toolbar row.** Search inputs,
   selects, and buttons that sit side-by-side in a header/toolbar must
   either be capped with a responsive width (`w-full sm:w-48`) or the
   container must `flex-wrap`, so three controls that fit comfortably on a
   1280px screen don't force horizontal overflow at 375px.
4. **Modals are `w-full max-w-{size}` with outer `p-4`, never a fixed
   pixel width.** This is already the convention (`NewNoteModal`,
   `SnippetModal`, etc.) — keep it for any new modal.
5. **Defensive `overflow-x: hidden`** is set globally on `html`/`body` as a
   safety net, but this is a backstop, not a substitute for #3 — new
   layouts should still be built to not overflow in the first place.
6. **Dropdowns/popovers anchored to a screen edge should cap their width
   relative to viewport**, not just declare a fixed `w-*` (see the
   notifications panel: `w-[calc(100vw-1.5rem)] max-w-80`), so they can't
   run off-screen on the narrowest supported phones (~320px).

## 10. Dark/light mode

`darkMode: 'class'` — dark is the default/primary experience (this is a
developer tool; most users will stay in dark mode), light is a fully
supported alternative, not an afterthought, toggled via `ThemeToggle` in the
Navbar and persisted in `themeStore` (Zustand, persisted to storage). Every
semantic color token in §2.1 has a defined light-mode value — never assume
dark-only when adding new UI; use the semantic tokens and both themes stay
correct for free.
