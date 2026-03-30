import { expect, test } from '@playwright/test'

import { injectSupabaseSession } from './auth.setup'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loginAndGoToSavings(page: Parameters<typeof injectSupabaseSession>[0]) {
  const injected = await injectSupabaseSession(page)
  test.skip(!injected, 'E2E_SUPABASE_TOKEN not set — skipping authenticated tests')
  await page.goto('/savings')
  await page.waitForURL(/\/savings/, { timeout: 8000 })
  // Wait for either empty state or cards — store hydration done
  await Promise.race([
    page.locator('text=No savings goals yet').waitFor({ timeout: 6000 }).catch(() => {}),
    page.locator('.savings-card').first().waitFor({ timeout: 6000 }).catch(() => {}),
  ])
}

/** Fill a PrimeVue InputNumber input (input-id puts the id on the inner <input>). */
async function fillPvInput(page: Parameters<typeof injectSupabaseSession>[0], selector: string, value: string) {
  const input = page.locator(selector)
  await input.click({ clickCount: 3 })
  await input.fill(value)
  await page.keyboard.press('Tab')
  await page.waitForTimeout(200)
}

/** Open the New goal dialog and fill in the name + target amount. */
async function openNewGoalDialog(page: Parameters<typeof injectSupabaseSession>[0], name: string, targetAmount: string) {
  await page.click('button:has-text("New goal")')
  await expect(page.locator('#sg-name')).toBeVisible({ timeout: 4000 })
  await page.fill('#sg-name', name)
  await fillPvInput(page, '#sg-target', targetAmount)
}

// ─── Navigation ───────────────────────────────────────────────────────────────

test.describe('Savings navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToSavings(page)
  })

  test('Savings nav item appears above Scenarios in sidebar', async ({ page }) => {
    const links = page.locator('.sidebar-link')
    const labels = await links.allTextContents()
    const savingsIdx = labels.findIndex((l) => l.includes('Savings'))
    const scenariosIdx = labels.findIndex((l) => l.includes('Scenarios'))
    expect(savingsIdx).toBeGreaterThanOrEqual(0)
    expect(scenariosIdx).toBeGreaterThanOrEqual(0)
    expect(savingsIdx).toBeLessThan(scenariosIdx)
  })

  test('Savings nav item appears above Scenarios in mobile tabs', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const tabs = page.locator('.mobile-tab')
    const labels = await tabs.allTextContents()
    const savingsIdx = labels.findIndex((l) => l.includes('Savings'))
    const scenariosIdx = labels.findIndex((l) => l.includes('Scenarios'))
    expect(savingsIdx).toBeLessThan(scenariosIdx)
  })

  test('clicking Savings nav item navigates to /savings', async ({ page }) => {
    await page.goto('/projections')
    await page.waitForURL(/\/projections/, { timeout: 5000 })
    await page.click('.sidebar-link:has-text("Savings")')
    await page.waitForURL(/\/savings/, { timeout: 5000 })
  })
})

// ─── Page layout ──────────────────────────────────────────────────────────────

test.describe('Savings page layout', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToSavings(page)
  })

  test('renders page title', async ({ page }) => {
    await expect(page.locator('h1:has-text("Savings Goals")')).toBeVisible()
  })

  test('renders New goal button', async ({ page }) => {
    await expect(page.locator('button:has-text("New goal")')).toBeVisible()
  })

  test('desktop screenshot', async ({ page }) => {
    await page.screenshot({ path: 'e2e/screenshots/savings-desktop.png', fullPage: true })
  })

  test('mobile screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(300)
    await page.screenshot({ path: 'e2e/screenshots/savings-mobile.png', fullPage: true })
  })
})

// ─── Goal dialog ──────────────────────────────────────────────────────────────

