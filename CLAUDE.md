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

## Architecture

Vue 3 SPA with Composition API, Pinia stores, PrimeVue + Tailwind for UI, Yup for validation.

**Data flow:**
1. User inputs are validated via Yup schemas (`src/validation/forms.ts`)
2. `useProjectionStore` and `useUiStore` (Pinia) hold reactive state
3. Both stores auto-persist to `localStorage` via `useLocalStorageSync` composable — state is wrapped in a versioned envelope `{ version, data }` to support future migrations
4. Pure computation functions in `src/services/projectionService.ts` derive rows, summaries, milestones, and SVG trend paths from `ProjectionInputs`

**Key concepts:**
- `ProjectionInputs` — the three user-editable numbers (income, expenses, months)
- `ProjectionScenario` — a named snapshot of inputs that can be saved, loaded, renamed, overwritten, exported, and imported
- `ProjectionRow` — one month of the derived projection table (computed from inputs, never stored)
- `UiStateSnapshot` — theme, locale, currency, selected start month; persisted separately from projection data
- Dark mode is toggled by adding/removing the `app-dark` CSS class on `<html>`; PrimeVue uses this selector

**Module layout:**
- `src/models/index.ts` — all shared TypeScript interfaces/types
- `src/stores/` — Pinia stores (projection state + UI state)
- `src/services/projectionService.ts` — stateless projection math (rows, summary, milestones, trend SVG path, share text)
- `src/composables/` — `useLocalStorageSync` (persistence), `useCurrency` (formatting), `useFormSchemas` (form wiring)
- `src/validation/forms.ts` — Yup schemas and `buildErrorMap` helper
- `src/lib/storageKeys.ts` — centralised `localStorage` key constants
- `src/data/mockData.ts` — seed/default values used by stores and tests

**Testing:** Test files co-locate with source (e.g. `useLocalStorageSync.test.ts`). Vitest runs in jsdom environment with globals enabled — no explicit imports for `describe`/`it`/`expect`.
