# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Vite, port 5174)
npm run build        # Type-check then build for production
npm run test         # Run Vitest unit tests once
npm run test:watch   # Run unit tests in watch mode
npm run typecheck    # Type-check without building
```

To run a single unit test file: `npx vitest run src/stores/projection.test.ts`

**E2E tests (Playwright):**
```bash
npx playwright test                          # Run all e2e tests (requires dev server)
npx playwright test e2e/settings.spec.ts     # Run a single spec file
npx playwright test --grep "save scenario"   # Run tests matching a pattern
npx playwright show-report                   # Open HTML report after a run
```

E2E tests require the dev server running on `http://localhost:5174` (started automatically via `webServer` in `playwright.config.ts`). Auth is injected via `e2e/auth.setup.ts` which auto-refreshes a hardcoded Supabase refresh token — no env var needed.

## Git Workflow

- **Branches:** `dev` (active development) → `staging` → `main` (production). Always work on `dev`.
- Never push directly to `main`. Promote via PRs: `dev` → `staging` → `main`.
- Only push when explicitly asked. CI (typecheck + test + build) runs automatically on all branches.
- Vercel auto-deploys: `main` = production, `staging`/`dev` = preview URLs.

## Database & Migrations

- Schema in `supabase/migrations/`, numbered sequentially (`001_`, `002_`, …).
- All tables require Row Level Security policies. The `handle_new_user()` trigger auto-creates `profiles` and `projection_inputs` rows on signup.
- Migrations run manually in **Supabase Dashboard > SQL Editor** — there is no CLI migration tooling set up.
- New tables/columns → add corresponding functions in `src/services/database.ts`.
- For Supabase Realtime to evaluate cross-table RLS policies (e.g. `collaborations` joins), tables need `REPLICA IDENTITY FULL` (see migration `009_`).

## Architecture

Vue 3 SPA · Pinia stores · PrimeVue 4 + Tailwind CSS · Yup validation · Supabase (Postgres + Auth + Realtime)

**Auth & data flow:**
1. `useAuth` (module-level singleton) resolves the Supabase session on mount
2. Router guard in `src/router/index.ts` awaits `initialize()` then redirects to `/login` if no user
3. `App.vue` watches `user` — on login calls `hydrate()` on both stores, on logout calls `reset()`/`resetStore()` and clears pending debounce timers before redirecting
4. Both stores debounce-write to Supabase but only after `isReady` is true (set by `hydrate()`) to avoid overwriting DB with defaults on startup

**Key domain types** (`src/models/index.ts`):
- `ProjectionInputs` — the three editable numbers (income, expenses, months)
- `ProjectionScenario` — named snapshot of inputs; stored in DB
- `ProjectionRow` — one derived month of the table; never stored
- `UiStateSnapshot` — theme, locale, currency, start month; stored in `profiles` table

**Computation is pure and stateless** — `src/services/projectionService.ts` takes inputs and returns rows, summary, milestones, SVG trend path, and share text. Nothing in services touches stores or Supabase.

**Collaboration store** (`src/stores/collaboration.ts`):
- Manages collaborators, shared budgets, activity log, and the active budget context (whose data is being viewed)
- `activeBudgetContext` — when non-null, the user is viewing another owner's budget; `isViewingSharedBudget` / `isReadOnly` are computed from this
- `startRealtime(ownerId)` subscribes to a single Supabase channel `budget:{ownerId}` covering `projection_inputs`, `scenarios`, `expense_items`, and `collaborations` tables via `postgres_changes`, plus a `Broadcast` channel for profile updates
- **Important:** profile currency/locale updates use Broadcast (not `postgres_changes`) because cross-table RLS makes `postgres_changes` on `profiles` unreliable for collaborators. The owner calls `broadcastProfileUpdate()` after saving; collaborators receive `profile_updated` events and update `activeBudgetContext`

**ProjectionsView form sync pattern:**
`ProjectionsView.vue` initialises a local `form` reactive object from the store on setup. A `watch(() => projectionStore.inputs, ...)` keeps the form in sync when the store changes externally (scenario load, realtime update). Without this watch, loading a scenario would not update the visible form fields.

**Component structure:**
- `src/components/app/AppShell.vue` — layout shell (sidebar, mobile top bar + bottom tabs); used as a layout route wrapping all authenticated pages
- `src/components/shared/` — reusable UI: `CurrencyInput`, `EmptyState`, `ConfirmDeleteDialog`, `DialogHeader`, `StatusMessage`, `ExchangeRatesPanel`
- `src/components/dashboard/` — `TrendChart`, `MilestonesCard`
- `src/components/projections/` — `ProjectionTable`, `ExpensesDialog`
- `src/components/scenarios/` — `ScenarioCard`

**CSS / styling:**
- Design tokens are CSS custom properties defined in `src/style.css` (e.g. `--app-bg`, `--app-accent`, `--app-border`)
- Dark mode via `html.app-dark` selector; PrimeVue dark mode selector set to `.app-dark`
- Use Tailwind for layout/spacing; use `.text-primary`, `.text-secondary`, `.divider`, `.border-app`, `.bg-surface` utility classes (defined in `style.css`) instead of inline `style=""` for token-based colors
- PrimeVue component overrides are in the `/* PrimeVue overrides */` section of `style.css`

**CurrencyInput** (`src/components/shared/CurrencyInput.vue`) wraps PrimeVue `InputNumber` with a currency symbol addon. It enforces `min="0"` but has no upper bound — validation limits are enforced by the Yup schema in `src/validation/forms.ts`, which fires via the `syncProjection()` watcher in `ProjectionsView`.

**ExpensesDialog** uses a local `draft` array; items are only committed to the store when the user explicitly clicks **Save**. Closing via Escape or the Cancel button discards unsaved changes.

**Exchange rates** (`useExchangeRates`) — module-level singleton, fetches from jsDelivr CDN with Cloudflare Pages fallback, 1-hour cache TTL. Returns rates relative to EUR; `convert()` cross-multiplies via EUR.

**Testing:**
- Unit test files co-locate with source (`*.test.ts`). Vitest runs in jsdom with globals — no need to import `describe`/`it`/`expect`. Supabase client falls back to placeholder URL/key when env vars are missing, so unit tests run without `.env.local`.
- E2E test files live in `e2e/`. Vitest is configured to exclude `e2e/**` so the two test runners don't conflict.
- E2E tests use `injectSupabaseSession` (from `e2e/auth.setup.ts`) in `beforeEach` to authenticate before each test — call `loginAndGo(page, '/route')` helper instead of `page.goto` directly.

## Environment Variables

Required in `.env.local`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