test.describe('New goal dialog', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToSavings(page)
  })

  test('opens when clicking New goal', async ({ page }) => {
    await page.click('button:has-text("New goal")')
    await expect(page.locator('#sg-name')).toBeVisible({ timeout: 4000 })
    await page.screenshot({ path: 'e2e/screenshots/savings-new-goal-dialog.png' })
  })

  test('has all required fields', async ({ page }) => {
    await page.click('button:has-text("New goal")')
    await expect(page.locator('#sg-name')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('#sg-target')).toBeVisible()
    await expect(page.locator('#sg-contrib')).toBeVisible()
    await expect(page.locator('#sg-date')).toBeVisible()
    await expect(page.locator('#sg-note')).toBeVisible()
  })

  test('shows validation error when name is empty', async ({ page }) => {
    await page.click('button:has-text("New goal")')
    await expect(page.locator('#sg-name')).toBeVisible({ timeout: 4000 })
    await page.click('button:has-text("Create goal")')
    await expect(page.locator('text=Goal name is required')).toBeVisible({ timeout: 3000 })
    await page.screenshot({ path: 'e2e/screenshots/savings-dialog-validation.png' })
  })

  test('shows validation error when target amount is 0', async ({ page }) => {
    await page.click('button:has-text("New goal")')
    await expect(page.locator('#sg-name')).toBeVisible({ timeout: 4000 })
    await page.fill('#sg-name', 'Test Goal')
    // Leave target at 0
    await page.click('button:has-text("Create goal")')
    await expect(page.locator('text=Target amount must be at least 1')).toBeVisible({ timeout: 3000 })
  })

  test('closes when clicking Cancel', async ({ page }) => {
    await page.click('button:has-text("New goal")')
    await expect(page.locator('#sg-name')).toBeVisible({ timeout: 4000 })
    await page.click('button:has-text("Cancel")')
    await expect(page.locator('#sg-name')).not.toBeVisible({ timeout: 3000 })
  })

  test('closes when clicking outside (dismissable-mask)', async ({ page }) => {
    await page.click('button:has-text("New goal")')
    await expect(page.locator('#sg-name')).toBeVisible({ timeout: 4000 })
    // Click the mask backdrop (outside the dialog panel)
    await page.mouse.click(10, 10)
    await expect(page.locator('#sg-name')).not.toBeVisible({ timeout: 3000 })
  })
})

// ─── Goal CRUD ────────────────────────────────────────────────────────────────

