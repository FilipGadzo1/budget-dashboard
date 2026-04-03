# Savings Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect savings goals to the projection screen, add deposit amounts as per-month expense deductions, and show projected completion dates and on-track warnings on goal cards.

**Architecture:** Pure service overlay approach. Monthly contributions are already handled by `effectiveInputs` in `ProjectionsView.vue`. We add: (1) a `mergeDepositsIntoAdjustments` pure function that folds deposit amounts into monthly adjustments by date; (2) two new pure functions (`computeProjectedCompletion`, `computeIsOnTrack`) in `savingsService.ts`; (3) eager deposit loading in `hydrate()`; (4) goal card UI updates for plan info and warning.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest (unit tests co-located with source)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/services/savingsProjectionService.ts` | `mergeDepositsIntoAdjustments` pure function |
| Create | `src/services/savingsProjectionService.test.ts` | Unit tests for above |
| Modify | `src/services/savingsService.ts` | Add `computeProjectedCompletion`, `computeIsOnTrack` |
| Modify | `src/services/savingsService.test.ts` | Tests for two new functions |
| Modify | `src/services/database.ts` | Add `fetchAllDepositsForUser` |
| Modify | `src/stores/savings.ts` | Eagerly load all deposits in `hydrate()` |
| Modify | `src/views/ProjectionsView.vue` | Extend `effectiveInputs` to call `mergeDepositsIntoAdjustments` |
| Modify | `src/components/savings/SavingsGoalCard.vue` | Add projected completion, warning, auto-fill button |
| Modify | `src/views/SavingsView.vue` | Add `handleUseRequired` event handler |

---

## Task 1: Add `computeProjectedCompletion` and `computeIsOnTrack` to savingsService

**Files:**
- Modify: `src/services/savingsService.ts`
- Modify: `src/services/savingsService.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/services/savingsService.test.ts`:

```ts
import {
  computeIsOnTrack,
  computeMonthsRemaining,
  computeProgress,
  computeProjectedCompletion,
  computeRemaining,
  computeRequiredMonthly,
  isGoalReached,
  sortGoals,
} from './savingsService'

describe('computeProjectedCompletion', () => {
  it('returns null when goal is already reached', () => {
    expect(
      computeProjectedCompletion(makeGoal({ currentAmount: 10000, targetAmount: 10000 })),
    ).toBeNull()
  })

  it('returns null when monthlyContribution is 0', () => {
    expect(
      computeProjectedCompletion(makeGoal({ monthlyContribution: 0 })),
    ).toBeNull()
  })

  it('returns correct completion month', () => {
    // 7500 remaining at 500/mo = 15 months from Jan 2026 → Apr 2027
    const now = new Date('2026-01-01')
    const goal = makeGoal({ currentAmount: 2500, targetAmount: 10000, monthlyContribution: 500 })
    expect(computeProjectedCompletion(goal, now)).toBe('2027-04')
  })

  it('handles month overflow across year boundary', () => {
    // 1000 remaining at 100/mo = 10 months from Sep 2026 → Jul 2027
    const now = new Date('2026-09-01')
    const goal = makeGoal({ currentAmount: 9000, targetAmount: 10000, monthlyContribution: 100 })
    expect(computeProjectedCompletion(goal, now)).toBe('2027-07')
  })
})

