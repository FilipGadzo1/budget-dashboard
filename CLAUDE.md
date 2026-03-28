# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Vite)
npm run build        # Type-check then build for production
npm run test         # Run tests once (Vitest)
npm run test:watch   # Run tests in watch mode
npm run typecheck    # Type-check without building
```

To run a single test file: `npx vitest run src/stores/projection.test.ts`

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

## Architecture

Vue 3 SPA · Pinia stores · PrimeVue 4 + Tailwind CSS · Yup validation · Supabase (Postgres + Auth)

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

**Component structure:**
- `src/components/app/AppShell.vue` — layout shell (sidebar, mobile top bar + bottom tabs); used as a layout route wrapping all authenticated pages
- `src/components/shared/` — reusable UI: `EmptyState`, `ConfirmDeleteDialog`, `DialogHeader`, `StatusMessage`, `ExchangeRatesPanel`
- `src/components/dashboard/` — `TrendChart`, `MilestonesCard`
- `src/components/projections/` — `ProjectionTable`
- `src/components/scenarios/` — `ScenarioCard`

**CSS / styling:**
- Design tokens are CSS custom properties defined in `src/style.css` (e.g. `--app-bg`, `--app-accent`, `--app-border`)
- Dark mode via `html.app-dark` selector; PrimeVue dark mode selector set to `.app-dark`
- Use Tailwind for layout/spacing; use `.text-primary`, `.text-secondary`, `.divider`, `.border-app`, `.bg-surface` utility classes (defined in `style.css`) instead of inline `style=""` for token-based colors
- PrimeVue component overrides are in the `/* PrimeVue overrides */` section of `style.css`

**Exchange rates** (`useExchangeRates`) — module-level singleton, fetches from jsDelivr CDN with Cloudflare Pages fallback, 1-hour cache TTL. Returns rates relative to EUR; `convert()` cross-multiplies via EUR.

**Testing:** Test files co-locate with source. Vitest runs in jsdom with globals — no need to import `describe`/`it`/`expect`. Supabase client falls back to placeholder URL/key when env vars are missing, so tests run without `.env.local`.

## Environment Variables

Required in `.env.local`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