test.describe('Goal CRUD', () => {
  const GOAL_NAME = `E2E Goal ${Date.now()}`
  const GOAL_TARGET = '5000'

  test.beforeEach(async ({ page }) => {
    await loginAndGoToSavings(page)
  })

  test('creates a goal and it appears as a card', async ({ page }) => {
    await openNewGoalDialog(page, GOAL_NAME, GOAL_TARGET)
    await page.click('button:has-text("Create goal")')

    // Card should appear
    await expect(page.locator(`.savings-card:has-text("${GOAL_NAME}")`)).toBeVisible({ timeout: 8000 })
    await page.screenshot({ path: 'e2e/screenshots/savings-goal-created.png' })
  })

  test('new card shows target amount in meta', async ({ page }) => {
    // Create goal
    await openNewGoalDialog(page, GOAL_NAME, GOAL_TARGET)
    await page.click('button:has-text("Create goal")')
    // Multiple goals with same name may exist across runs — use .first()
    const card = page.locator(`.savings-card:has-text("${GOAL_NAME}")`).first()
    await expect(card).toBeVisible({ timeout: 8000 })

    // Card should show progress: 0 / target
    await expect(card.locator('text=5,000')).toBeVisible()
  })

  test('new card shows Active status pill', async ({ page }) => {
    await openNewGoalDialog(page, GOAL_NAME, GOAL_TARGET)
    await page.click('button:has-text("Create goal")')
    const card = page.locator(`.savings-card:has-text("${GOAL_NAME}")`).first()
    await expect(card).toBeVisible({ timeout: 8000 })
    await expect(card.locator('.status-pill:has-text("Active")')).toBeVisible()
  })

  test('progress bar starts at 0%', async ({ page }) => {
    await openNewGoalDialog(page, GOAL_NAME, GOAL_TARGET)
    await page.click('button:has-text("Create goal")')
    const card = page.locator(`.savings-card:has-text("${GOAL_NAME}")`).first()
    await expect(card).toBeVisible({ timeout: 8000 })
    await expect(card.locator('text=0%')).toBeVisible()
  })

  test('goal with target date shows it in meta chips', async ({ page }) => {
    await page.click('button:has-text("New goal")')
    await expect(page.locator('#sg-name')).toBeVisible({ timeout: 4000 })
    await page.fill('#sg-name', GOAL_NAME)
    await fillPvInput(page, '#sg-target', GOAL_TARGET)
    await page.fill('#sg-date', '2027-12-01')
    await page.click('button:has-text("Create goal")')

    const card = page.locator(`.savings-card:has-text("${GOAL_NAME}")`)
    await expect(card).toBeVisible({ timeout: 8000 })
    // Dec 2027 target date chip
    await expect(card.locator('text=Dec 2027')).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/savings-goal-with-date.png' })
  })

  test('edit dialog opens prefilled with current values', async ({ page }) => {
    await openNewGoalDialog(page, GOAL_NAME, GOAL_TARGET)
    await page.click('button:has-text("Create goal")')
    const card = page.locator(`.savings-card:has-text("${GOAL_NAME}")`).first()
    await expect(card).toBeVisible({ timeout: 8000 })

    await card.locator('button:has-text("Edit")').click()
    await expect(page.locator('#sg-name')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('#sg-name')).toHaveValue(GOAL_NAME)
    await page.screenshot({ path: 'e2e/screenshots/savings-edit-dialog.png' })
  })

  test('can rename a goal via edit dialog', async ({ page }) => {
    const renamed = `${GOAL_NAME} Renamed`
    await openNewGoalDialog(page, GOAL_NAME, GOAL_TARGET)
    await page.click('button:has-text("Create goal")')
    const card = page.locator(`.savings-card:has-text("${GOAL_NAME}")`).first()
    await expect(card).toBeVisible({ timeout: 8000 })

    await card.locator('button:has-text("Edit")').click()
    await expect(page.locator('#sg-name')).toBeVisible({ timeout: 4000 })
    await page.fill('#sg-name', renamed)
    await page.click('button:has-text("Save changes")')

    await expect(page.locator(`.savings-card:has-text("${renamed}")`)).toBeVisible({ timeout: 6000 })
  })

  test('delete dialog appears and cancelling keeps the goal', async ({ page }) => {
    await openNewGoalDialog(page, GOAL_NAME, GOAL_TARGET)
    await page.click('button:has-text("Create goal")')
    const card = page.locator(`.savings-card:has-text("${GOAL_NAME}")`).first()
    await expect(card).toBeVisible({ timeout: 8000 })

    await card.locator('button:has-text("Delete")').click()
    // Confirm dialog should appear
    await expect(page.locator('text=Delete goal')).toBeVisible({ timeout: 3000 })
    await page.screenshot({ path: 'e2e/screenshots/savings-delete-confirm.png' })

    // Cancel — goal should still be there
    await page.click('button:has-text("Cancel")')
    await expect(card).toBeVisible()
  })

  test('confirming delete removes the goal card', async ({ page }) => {
    await openNewGoalDialog(page, GOAL_NAME, GOAL_TARGET)
    await page.click('button:has-text("Create goal")')
    const card = page.locator(`.savings-card:has-text("${GOAL_NAME}")`).first()
    await expect(card).toBeVisible({ timeout: 8000 })

    await card.locator('button:has-text("Delete")').click()
    await expect(page.locator('text=Delete goal')).toBeVisible({ timeout: 3000 })
    // Click the confirm button inside the confirm dialog
    await page.locator('.p-dialog button.btn-danger').click()

    await expect(card).not.toBeVisible({ timeout: 6000 })
  })
})

// ─── Deposits ─────────────────────────────────────────────────────────────────

