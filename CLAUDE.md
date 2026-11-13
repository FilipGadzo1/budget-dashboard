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

E2E tests require the dev server running on `http://localhost:5174` (started automatically via `webServer` in `playwright.config.ts`). They sign in as a dedicated test user with email + password, read from the environment by `e2e/auth.setup.ts`: `E2E_SUPABASE_URL`, `E2E_SUPABASE_KEY`, `E2E_EMAIL`, `E2E_PASSWORD`. When any is missing the authenticated tests skip. Never commit credentials or tokens to `e2e/`.

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
- `ProjectionInputs` — income, expenses, months, `expenseItems[]`, `monthlyAdjustments[]`, and `savingsAdjustments[]` (see Savings section below)
- `ProjectionScenario` — named snapshot of inputs; stored in DB
- `ProjectionRow` — one derived month of the table; never stored. Fields include `incomeAdjustment`, `expenseAdjustment` (user one-time only), and `savingsContribution` (savings goals portion, kept separate)
- `UiStateSnapshot` — theme, locale, currency, start month; stored in `profiles` table

**Computation is pure and stateless** — `src/services/projectionService.ts` takes inputs and returns rows, summary, milestones, and share text. Nothing in services touches stores or Supabase.

**Row mapping** — `src/services/mappers.ts` is the only place database rows / JSON columns are turned into domain models. Fetches, Realtime payloads and broadcasts all use it; do not hand-map rows elsewhere.

**Defaults and options** — `src/data/defaults.ts` holds the default inputs/UI state and the currency and locale option lists.

**Preferences have one home each** — currency and locale are edited only in `SettingsView`; the forecast window (start and end month) only in `ForecastView`.

**Multi-currency** (`src/services/currencyService.ts`) — every stored amount keeps the currency it was entered in; nothing is rewritten when rates move.
- Income/expense items and monthly adjustments have an optional `currency`; `ProjectionInputs.currency` is the base currency (plain `monthlyIncome`/`monthlyExpenses` fields, and the fallback for untagged items). A `SavingsGoal` has a `currency`; its deposits are in it.
- `profiles.currency_code` (`useCurrency().currencyCode`) is the **display** currency only. `toDisplayInputs` / `toDisplayGoal` / `toDisplayDeposits` convert on the way to the screen; `useEffectiveProjection` applies them, so projection maths always runs on single-currency inputs.
- Changing the display currency in Settings calls `rebaseInputs`, which converts only the two plain fields and stamps untagged items with the old base currency.
- Rates come from `useExchangeRates` (fetched on app start, last good set cached in localStorage). `convert()` returns the amount unchanged when a rate is missing — `useEffectiveProjection().unconvertibleCurrencies` drives the warning.
- A goal's currency can be changed when editing it, either converting (the `change_goal_currency` RPC, migration `015_`, converts the goal and all its deposits atomically) or relabelling (plain update of `currency`).
- Never sum raw item amounts in a view; use `baseTotals` / `monthlyTotals(toDisplayInputs(...))`.

**Save errors** — write functions in `src/services/` call `reportSaveError()` (`src/lib/notify.ts`); `App.vue` shows the result as a toast. Do not swallow write failures with `console.warn`.

**The month being looked at** (`useTimeTravel`, `useEffectiveProjection`):
- Clicking a month in a `LineChart`, the `MonthStrip` or a `ProjectionTable` row makes it the month the app is looking at (`useTimeTravel().focus(index)`; module singleton, never saved). Overview, Forecast and Savings each have a link back to the end of the plan / today.
- `focusIdx` / `focusRow` (from `useEffectiveProjection`) are that month — the last month when none is picked; `hasFocus` says whether one is. `goalAmountAt(goal)` is what a goal holds in that month, in the goal's own currency (today's amount when no month is picked), from `buildGoalBalances` in `savingsProjectionService`.
- There is no time bar and no what-if layer (both were removed): `rows` is always the saved plan.

**Collaboration store** (`src/stores/collaboration.ts`):
- Manages collaborators, shared budgets, activity log, and the active budget context (whose data is being viewed)
- `activeBudgetContext` — when non-null, the user is viewing another owner's budget; `isViewingSharedBudget` / `isReadOnly` are computed from this
- `startRealtime(ownerId)` subscribes to a single Supabase channel `budget:{ownerId}` covering `projection_inputs`, `scenarios`, `expense_items`, and `collaborations` tables via `postgres_changes`, plus a `Broadcast` channel for profile updates
- **Important:** profile currency/locale updates use Broadcast (not `postgres_changes`) because cross-table RLS makes `postgres_changes` on `profiles` unreliable for collaborators. The owner calls `broadcastProfileUpdate()` after saving; collaborators receive `profile_updated` events and update `activeBudgetContext`