describe('computeIsOnTrack', () => {
  it('returns null when no targetDate', () => {
    expect(computeIsOnTrack(makeGoal({ targetDate: null }))).toBeNull()
  })

  it('returns true when goal is already reached', () => {
    expect(
      computeIsOnTrack(makeGoal({ currentAmount: 10000, targetAmount: 10000, targetDate: '2027-01-01' })),
    ).toBe(true)
  })

  it('returns true when contribution meets required', () => {
    const now = new Date('2026-01-01')
    // 7500 remaining over 10 months = 750 required; contribution 750 → on track
    const goal = makeGoal({
      currentAmount: 2500,
      targetAmount: 10000,
      targetDate: '2026-11-01',
      monthlyContribution: 750,
    })
    expect(computeIsOnTrack(goal, now)).toBe(true)
  })

  it('returns false when contribution is below required', () => {
    const now = new Date('2026-01-01')
    // 7500 remaining over 10 months = 750 required; contribution 200 → off track
    const goal = makeGoal({
      currentAmount: 2500,
      targetAmount: 10000,
      targetDate: '2026-11-01',
      monthlyContribution: 200,
    })
    expect(computeIsOnTrack(goal, now)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/services/savingsService.test.ts
```

Expected: FAIL — `computeProjectedCompletion` and `computeIsOnTrack` not found.

- [ ] **Step 3: Add the two functions to `src/services/savingsService.ts`**

Append after `isGoalReached`:

```ts
/**
 * Returns the projected completion month (YYYY-MM) based on the current monthly contribution.
 * Returns null if the goal is already reached or contribution is 0.
 */
export function computeProjectedCompletion(goal: SavingsGoal, now: Date = new Date()): string | null {
  if (isGoalReached(goal)) return null
  if (goal.monthlyContribution <= 0) return null
  const remaining = computeRemaining(goal)
  const monthsNeeded = Math.ceil(remaining / goal.monthlyContribution)
  const d = new Date(now.getFullYear(), now.getMonth() + monthsNeeded, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Returns whether the current monthly contribution will reach the goal by its target date.
 * Returns null if no target date is set. Returns true if the goal is already reached.
 */
export function computeIsOnTrack(goal: SavingsGoal, now: Date = new Date()): boolean | null {
  if (!goal.targetDate) return null
  if (isGoalReached(goal)) return true
  const required = computeRequiredMonthly(goal, now)
  if (required === null) return true
  return goal.monthlyContribution >= required
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/services/savingsService.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/savingsService.ts src/services/savingsService.test.ts
git commit -m "feat: add computeProjectedCompletion and computeIsOnTrack to savingsService"
```

---

## Task 2: Add `mergeDepositsIntoAdjustments` pure function

**Files:**
- Create: `src/services/savingsProjectionService.ts`
- Create: `src/services/savingsProjectionService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/services/savingsProjectionService.test.ts`:

```ts
import type { MonthAdjustment, SavingsDeposit } from '@/models'
import { mergeDepositsIntoAdjustments } from './savingsProjectionService'

const makeAdj = (overrides: Partial<MonthAdjustment> = {}): MonthAdjustment => ({
  id: 'adj-1',
  monthKey: '2026-04',
  incomeAdjustment: 0,
  expenseAdjustment: 0,
  ...overrides,
})

const makeDeposit = (overrides: Partial<SavingsDeposit> = {}): SavingsDeposit => ({
  id: 'dep-1',
  goalId: 'goal-1',
  userId: 'user-1',
  amount: 500,
  note: null,
  depositDate: '2026-04-15',
  createdAt: '2026-04-15T10:00:00.000Z',
  ...overrides,
})

describe('mergeDepositsIntoAdjustments', () => {
  it('returns same array reference when deposits is empty', () => {
    const existing = [makeAdj()]
    expect(mergeDepositsIntoAdjustments(existing, [])).toBe(existing)
  })

  it('adds deposit amount to existing adjustment for matching month', () => {
    const existing = [makeAdj({ monthKey: '2026-04', expenseAdjustment: 100 })]
    const result = mergeDepositsIntoAdjustments(existing, [makeDeposit({ amount: 500, depositDate: '2026-04-15' })])
    expect(result[0].expenseAdjustment).toBe(600)
    expect(result[0].incomeAdjustment).toBe(0)
  })

  it('creates a new adjustment for a month with no existing entry', () => {
    const result = mergeDepositsIntoAdjustments([], [makeDeposit({ amount: 300, depositDate: '2026-06-10' })])
    expect(result).toHaveLength(1)
    expect(result[0].monthKey).toBe('2026-06')
    expect(result[0].expenseAdjustment).toBe(300)
    expect(result[0].incomeAdjustment).toBe(0)
  })

  it('sums multiple deposits in the same month', () => {
    const result = mergeDepositsIntoAdjustments(
      [],
      [
        makeDeposit({ id: 'd1', amount: 200, depositDate: '2026-04-01' }),
        makeDeposit({ id: 'd2', amount: 350, depositDate: '2026-04-20' }),
      ],
    )
    expect(result).toHaveLength(1)
    expect(result[0].expenseAdjustment).toBe(550)
  })

  it('does not mutate the input array', () => {
    const existing = [makeAdj({ monthKey: '2026-04', expenseAdjustment: 0 })]
    const copy = [...existing]
    mergeDepositsIntoAdjustments(existing, [makeDeposit()])
    expect(existing).toEqual(copy)
  })

  it('preserves existing incomeAdjustment when adding deposit', () => {
    const existing = [makeAdj({ monthKey: '2026-04', incomeAdjustment: 200, expenseAdjustment: 50 })]
    const result = mergeDepositsIntoAdjustments(existing, [makeDeposit({ amount: 100, depositDate: '2026-04-01' })])
    expect(result[0].incomeAdjustment).toBe(200)
    expect(result[0].expenseAdjustment).toBe(150)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/services/savingsProjectionService.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/services/savingsProjectionService.ts`**

```ts
import type { MonthAdjustment, SavingsDeposit } from '@/models'

/**
 * Merges deposit amounts into monthly adjustments as additional expense deductions
 * for the month matching each deposit's depositDate. Returns a new array; does not mutate inputs.
 * Deposits outside any existing adjustment month get a new synthetic adjustment entry.
 * Returns the same array reference when deposits is empty (no allocation needed).
 */
export function mergeDepositsIntoAdjustments(
  existing: MonthAdjustment[],
  deposits: SavingsDeposit[],
): MonthAdjustment[] {
  if (deposits.length === 0) return existing

  // Group deposit amounts by month key (first 7 chars of YYYY-MM-DD)
  const depositByMonth: Record<string, number> = {}
  deposits.forEach((d) => {
    const mk = d.depositDate.slice(0, 7)
    depositByMonth[mk] = (depositByMonth[mk] ?? 0) + d.amount
  })

  // Update existing adjustments that overlap with deposit months
  const updatedKeys = new Set<string>()
  const updated: MonthAdjustment[] = existing.map((adj) => {
    const extra = depositByMonth[adj.monthKey] ?? 0
    if (extra === 0) return adj
    updatedKeys.add(adj.monthKey)
    return { ...adj, expenseAdjustment: adj.expenseAdjustment + extra }
  })

  // Add new synthetic adjustments for deposit months with no existing entry
  Object.entries(depositByMonth).forEach(([mk, amount]) => {
    if (updatedKeys.has(mk)) return
    updated.push({
      id: `__deposit__${mk}`,
      monthKey: mk,
      incomeAdjustment: 0,
      expenseAdjustment: amount,
    })
  })

  return updated
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/services/savingsProjectionService.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/savingsProjectionService.ts src/services/savingsProjectionService.test.ts
git commit -m "feat: add mergeDepositsIntoAdjustments for savings projection overlay"
```

---

## Task 3: Add `fetchAllDepositsForUser` and eagerly load deposits in hydrate

**Files:**
- Modify: `src/services/database.ts`
- Modify: `src/stores/savings.ts`

- [ ] **Step 1: Add `fetchAllDepositsForUser` to `src/services/database.ts`**

Find the `// --- Savings Deposits ---` section (around line 318). After `fetchDepositsForGoal`, add:

```ts
export async function fetchAllDepositsForUser(userId: string): Promise<SavingsDeposit[]> {
  const { data, error } = await supabase
    .from('savings_deposits')
    .select('id, goal_id, user_id, amount, note, deposit_date, created_at')
    .eq('user_id', userId)
    .order('deposit_date', { ascending: false })

  if (error) {
    console.warn('[db] fetchAllDepositsForUser error:', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    goalId: row.goal_id,
    userId: row.user_id,
    amount: Number(row.amount),
    note: row.note ?? null,
    depositDate: row.deposit_date,
    createdAt: row.created_at,
  }))
}
```

- [ ] **Step 2: Update the imports in `src/stores/savings.ts`**

Replace:
```ts
import {
  deleteSavingsDeposit,
  deleteSavingsGoal,
  fetchDepositsForGoal,
  fetchSavingsGoals,
  insertSavingsDeposit,
  insertSavingsGoal,
  updateSavingsGoal,
} from '@/services/database'
```

With:
```ts
import {
  deleteSavingsDeposit,
  deleteSavingsGoal,
  fetchAllDepositsForUser,
  fetchDepositsForGoal,
  fetchSavingsGoals,
  insertSavingsDeposit,
  insertSavingsGoal,
  updateSavingsGoal,
} from '@/services/database'
```

- [ ] **Step 3: Update `hydrate()` in `src/stores/savings.ts` to load all deposits**

Replace the existing `hydrate` function (lines 41–49):

```ts
const hydrate = async (targetUserId?: string): Promise<void> => {
  const userId = targetUserId ?? getUserId()
  if (!userId) return

  isReady.value = false
  const [fetchedGoals, allDeposits] = await Promise.all([
    fetchSavingsGoals(userId),
    fetchAllDepositsForUser(userId),
  ])
  goals.value = fetchedGoals
  deposits.value = allDeposits.reduce<Record<string, SavingsDeposit[]>>((acc, d) => {
    if (!acc[d.goalId]) acc[d.goalId] = []
    acc[d.goalId].push(d)
    return acc
  }, {})
  isReady.value = true
}
```

- [ ] **Step 4: Run unit tests to confirm nothing broke**

```bash
npm run test
```

Expected: all tests PASS (no store tests rely on deposits being empty after hydrate).

- [ ] **Step 5: Commit**

```bash
git add src/services/database.ts src/stores/savings.ts
git commit -m "feat: eagerly load all deposits on hydrate for projection integration"
```

---

## Task 4: Extend `effectiveInputs` in ProjectionsView to include deposit amounts

**Files:**
- Modify: `src/views/ProjectionsView.vue`

- [ ] **Step 1: Add the import for `mergeDepositsIntoAdjustments`**

In `src/views/ProjectionsView.vue`, find the services import block (around line 17–21). Add:

```ts
import { mergeDepositsIntoAdjustments } from '@/services/savingsProjectionService'
```

- [ ] **Step 2: Replace `effectiveInputs` with the deposit-aware version**

Find the existing `effectiveInputs` computed (lines 59–73) and replace it entirely:

```ts
const effectiveInputs = computed((): ProjectionInputs => {
  const savings = savingsStore.totalMonthlyContributions
  const allDeposits = Object.values(savingsStore.deposits).flat()
  const base = projectionStore.inputs

  const mergedAdjustments = mergeDepositsIntoAdjustments(base.monthlyAdjustments, allDeposits)
  const adjustmentsChanged = mergedAdjustments !== base.monthlyAdjustments

  if (savings === 0) {
    return adjustmentsChanged ? { ...base, monthlyAdjustments: mergedAdjustments } : base
  }

  if (base.expenseItems.length > 0) {
    return {
      ...base,
      expenseItems: [
        ...base.expenseItems,
        { id: '__savings__', name: 'Savings contributions', amount: savings, sortOrder: 9999 },
      ],
      monthlyAdjustments: mergedAdjustments,
    }
  }

  return { ...base, monthlyExpenses: base.monthlyExpenses + savings, monthlyAdjustments: mergedAdjustments }
})
```

- [ ] **Step 3: Run unit tests**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/views/ProjectionsView.vue src/services/savingsProjectionService.ts
git commit -m "feat: include deposit amounts as expense deductions in monthly projection"
```

---

## Task 5: Update SavingsGoalCard with projected completion, warning, and auto-fill

**Files:**
- Modify: `src/components/savings/SavingsGoalCard.vue`
- Modify: `src/views/SavingsView.vue`

- [ ] **Step 1: Update the script section of `src/components/savings/SavingsGoalCard.vue`**

Replace the existing `<script setup lang="ts">` block:

```ts
<script setup lang="ts">
import { computed } from 'vue'

import type { SavingsGoal } from '@/models'
import {
  computeIsOnTrack,
  computeMonthsRemaining,
  computeProgress,
  computeProjectedCompletion,
  computeRemaining,
  computeRequiredMonthly,
} from '@/services/savingsService'

const props = defineProps<{
  goal: SavingsGoal
  formatCurrency: (n: number) => string
  readonly?: boolean
}>()

defineEmits<{
  deposit: []
  edit: []
  delete: []
  'use-required': []
}>()

const progress = computed(() => computeProgress(props.goal))
const remaining = computed(() => computeRemaining(props.goal))
const monthsLeft = computed(() => computeMonthsRemaining(props.goal))
const isOnTrack = computed(() => computeIsOnTrack(props.goal))
const requiredMonthly = computed(() => computeRequiredMonthly(props.goal))
const projectedCompletionMonthKey = computed(() => computeProjectedCompletion(props.goal))

const projectedCompletionLabel = computed(() => {
  if (!projectedCompletionMonthKey.value) return null
  const [year, month] = projectedCompletionMonthKey.value.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
})

// How many months late the projected completion is vs the target date
const lateByMonths = computed(() => {
  if (isOnTrack.value !== false || !props.goal.targetDate || !projectedCompletionMonthKey.value) return null
  const [ty, tm] = props.goal.targetDate.slice(0, 7).split('-').map(Number)
  const [py, pm] = projectedCompletionMonthKey.value.split('-').map(Number)
  return (py - ty) * 12 + (pm - tm)
})

const statusLabel = computed(() => {
  if (props.goal.status === 'completed') return 'Completed'
  if (props.goal.status === 'paused') return 'Paused'
  return 'Active'
})

const statusClass = computed(() => {
  if (props.goal.status === 'paused') return 'status-pill-warning'
  return 'status-pill-positive'
})

const progressBarColor = computed(() =>
  props.goal.status === 'completed' ? 'var(--app-positive)' : 'var(--app-accent)',
)

const monthsLabel = computed(() => {
  if (monthsLeft.value === null) return null
  if (monthsLeft.value === 0) return 'Deadline passed'
  return `${monthsLeft.value} month${monthsLeft.value === 1 ? '' : 's'} left`
})

const targetDateLabel = computed(() => {
  if (!props.goal.targetDate) return null
  const d = new Date(props.goal.targetDate)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
})
</script>
```

- [ ] **Step 2: Update the meta row and actions in the template**

Find the `<!-- Meta row -->` section (starting at `<div class="savings-card-meta">`). Replace it and the `<!-- Actions -->` section with:

```html
<!-- Meta row -->
<div class="savings-card-meta">
  <span v-if="goal.monthlyContribution > 0" class="savings-meta-chip">
    <i class="pi pi-arrow-up text-xs" />
    {{ formatCurrency(goal.monthlyContribution) }}/mo
  </span>
  <span v-if="targetDateLabel" class="savings-meta-chip">
    <i class="pi pi-calendar text-xs" />
    {{ targetDateLabel }}
  </span>
  <span v-if="monthsLabel" class="savings-meta-chip">
    <i class="pi pi-clock text-xs" />
    {{ monthsLabel }}
  </span>
  <span v-if="goal.status !== 'completed'" class="savings-meta-chip savings-meta-chip-remaining">
    {{ formatCurrency(remaining) }} to go
  </span>
  <!-- Projected completion -->
  <span
    v-if="projectedCompletionLabel && goal.status === 'active'"
    :class="['savings-meta-chip', isOnTrack === false ? 'savings-meta-chip-alert' : 'savings-meta-chip-positive']"
  >
    <i class="pi pi-flag text-xs" />
    {{ isOnTrack === false ? `Projected: ${projectedCompletionLabel}` : `On track: ${projectedCompletionLabel}` }}
  </span>
  <!-- Warning: won't hit target date -->
  <span v-if="isOnTrack === false && requiredMonthly !== null" class="savings-meta-chip savings-meta-chip-alert">
    <i class="pi pi-exclamation-triangle text-xs" />
    Needs {{ formatCurrency(requiredMonthly) }}/mo
    <span v-if="lateByMonths !== null">&nbsp;({{ lateByMonths }}mo late)</span>
  </span>
</div>

<!-- Actions -->
<div class="savings-card-actions">
  <button
    v-if="goal.status !== 'completed' && !readonly"
    class="btn btn-primary btn-sm"
    @click="$emit('deposit')"
  >
    <i class="pi pi-plus" /> Deposit
  </button>
  <button
    v-if="isOnTrack === false && requiredMonthly !== null && !readonly"
    class="btn btn-secondary btn-sm"
    @click="$emit('use-required')"
  >
    Use required amount
  </button>
  <button
    v-if="!readonly"
    class="btn btn-secondary btn-sm"
    @click="$emit('edit')"
  >
    Edit
  </button>
  <button
    v-if="!readonly"
    class="btn btn-danger btn-sm"
    @click="$emit('delete')"
  >
    Delete
  </button>
  <button
    v-if="goal.status === 'completed' || readonly"
    class="btn btn-secondary btn-sm"
    @click="$emit('deposit')"
  >
    <i class="pi pi-history" /> History
  </button>
</div>
```

- [ ] **Step 3: Add CSS classes for the new chip variants**

In the `<style scoped>` section of `SavingsGoalCard.vue`, after `.savings-meta-chip-remaining`, add:

```css
.savings-meta-chip-alert {
  color: var(--app-warning, #f59e0b);
  background: rgba(245, 158, 11, 0.1);
  border-color: transparent;
}

.savings-meta-chip-positive {
  color: var(--app-positive);
  background: var(--app-positive-soft, rgba(34, 197, 94, 0.1));
  border-color: transparent;
}
```

- [ ] **Step 4: Add the `use-required` handler in `src/views/SavingsView.vue`**

In `SavingsView.vue`, add the import at the top of `<script setup>`:

```ts
import { computeRequiredMonthly } from '@/services/savingsService'
```

Then add the handler function (after `handleDeleteDeposit`):

```ts
const handleUseRequired = (goal: SavingsGoal): void => {
  const required = computeRequiredMonthly(goal)
  if (required === null) return
  savingsStore.updateGoal(goal.id, { monthlyContribution: required })
}
```

- [ ] **Step 5: Wire the event in the template**

In `SavingsView.vue`, find the `<SavingsGoalCard ... />` component. Add the event handler:

```html
<SavingsGoalCard
  v-for="goal in savingsStore.sortedGoals"
  :key="goal.id"
  :goal="goal"
  :format-currency="formatCurrency"
  :readonly="readonly"
  @deposit="openDeposit(goal)"
  @edit="openEditGoal(goal)"
  @delete="openDelete(goal.id)"
  @use-required="handleUseRequired(goal)"
/>
```

- [ ] **Step 6: Run all tests**

```bash
npm run test
```

Expected: all tests PASS.

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/savings/SavingsGoalCard.vue src/views/SavingsView.vue
git commit -m "feat: show projected completion, on-track warning, and auto-fill on goal cards"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - Target date → auto-calculate required contribution: covered by `computeRequiredMonthly` (already existed) + `computeIsOnTrack` (Task 1) + "Use required amount" button (Task 5)
  - Projected completion date: covered by `computeProjectedCompletion` (Task 1) + card UI (Task 5)
  - Warning when contribution won't meet target: covered by `isOnTrack === false` chips (Task 5)
  - Monthly contributions deducted from projection: already handled by existing `effectiveInputs`, preserved in Task 4
  - Deposits as per-month expense deductions: covered by `mergeDepositsIntoAdjustments` (Task 2) + `effectiveInputs` (Task 4)
  - Deposits eagerly available for projection: covered by Task 3 (`hydrate` change)
  - Savings indicator in ProjectionsView: already present at line 351–354 — no task needed
- [x] **No placeholders found**
- [x] **Type consistency:** `computeProjectedCompletion` returns `string | null` (YYYY-MM); `projectedCompletionMonthKey` in card uses the same type; `lateByMonths` derivation uses both `goal.targetDate.slice(0,7)` and `projectedCompletionMonthKey.value` — both YYYY-MM format, consistent.