test.describe('Deposits', () => {
  const GOAL_NAME = `Deposit Test ${Date.now()}`

  test.beforeEach(async ({ page }) => {
    await loginAndGoToSavings(page)
    // Create a fresh goal to deposit into
    await openNewGoalDialog(page, GOAL_NAME, '10000')
    await page.click('button:has-text("Create goal")')
    await expect(page.locator(`.savings-card:has-text("${GOAL_NAME}")`).first()).toBeVisible({ timeout: 8000 })
  })

  test('deposit dialog opens', async ({ page }) => {
    const card = page.locator(`.savings-card:has-text("${GOAL_NAME}")`).first()
    await card.locator('button:has-text("Deposit")').click()
    await expect(page.locator('#dep-amount')).toBeVisible({ timeout: 4000 })
    await page.screenshot({ path: 'e2e/screenshots/savings-deposit-dialog.png' })
  })

  test('deposit dialog shows goal progress', async ({ page }) => {
    const card = page.locator(`.savings-card:has-text("${GOAL_NAME}")`).first()
    await card.locator('button:has-text("Deposit")').click()
    await expect(page.locator('#dep-amount')).toBeVisible({ timeout: 4000 })
    // Should show the progress section (0%) — scoped to the dialog
    await expect(page.locator('.deposit-goal-summary').locator('text=0%')).toBeVisible()
  })

  test('logging a deposit updates the card progress', async ({ page }) => {
    const card = page.locator(`.savings-card:has-text("${GOAL_NAME}")`).first()
    await card.locator('button:has-text("Deposit")').click()
    await expect(page.locator('#dep-amount')).toBeVisible({ timeout: 4000 })

    await fillPvInput(page, '#dep-amount', '2500')
    await page.click('button:has-text("Log deposit")')

    // Dialog closes after save; card shows updated progress (25%)
    await expect(page.locator('#dep-amount')).not.toBeVisible({ timeout: 6000 })
    await expect(card.locator('text=25%')).toBeVisible({ timeout: 6000 })
    await page.screenshot({ path: 'e2e/screenshots/savings-after-deposit.png' })
  })

  test('deposit appears in history list', async ({ page }) => {
    const card = page.locator(`.savings-card:has-text("${GOAL_NAME}")`).first()
    await card.locator('button:has-text("Deposit")').click()
    await expect(page.locator('#dep-amount')).toBeVisible({ timeout: 4000 })

    await fillPvInput(page, '#dep-amount', '1000')
    await page.fill('#dep-note', 'First deposit')
    await page.click('button:has-text("Log deposit")')

    // Dialog closes after save; reopen to see history
    await expect(page.locator('#dep-amount')).not.toBeVisible({ timeout: 5000 })
    await card.locator('button:has-text("Deposit")').click()
    await expect(page.locator('#dep-amount')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('.deposit-history-list')).toBeVisible({ timeout: 4000 })
    await expect(page.locator('text=First deposit')).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/savings-deposit-history.png' })
  })

  test('withdrawal (negative amount) is accepted', async ({ page }) => {
    // First deposit so there's something to withdraw from
    const card = page.locator(`.savings-card:has-text("${GOAL_NAME}")`).first()
    await card.locator('button:has-text("Deposit")').click()
    await expect(page.locator('#dep-amount')).toBeVisible({ timeout: 4000 })
    await fillPvInput(page, '#dep-amount', '3000')
    await page.click('button:has-text("Log deposit")')
    await expect(page.locator('#dep-amount')).not.toBeVisible({ timeout: 5000 })

    // Now log a withdrawal (negative value via keyboard so PrimeVue accepts the minus sign)
    await card.locator('button:has-text("Deposit")').click()
    await expect(page.locator('#dep-amount')).toBeVisible({ timeout: 4000 })
    await page.locator('#dep-amount').click({ clickCount: 3 })
    await page.keyboard.type('-500')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(300)
    // Label should switch to "Withdrawal"
    await expect(page.locator('label:has-text("Withdrawal amount")')).toBeVisible({ timeout: 2000 })
    await page.click('button:has-text("Log withdrawal")')
    await expect(page.locator('#dep-amount')).not.toBeVisible({ timeout: 5000 })

    // Progress should reflect net amount (3000 - 500 = 2500 of 10000 = 25%)
    await expect(card.locator('text=25%')).toBeVisible({ timeout: 6000 })
    await page.screenshot({ path: 'e2e/screenshots/savings-after-withdrawal.png' })
  })

  test('deposit amount of 0 is rejected', async ({ page }) => {
    const card = page.locator(`.savings-card:has-text("${GOAL_NAME}")`).first()
    await card.locator('button:has-text("Deposit")').click()
    await expect(page.locator('#dep-amount')).toBeVisible({ timeout: 4000 })
    // Leave amount at 0 — button should be disabled (scoped to the open dialog)
    await expect(page.locator('.p-dialog button:has-text("Log deposit")')).toBeDisabled()
  })

  test('can delete a deposit from history', async ({ page }) => {
    const card = page.locator(`.savings-card:has-text("${GOAL_NAME}")`).first()

    // Log a deposit
    await card.locator('button:has-text("Deposit")').click()
    await expect(page.locator('#dep-amount')).toBeVisible({ timeout: 4000 })
    await fillPvInput(page, '#dep-amount', '500')
    await page.fill('#dep-note', 'To be deleted')
    await page.click('button:has-text("Log deposit")')
    await expect(page.locator('#dep-amount')).not.toBeVisible({ timeout: 5000 })

    // Reopen and delete
    await card.locator('button:has-text("Deposit")').click()
    await expect(page.locator('.deposit-history-list')).toBeVisible({ timeout: 4000 })
    await page.locator('.deposit-history-item').first().locator('.deposit-history-delete').click()

    // History list should be empty (or item gone)
    await expect(page.locator('text=To be deleted')).not.toBeVisible({ timeout: 5000 })
    await page.screenshot({ path: 'e2e/screenshots/savings-deposit-deleted.png' })
  })
})

