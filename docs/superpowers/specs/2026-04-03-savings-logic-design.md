# Savings Logic Redesign

**Date:** 2026-04-03  
**Status:** Approved

## Problem

The current savings implementation has no connection to the projection screen, no projected completion dates, no validation that a contribution can meet a target date, and no indication of savings in the monthly budget numbers. A user can set a goal of €200,000 with a 2-month target and a €1/month contribution and receive no feedback that this is impossible.

## Goals

1. When a target date is set, auto-calculate the required monthly contribution and warn if the user's contribution falls short.
2. Always show a projected completion date based on the actual monthly contribution.
3. Monthly savings contributions are deducted from the projection screen's net figures.
4. One-time deposits reduce the goal's remaining balance and appear as an expense deduction in their respective projection month.

## Out of Scope

- Withdrawals from savings goals
- Per-goal projection rows in the projection table
- Savings scenarios / snapshots
- Changes to the DB schema for goals or deposits

---

## Architecture

### Approach

Pure service overlay (Approach A). Two new pure functions handle all savings logic. The projection view pipes its rows through the savings overlay after computing them. No changes to `ProjectionInputs`, no cross-store writes, no DB schema changes.

---

## Section 1: Goal Calculation Logic

**File:** `src/services/savingsService.ts` (extend existing file)

### New type

```ts
interface GoalPlan {
  requiredContribution: number | null   // null when no targetDate
  projectedCompletionDate: string | null // ISO month YYYY-MM; null when contribution is 0
  monthsToComplete: number | null
  isOnTrack: boolean | null             // null when no targetDate
}
```

### Function: `computeGoalPlan(goal, today)`

Parameters:
- `goal: SavingsGoal`
- `today: string` — ISO date `YYYY-MM-DD` (passed in, not read from `Date.now()`, for testability)

Logic:
- `remaining = goal.targetAmount - goal.currentAmount`
- If `remaining <= 0`: return completed state (projectedCompletionDate = today, isOnTrack = true)
- If `goal.targetDate` is set:
  - `monthsRemaining = diffInMonths(targetDate, today)` — minimum 1
  - `requiredContribution = remaining / monthsRemaining`
  - `isOnTrack = goal.monthlyContribution >= requiredContribution` (compared rounded to 2dp)
  - `projectedCompletionDate` = today + `ceil(remaining / goal.monthlyContribution)` months
  - `monthsToComplete = ceil(remaining / goal.monthlyContribution)` (or null if contribution is 0)
- If no `targetDate`:
  - `requiredContribution = null`, `isOnTrack = null`
  - `projectedCompletionDate` = today + `ceil(remaining / goal.monthlyContribution)` months (null if contribution is 0)

---

## Section 2: Projection Integration

**File:** `src/services/savingsProjectionService.ts` (new file)

### Model change

Add one field to `ProjectionRow` in `src/models/index.ts`:

```ts
savingsContribution: number  // defaults to 0; sum of monthly contributions + deposits for this month
```

### Function: `applySavingsToRows(rows, goals, deposits)`

```ts
function applySavingsToRows(
  rows: ProjectionRow[],
  goals: SavingsGoal[],
  deposits: SavingsDeposit[],
): ProjectionRow[]
```

Logic:
- `totalMonthlyContributions` = sum of `monthlyContribution` for all goals where `status === 'active'`
- Group `deposits` by month key derived from `depositDate` (first 7 chars of ISO date, e.g. `2026-04`)
- Recompute rows with a running balance:
  - For each row in order:
    - `depositTotal` = sum of deposits in `depositsForMonth[row.monthKey]` (0 if none)
    - `savingsDeduction` = `totalMonthlyContributions + depositTotal`
    - `expenses += savingsDeduction`
    - `net = income - expenses` (recomputed, not just `net - savingsDeduction`, to stay consistent)
    - `savingsContribution = savingsDeduction`
    - `cumulativeBalance` = previous row's cumulativeBalance + net (recomputed from scratch)
- Returns new array of rows; does not mutate inputs
- Deposits whose `depositDate` falls outside the projection window (no matching row) are silently ignored

### View integration (`ProjectionsView.vue`)

After `buildProjectionRows(inputs, startMonth, locale)`, pipe through:

```ts
const adjustedRows = applySavingsToRows(rows, savingsStore.goals, allDeposits)
```

Where `allDeposits` = all deposits from `savingsStore.deposits` (flattened from the `Record<string, SavingsDeposit[]>` map).

Summary, milestones, and trend path are all computed from `adjustedRows`, so they reflect savings automatically.

---

## Section 3: UI Changes

### SavingsView — goal cards

Each active goal card displays computed plan info from `computeGoalPlan`:

| Condition | Display |
|---|---|
| Always | Projected completion: "Jul 2028" |
| `targetDate` set | Required contribution: "Needs €833/month to hit target" |
| `isOnTrack === false` | Warning badge: "At €200/month you'll miss your target by 14 months" |
| `isOnTrack === false` + `targetDate` set | "Use required amount" button → sets `monthlyContribution` to `requiredContribution` |
| `monthlyContribution === 0` | "Set a monthly contribution to see projection" |

The contribution field remains freely editable at all times. The warning is informational only.

### ProjectionsView — savings indicator

A single line below the projection summary totals, visible only when `totalMonthlyContributions > 0`:

> "Savings contributions: €X/month included in expenses"

No new table columns. No changes to `ProjectionInputs`.

---

## Data Flow

```
SavingsStore.goals + SavingsStore.deposits
        │
        ▼
applySavingsToRows(buildProjectionRows(inputs), goals, deposits)
        │
        ▼
ProjectionRow[] with savingsContribution field
        │
        ▼
buildProjectionSummary / buildProjectionMilestones / buildProjectionTrendPath
```

---

## Testing

- Unit tests for `computeGoalPlan`: target date met, target date missed, no target date, zero contribution edge case, already completed goal
- Unit tests for `applySavingsToRows`: no goals, active goals only, deposit in current month, deposit in past month, paused goals excluded, cumulativeBalance recomputed correctly
- Existing projection tests remain unchanged
