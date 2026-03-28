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

## Git Workflow

- **Branches:** `dev` (active development) → `staging` (pre-release) → `main` (production)
- **Always work on `dev`** unless told otherwise. Never push directly to `main`.
- **Commit often** with clear messages. Push to `dev` when a feature or fix is complete.
- **Promotions:** merge `dev` → `staging` → `main` via PRs only.
- **CI runs automatically** on push/PR to all three branches (typecheck, test, build).
- Vercel auto-deploys: `main` = production, `staging`/`dev` = preview URLs.

## Database & Migrations

- Schema lives in `supabase/migrations/`. Files are numbered sequentially (e.g. `001_`, `002_`).
- All tables use Row Level Security (RLS). Always add policies for new tables.
- New migrations must be run manually in **Supabase Dashboard > SQL Editor**.
- The `handle_new_user()` trigger auto-creates `profiles` and `projection_inputs` rows on signup.
- When adding new tables/columns, update `src/services/database.ts` with corresponding CRUD functions.

## Architecture

Vue 3 SPA with Composition API, Pinia stores, PrimeVue + Tailwind for UI, Yup for validation, Supabase for backend.

**Data flow:**
1. User authenticates via Google OAuth (`useAuth` composable → Supabase Auth)
2. Router auth guard blocks unauthenticated access; redirects to `/login`
3. After auth, stores `hydrate()` from Supabase database
4. User inputs are validated via Yup schemas (`src/validation/forms.ts`)
5. `useProjectionStore` and `useUiStore` (Pinia) hold reactive state and debounce-save to Supabase
6. Pure computation functions in `src/services/projectionService.ts` derive rows, summaries, milestones, and SVG trend paths

**Key concepts:**
- `ProjectionInputs` — the three user-editable numbers (income, expenses, months)
- `ProjectionScenario` — a named snapshot of inputs that can be saved, loaded, renamed, overwritten, exported, and imported
- `ProjectionRow` — one month of the derived projection table (computed from inputs, never stored)
- `UiStateSnapshot` — theme, locale, currency, selected start month; persisted separately from projection data
- Dark mode is toggled by adding/removing the `app-dark` CSS class on `<html>`; PrimeVue uses this selector

**Module layout:**
- `src/models/index.ts` — all shared TypeScript interfaces/types
- `src/stores/` — Pinia stores (projection state + UI state), sync to Supabase
- `src/services/projectionService.ts` — stateless projection math
- `src/services/database.ts` — Supabase CRUD operations (profiles, inputs, scenarios)
- `src/composables/useAuth.ts` — Google OAuth session management (module-level singleton)
- `src/composables/useCurrency.ts` — currency formatting
- `src/composables/useExchangeRates.ts` — live ECB exchange rates (module-level singleton)
- `src/lib/supabase.ts` — Supabase client singleton
- `src/validation/forms.ts` — Yup schemas and `buildErrorMap` helper
- `src/data/mockData.ts` — seed/default values used by stores and tests
- `src/router/index.ts` — routes with AppShell layout wrapper + auth guard

**Testing:** Test files co-locate with source (e.g. `useCurrency.test.ts`). Vitest runs in jsdom environment with globals enabled — no explicit imports for `describe`/`it`/`expect`.

## Environment Variables

Required in `.env.local` (never commit):
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — Supabase publishable key
