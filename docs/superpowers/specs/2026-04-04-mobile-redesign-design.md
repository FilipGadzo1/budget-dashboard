# Mobile Redesign — Floating Finance

**Date:** 2026-04-04  
**Status:** Approved

## Aesthetic Direction

**Tone:** Refined luxury fintech — precision without coldness, premium without pomposity.  
**Differentiator:** The floating pill nav + DM Mono numbers. Every screen makes money feel real and significant.

---

## Typography

- **UI / Labels / Navigation:** `DM Sans` (Google Fonts, weights 400/500/600)
- **Financial Numbers:** `DM Mono` (Google Fonts, weights 400/500) — all currency amounts, percentages, balances
- Import once in `style.css` via Google Fonts `@import`
- Mobile-only: applies only inside `@media (max-width: 1023px)` to avoid changing desktop

---

## Navigation Chrome

### Floating Pill Bottom Nav

Replaces the flat 64px bottom bar.

- `position: fixed; bottom: calc(1.25rem + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%)`
- Shape: fully rounded pill (`border-radius: 100px`)
- Width: auto, `padding: 0.375rem`, inner gap `0.25rem`
- Background: `var(--app-surface)` + `backdrop-filter: blur(24px)`
- Border: `1px solid var(--app-border)`
- Shadow: `0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)`
- Each tab: 52×52px circle, icon only (no labels), `font-size: 1.25rem`
- Active tab: filled circle with `var(--app-accent)` background, white icon
- Collaboration tab: small red dot badge in top-right corner when invites pending
- Transition: `all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)` (spring overshoot)

### Mobile Top Bar

Replaces the flat 56px header.

- Height: 60px
- Left: `sidebar-logo` (28px) + **current page title** (dynamic, from route)
- Right: theme toggle icon + avatar circle (tapping opens sidebar drawer)
- Bottom: no border — replaced by a `1px` gradient line (`--app-accent` to transparent)
- The page title changes per route using a lookup from `navItems`
- Font: DM Sans 600, 1rem

### Sidebar Drawer

Unchanged structure, minor visual polish:
- Smooth slide-in: `transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)`
- Add subtle gradient overlay at the top of the nav list (fade mask)

---

## Main Content Adjustments

- Top padding: `calc(60px + 1rem)` (was `calc(56px + 0.75rem)`)
- Bottom padding: `calc(1.25rem + 52px + 0.375rem + env(safe-area-inset-bottom) + 1.25rem)` ≈ accounts for floating pill + its bottom offset

---

## Page-by-Page Mobile Layouts

### Dashboard

- **Hero zone** (top): Full-width card with gradient background (`var(--app-accent-soft)` → transparent). Shows primary net balance for current month in DM Mono large (2rem+), labelled "This month".
- **KPI strip**: Horizontal scroll row (`overflow-x: auto; scroll-snap-type: x mandatory`), each KPI card is 160px wide snap item. No grid.
- **Chart**: Full-width, slightly taller on mobile (200px instead of 160px).
- **Insights**: Shown below chart as normal stacked cards (not hidden).

### Projections

- Form inputs stack to single column.
- Income, Expenses, Months fields get `font-family: DM Mono` on the input value.
- Projected net shown prominently between form and table.
- Table: horizontal scroll container, sticky first column (month label).

### Savings

- Summary strip: 2×2 grid instead of horizontal row (wraps on small screens).
- Goal cards: progress bar becomes taller (8px → 12px). 
- Current/Target amounts in DM Mono.
- "Deposit" and "Use required" buttons: full-width at bottom of card.
- Chips (meta row): allow wrapping freely, no overflow.

### Scenarios

- Toolbar: name input full-width, action buttons in a 2-column grid below.
- Import/export: icon buttons only on mobile (hide text labels).
- Scenario cards: full-width, stacked.

### Collaboration

- Already single-column on mobile — refine spacing.
- Invite form: full-width input + button stacked.
- Collaborator rows: tighter, avatar + name + role pill + action button.

### Settings

- All selects full-width.
- Section headings more prominent (DM Sans 600, slight letter-spacing).
- Theme toggle buttons: 2-column grid.

---

## Motion

- Page enter: `@keyframes fadeUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }` applied to `.page-container` with `animation: fadeUp 0.25s ease both`
- Nav active indicator: spring easing `cubic-bezier(0.34, 1.56, 0.64, 1)` on background/color transitions
- Sidebar: cubic-bezier slide, 300ms

---

## CSS Variables Added (mobile scope)

```css
--mobile-hero-gradient: linear-gradient(135deg, var(--app-accent-soft) 0%, transparent 70%);
--mobile-nav-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
```

---

## Testing

### Delete
- All `e2e/screenshots/` files that are stale (any mobile screenshots from prior implementation)
- E2E tests in `e2e/app-tour.spec.ts` that only take screenshots without asserting

### Add
- E2E: Mobile viewport (390×844) tests for:
  - Floating nav renders and all 5 tabs are visible/tappable
  - Active tab is highlighted correctly per route
  - Sidebar opens/closes via top bar avatar tap
  - Collaboration badge appears when pending invites > 0
  - Page content is not obscured by the floating nav (scroll test)
- Unit: No new unit tests needed (no JS logic changed)

---

## Files Changed

| File | Change |
|------|--------|
| `src/style.css` | Add DM Sans/DM Mono imports, rewrite all `.mobile-*` CSS, add `fadeUp` animation, floating nav styles |
| `src/components/app/AppShell.vue` | New top bar (dynamic title), floating pill nav, sidebar polish |
| `src/views/DashboardView.vue` | Hero zone, horizontal KPI scroll |
| `src/views/ProjectionsView.vue` | Mobile form layout, DM Mono inputs |
| `src/views/SavingsView.vue` | Summary grid, card improvements |
| `src/views/ScenariosView.vue` | Toolbar rework, mobile buttons |
| `src/views/CollaborationView.vue` | Spacing refinements |
| `src/views/SettingsView.vue` | Full-width selects, section headings |
| `e2e/` | Delete stale screenshots, add mobile interaction tests |
