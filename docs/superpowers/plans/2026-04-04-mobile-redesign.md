# Mobile Redesign Implementation Plan

**Spec:** `docs/superpowers/specs/2026-04-04-mobile-redesign-design.md`

---

## Phase 1 (Parallel)

### Task A — Global CSS
**File:** `src/style.css`

1. Add Google Fonts import at top: `DM Sans` (400,500,600) + `DM Mono` (400,500)
2. Add CSS variables: `--mobile-hero-gradient`, `--mobile-nav-shadow`
3. Add `@keyframes fadeUp` and `.page-container` animation (mobile only)
4. Rewrite `.mobile-topbar` CSS: height 60px, gradient bottom border, DM Sans font
5. Rewrite `.mobile-tabs` CSS: floating pill (fixed, centered, auto-width, pill shape, blur, shadow)
6. Rewrite `.mobile-tabs-inner`: flex row, gap 0.25rem, auto height
7. Rewrite `.mobile-tab`: 52×52px circle, icon-only (font-size: 1.25rem, no label text)
8. Rewrite `.mobile-tab-active`: accent background, white icon
9. Update `.mobile-tab-badge` position for icon-only layout
10. Update `@media (max-width: 1023px)` main content padding (top: 60px+1rem, bottom: accounts for floating nav)
11. Remove `.mobile-tab-icon` separate class (icon is the whole tab now)
12. Add mobile DM Mono override: `.tabular-nums` on mobile uses DM Mono

### Task B — Delete Stale Tests
**Files:** `e2e/screenshots/`, `e2e/app-tour.spec.ts`

1. Delete all files in `e2e/screenshots/` (stale visual regression shots)
2. In `e2e/app-tour.spec.ts`: remove screenshot-only tests that don't assert anything functional

---

## Phase 2 (Parallel, after Phase 1)

### Task C — AppShell
**File:** `src/components/app/AppShell.vue`

1. Add `currentPageTitle` computed: looks up current route in navItems, returns label
2. Top bar template: replace static "Budget" text with `{{ currentPageTitle }}`; replace hamburger button with avatar circle (user initials or avatar_url); keep theme toggle
3. Floating pill nav: remove label text from each `.mobile-tab` (icon only); update tab loop to use `mobileTabItems`; badge stays on collab tab
4. Sidebar: add `transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)` in scoped style
5. Scoped CSS: add avatar button styles, gradient bottom border for top bar

### Task D — Dashboard View
**File:** `src/views/DashboardView.vue`

1. Read current template structure
2. Add a hero zone section (mobile only via `class` + CSS): shows current month net with DM Mono large number, gradient background using `--mobile-hero-gradient`
3. Wrap KPI cards in a horizontal scroll container with snap scrolling on mobile
4. Ensure insights section is visible on mobile (remove any `hidden-mobile` classes)
5. Add scoped mobile CSS for hero zone and KPI scroll strip

### Task E — Projections + Savings Views
**Files:** `src/views/ProjectionsView.vue`, `src/views/SavingsView.vue`

**Projections:**
1. Ensure form inputs stack single column on mobile (verify existing grid classes)
2. Add DM Mono font-family to currency input values via scoped CSS on mobile
3. Check table has horizontal scroll wrapper

**Savings:**
1. Change summary strip to 2×2 grid on mobile via scoped CSS
2. Increase progress bar height to 12px on mobile
3. Make Deposit + "Use required" buttons full-width on mobile
4. Ensure DM Mono on all amount displays

### Task F — Scenarios + Collaboration + Settings
**Files:** `src/views/ScenariosView.vue`, `src/views/CollaborationView.vue`, `src/views/SettingsView.vue`

**Scenarios:**
1. Name input full-width on mobile
2. Action buttons 2-column grid
3. Import/export: icon-only buttons on mobile

**Collaboration:**
1. Tighten spacing, ensure single-column
2. Full-width invite form

**Settings:**
1. Selects full-width
2. Theme buttons 2-column grid
3. Section headings DM Sans 600

---

## Phase 3

### Task G — New Mobile Tests
**File:** `e2e/mobile-nav.spec.ts` (new file)

Write E2E tests at 390×844 viewport:
1. All 5 floating nav tabs visible and not clipped
2. Clicking each tab navigates to correct route and applies active style
3. Sidebar opens when avatar is tapped, closes on overlay click
4. Collaboration badge appears when store has pending invites (mock via localStorage or direct navigation)
5. Page content bottom is not obscured by floating nav (check scroll reach)