// ─── Summary strip ────────────────────────────────────────────────────────────

test.describe('Summary strip', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToSavings(page)
  })

  test('summary strip is visible when goals exist', async ({ page }) => {
    // Create a goal so the strip shows
    await openNewGoalDialog(page, `Summary Test ${Date.now()}`, '8000')
    await page.click('button:has-text("Create goal")')
    await expect(page.locator('.savings-card')).toBeVisible({ timeout: 8000 })

    await expect(page.locator('.savings-summary')).toBeVisible()
    await expect(page.locator('text=Total saved')).toBeVisible()
    await expect(page.locator('text=Monthly allocated')).toBeVisible()
    await expect(page.locator('text=Active goals')).toBeVisible()
    await page.screenshot({ path: 'e2e/screenshots/savings-summary-strip.png' })
  })
})

// ─── Projections integration ──────────────────────────────────────────────────

test.describe('Projections integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndGoToSavings(page)
  })

  test('savings contribution annotation appears on projections page', async ({ page }) => {
    // Create a goal with a monthly contribution
    await page.click('button:has-text("New goal")')
    await expect(page.locator('#sg-name')).toBeVisible({ timeout: 4000 })
    await page.fill('#sg-name', `Projection Test ${Date.now()}`)
    await fillPvInput(page, '#sg-target', '5000')
    // Set monthly contribution
    await fillPvInput(page, '#sg-contrib', '200')
    await page.click('button:has-text("Create goal")')
    await expect(page.locator('.savings-card')).toBeVisible({ timeout: 8000 })

    // Navigate to projections
    await page.goto('/projections')
    await page.waitForURL(/\/projections/, { timeout: 5000 })
    await expect(page.locator('text=savings contributions')).toBeVisible({ timeout: 6000 })
    await page.screenshot({ path: 'e2e/screenshots/savings-projections-annotation.png' })
  })
})