**Money model** (`src/services/projectionService.ts`, `src/services/savingsProjectionService.ts`):
- The projection tracks **cash** and **savings** separately. `ProjectionInputs.startingBalance` (with `startingBalanceCurrency`) is the cash on hand when the projection begins; it is stored on `projection_inputs` only and is deliberately **not** part of a scenario — `loadScenario` keeps the current value.
- Savings are a **transfer, not an expense**. A contribution moves money from cash to savings and leaves net worth unchanged. `ProjectionRow` has `expenses` (spending only), `net` (income − expenses), `savingsContribution`, `cashChange` (net − contribution), `cumulativeBalance` (cash), `savingsBalance` and `netWorth` (cash + savings).
- `SavingsGoal` has `monthlyContribution` and `targetDate` (nullable ISO date). `buildSavingsContributionAdjustments(goals, startMonth, months)` returns the planned transfers per month: a goal contributes while `status === 'active'`, its target date has not passed, and it has not reached its target (the last contribution is trimmed to land exactly on target).
- `savingsStartingBalance(goals)` (sum of every goal's `currentAmount`) is the opening savings balance. Recorded **deposits are history**: they are already in `currentAmount` and are not replayed as cash movements in the projection.
- `useEffectiveProjection` puts both on the inputs as the system-generated fields `savingsAdjustments` and `savingsStartingBalance`, separate from the user's `monthlyAdjustments`.
- In `ProjectionTable`, a month with a transfer shows a blue (`--chart-2`) sub-line under **Cash** written as a deduction ("−€400 to savings") — blue because it is neither a gain (green) nor a loss (red); a legend under the table explains it. The **Net worth** column appears only when the budget has savings (`showNetWorth`). User one-time adjustments keep the amber dot/delta (`row.expenseAdjustment !== 0`). Rows are grouped under a header per calendar year showing that year's net.

**Recurring items and categories** (`src/services/itemsService.ts`):
- `BudgetItem` is the shared shape of income and expense items (`ExpenseItem` adds `sortOrder`). An item has optional `everyMonths` (1 = monthly, 12 = yearly), `startMonth` / `endMonth` (YYYY-MM, inclusive) and, for expenses, `category`. For non-monthly items `startMonth` is also the anchor month.
- `buildProjectionRows` sums itemised budgets **month by month** with `amountIn`, so a yearly bill lands in one month and a loan stops when it ends. Never assume income or expenses are constant across rows.
- `monthlyTotals(inputs, monthKey)` and `expensesByCategory` use the **monthly equivalent** (a yearly bill counts for a twelfth) of items live in that month — that is the "average per month" shown in the config panel, scenario cards and the dashboard category card.
- `ItemsDialog` (`src/components/projections/`) is the single dialog for both income sources and expense items (`kind` prop). It uses a local `draft`; nothing reaches the store until **Save**.
- `useEffectiveProjection().projectPlan(inputs)` projects any inputs (e.g. a saved scenario) from the current starting balance and savings; `ScenarioComparison` uses it to compare plans.

**Projection window** — the store keeps a start month (`profiles.selected_month`) and a length (`ProjectionInputs.months`, 1–60). The UI shows a start month and an **end month**; `ForecastView` derives the end from those and converts edits back to `months` (`addMonthsToKey` / `monthsBetween` in `src/utils/date.ts`). Moving the start keeps the end fixed.

**Amount display** — the forecast table and the Savings list show compact amounts (`formatCompactCurrency` / `formatCompactMoney`, e.g. €5.9K) with the exact figure in a `title` tooltip. Inputs and dialogs always show exact amounts.

**Typecheck** — `npm run typecheck` runs `vue-tsc --noEmit -p tsconfig.app.json`. The root `tsconfig.json` only has project references, so plain `vue-tsc --noEmit` checks nothing.

**PlanView form sync pattern:**
`PlanView.vue` initialises a local `form` reactive object (the plain monthly income / expenses fields) from the store on setup. A `watch(() => projectionStore.inputs, ...)` keeps the form in sync when the store changes externally (scenario load, realtime update). Without this watch, loading a scenario would not update the visible fields.

**Component structure:**
- `src/components/app/AppShell.vue` — the frame around every signed-in page. Desktop: a **top bar** (Overview, Plan, Forecast, Savings, Scenarios; then Search and the account avatar, which opens `AccountMenu` — Sharing and Settings live only there) and the page. The frame (`.app-frame`) is exactly one screen tall. Phone: a top bar with the page name, the page (which scrolls) and the tab bar. A pending invite shows as a dot on the avatar and a count on Sharing inside the menu.
- `src/components/app/CommandPalette.vue` — Ctrl/⌘ K (the shell owns the shortcut; `useCommandPalette` holds the open state). Jumps to pages and runs actions. Actions that open a dialog on another page navigate with a query flag (`/plan?edit=income|expense`, `/savings?new=1`) which the page reads once and clears.
- `src/components/app/AppLogo.vue` — the app mark (forecast line). `public/favicon.svg` is the same drawing; change both together.
- `src/components/shared/` — reusable UI: `LineChart` (the app's one line chart: any series over the forecast months, fills its container, hover readout, a marker on the looked-at month; clicking or the arrow keys select a month), `MonthStrip` (one cell per month shaded by net; click selects it), `GoalRing`, `Sparkline`, `MoneyFlow` (an amount whose digits roll when it changes — for totals and short lists; never one per cell of a long table), `DatePickerField` (the only calendar control — wraps PrimeVue `DatePicker` with a string model, `mode="month"` → `YYYY-MM`, `mode="date"` → `YYYY-MM-DD`; do not use native `<input type="month|date">`), `CurrencyInput`, `EmptyState`, `ConfirmDeleteDialog`, `DialogHeader`, `StatusMessage`, `ExchangeRatesPanel`
- `src/components/dashboard/` — `NextSteps` ("Worth a look": problems, then things to set up, then good news; also reused on Plan with another title; `compact` for short cards), `GoalsSnapshot` (every goal as a ring row; the list scrolls inside the card), `GettingStarted` (first-run guide)
- `src/components/plan/` — `SankeyFlow` (money-flow diagram: income → each category, savings, what is left), `MonthFlow` (the same split as one bar; `compact` on the Overview), `PlanItemsCard` (income or expenses as a list that scrolls inside its card; opens `ItemsDialog` to edit)
- `src/components/projections/` — `ProjectionTable` (scrolls inside its card; `focus-key` highlights the looked-at month, `select` fires on a row click), `ItemsDialog`
- `src/components/savings/` — `SavingsGoalCard` (ring, saved amount as of the looked-at month, one status chip, Deposit and Edit buttons, ⋯ menu for the rest), `SavingsGoalDialog`, `DepositDialog`
- `src/components/scenarios/` — `ScenarioCard`, `ScenarioComparison`

**Page layouts:**
- **No page scrolls on a desktop.** Every view is `.page` (a full-height column: `.page-head`, then `.page-body`, a grid that takes the rest; see "Page layout" in `style.css`). Anything long scrolls inside its own card (`.scroll-y`, usually with `.grow`). A short window (≤800px tall) tightens `--gap` / `--card-pad` automatically. On phones pages stack and scroll normally. When adding content, check 1920×970 and 1366×658 with many goals / expenses.
- `DashboardView` (Overview, `/`) — a cockpit: four headline tiles (cash, left that month, runway, savings), then `LineChart` beside `NextSteps` and `GoalsSnapshot`, then `MonthStrip` beside `MonthFlow`. Every figure is for the looked-at month.
- `PlanView` (`/plan`) — three columns: `SankeyFlow`; income (`PlanItemsCard`), starting balance and "What moves the result most" (`NextSteps`); expenses (`PlanItemsCard`). A budget that is not itemised shows one amount field in each card. Exchange rates and **Reset plan** are in the header. Lists show the saved plan; totals include an active what-if.
- `ForecastView` (`/forecast`) — the period pickers (From / to) in the header, `MonthStrip`, then `ProjectionTable` beside a rail: the looked-at month, figures across the plan, and one-time changes. `/projections` redirects to `/plan`.
- `SavingsView` — a grid of `SavingsGoalCard`s (scrolls when there are many) above a `LineChart` of every goal's balance, beside a rail with the totals and when each goal lands.
- `ScenariosView` — a `LineChart` of cash under the current plan and each saved scenario above the comparison table, beside a rail: save the current plan, the scenario cards (scrolling), export / import. `SettingsView` — display preferences beside exchange rates and data management. `CollaborationView` (Sharing) — people and shared budgets beside an activity card that scrolls inside itself.

**CSS / styling:**
- Design tokens are CSS custom properties defined in `src/style.css`. The look is **Aurora glass**: `<body>` carries a soft colour glow (`--app-backdrop`) and cards are translucent glass over it (`--card-bg`, `--card-border`, `--card-blur`). `--app-bg` is the flat colour under the glow. `--app-surface` is **solid** and is for anything that must not be see-through: dialogs, menus, inputs, tooltips, sticky table headers. `--hue` (148) drives the accent and the glow.
- **The interface is neutral; colour belongs to the data.** Primary buttons, the active nav item and the active mobile tab use ink (`--app-ink` / `--app-ink-text`: near-black in light mode, near-white in dark). Green (`--app-accent`, `--app-positive`) is for money gains, the chart and focus rings — not for buttons.
- Cards: `.card` is glass with a light edge, `--radius-card` 18px, padding `--card-pad`; `.card-col` makes it a column, `.card-head` / `.card-title` its heading. Buttons are pills. `--app-border` is for dividers inside a card. Do not name a class `ring` — it is a Tailwind utility and draws a box.
- **Icon tiles** (`.tile`, `.tile-sm`, `.tile-neutral`): a small tinted square with an icon; the hue comes from `--h`. `src/data/categories.ts` maps expense categories to an icon and hue (`categoryStyle`). The name beside a tile always carries the meaning. Savings is `--chart-2` (blue) everywhere: goal bars, the forecast table's transfer line, `MonthFlow`.
- One typeface: Geist, self-hosted through `@fontsource-variable/geist` (imported in `main.ts`). Use `var(--font-sans)` / `var(--font-num)`, never a literal family. Figures are tabular app-wide (set on `:root`). Labels are sentence case — no `text-transform: uppercase`.
- Motion: `MoneyFlow` for amounts that change, a CSS slide for changed `ProjectionTable` cells (`.ptable-tick`, keyed by value — 300 `MoneyFlow` cells froze the page for about a second per edit), `.bar-grow` for bars, `LineChart`'s one-time draw-in, `v-auto-animate` on lists whose rows are added or removed, and a fade when the route changes (`.page-enter` in `AppShell`). Everything honours `prefers-reduced-motion`; do not add entrance animations to individual cards.
- Dark mode via `html.app-dark` selector; PrimeVue dark mode selector set to `.app-dark`. `ThemeMode` is `'light' | 'dark' | 'system'`; `'system'` follows the device (`prefers-color-scheme`). Use `uiStore.isDark` to ask which theme is showing — `themeMode === 'dark'` is wrong when the mode is `'system'`.
- Use Tailwind for layout/spacing; use `.text-primary`, `.text-secondary`, `.divider`, `.border-app`, `.bg-surface` utility classes (defined in `style.css`) instead of inline `style=""` for token-based colors
- PrimeVue component overrides are in the `/* PrimeVue overrides */` section of `style.css`

**CurrencyInput** (`src/components/shared/CurrencyInput.vue`) wraps PrimeVue `InputNumber` with a currency symbol addon. It enforces `min="0"` but has no upper bound — validation limits are enforced by the Yup schema in `src/validation/forms.ts`, which fires via the `syncPlan()` watcher in `PlanView`.

**ItemsDialog** uses a local `draft` array; items are only committed to the store when the user explicitly clicks **Save**. `PlanView` opens it with `initial-mode="edit"` (Save and Cancel then close it) and `add-on-open` for a new empty row. Its `visible` watcher is `immediate` on purpose: a dialog that mounts already open (deep link) must still load the draft, or Save would write an empty list over the real items. Closing via Escape or the Cancel button discards unsaved changes. The dialog has a fixed height via `:style` + PrimeVue PassThrough (`:pt`) to make the content area a flex column — do **not** use scoped `:deep()` CSS to target PrimeVue Dialog internals, as Dialog teleports to `<body>` and scoped styles won't reach it.

**Exchange rates** (`useExchangeRates`) — module-level singleton, fetches from jsDelivr CDN with Cloudflare Pages fallback, 1-hour cache TTL. Returns rates relative to EUR; `convert()` cross-multiplies via EUR.

**Testing:**
- Unit test files co-locate with source (`*.test.ts`). Vitest runs in jsdom with globals — no need to import `describe`/`it`/`expect`. Supabase client falls back to placeholder URL/key when env vars are missing, so unit tests run without `.env.local`.
- E2E test files live in `e2e/`. Vitest is configured to exclude `e2e/**` so the two test runners don't conflict.
- E2E tests use `injectSupabaseSession` (from `e2e/auth.setup.ts`) in `beforeEach` to authenticate before each test — call `loginAndGo(page, '/route')` helper instead of `page.goto` directly.

## Environment Variables

Required in `.env.local`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
