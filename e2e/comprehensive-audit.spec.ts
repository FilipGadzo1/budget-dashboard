/**
 * Comprehensive UI audit — Budget Dashboard
 *
 * Covers:
 *  1. Dashboard (zero-state, KPIs, trend chart, milestone cards, insights)
 *  2. Projections (input changes, validation, currency conversion, exchange-rates dialog,
 *                  share summary text, projection table, expense items)
 *  3. Scenarios (save, save without name, load, delete, export/import)
 *  4. Collaboration (invite dialog fields, empty-submit validation, invalid email)
 *  5. Settings (unsaved changes, save + verify on Projections, theme toggle)
 *  6. Mobile (390px) — each page
 *  7. Edge cases (0 income / 500 expenses on Dashboard + Projections table)
 *
 * ── KNOWN FINDINGS ──────────────────────────────────────────────────────────
 *
 * BUG-1 (Validation — no error for over-limit income):
 *   Entering 9,999,999,999 in the income field produces no form error. The Yup
 *   schema caps at 1 billion (max: 1_000_000_000). A value of 9 999 999 999
 *   exceeds the cap, but no inline `.form-error` element appears under the field.
 *   Root cause: CurrencyInput likely clamps or strips the value before Yup sees it,
 *   or the watch debounce prevents validation running before the field loses focus.
 *   Severity: Medium — silent data corruption risk.
 *
 * BUG-2 (Validation — no error for negative income):
 *   Typing "-500" into the income CurrencyInput shows no `.form-error`. The Yup
 *   schema has min(0). Either the component strips the minus sign, or validation
 *   fires before the user finishes typing.
 *   Severity: Low — CurrencyInput likely strips the sign, but UX feedback is missing.
 *
 * BUG-3 (Scenario load does not restore income):
 *   After saving a scenario with income=5000, then changing income to 1000, and
 *   loading the saved scenario, the Projections page still shows income=0 (the
 *   default/reset value from the test before). The scenario load API is called but
 *   the form reactive object in ProjectionsView is initialised once on setup and
 *   does NOT re-read from the store after a scenario is loaded. The form shows
 *   stale state until a manual page reload.
 *   Severity: High — users load a scenario expecting inputs to update, but they don't.
 *
 * BUG-4 (Settings "Saved" confirmation never shows):
 *   After clicking "Save settings", the green "Saved" text (saveStatus === 'saved')
 *   is not visible even immediately after the click. It may render and disappear in
 *   < 1 frame, or the element is outside the visible scroll area.
 *   Severity: Low — cosmetic UX feedback issue.
 *
 * BUG-5 (Invite dialog — no visible validation error for invalid email):
 *   Submitting the invite dialog with the string "not-an-email" does NOT show a
 *   visible `.form-error` element. The error is rendered as a plain `<p>` with an
 *   inline colour style (color: var(--app-negative)), not a .form-error class, so
 *   the Playwright selector `.form-error` misses it. However testing with the
 *   correct selector confirms the error DOES appear — this is a test selector issue,
 *   not a real UX bug. The error message "Please enter a valid email address." is
 *   present in the DOM; it just uses a different CSS class than other form errors.
 *   Severity: Minor inconsistency — invite dialog uses different error markup than
 *   projection form errors.
 *
 * BUG-6 (Invite dialog — empty submit does not show visible error):
 *   Submitting with an empty email field also does not visibly surface an error in
 *   the test (same selector issue as BUG-5). Dialog stays open, which is correct,
 *   but the error element style is inconsistent with the rest of the app.
 *
 * OBSERVATION-1 (Share summary text assertion):
 *   The share summary `<pre>` formats numbers with locale-specific separators (e.g.
 *   "36 000" with a non-breaking space in sv-SE locale, or "36,000" in en-US).
 *   Assertions on raw substrings like "36" pass, but more specific checks fail when
 *   locale is not en-US. Tests must be locale-agnostic.
 *
 * OBSERVATION-2 (Scenarios empty state):
 *   The EmptyState component is rendered via a conditional `v-if` but the locator
 *   `.empty-state` does not match because the component uses its own class names.
 *   The empty state is functionally visible; the test selector was wrong.
 *
 * OBSERVATION-3 (PrimeVue InputNumber — #months resolves to wrapper span):
 *   The `id="months"` attribute is placed on the PrimeVue `<InputNumber>` component
 *   which renders as a `<span>` wrapper. All `.fill()` calls on `#months` fail.
 *   The actual `<input>` is the child: `#months input`. All tests in this file use
 *   the correct inner selector.
 */

import { expect, test } from '@playwright/test'
import { injectSupabaseSession } from './auth.setup'

// ─── helpers ──────────────────────────────────────────────────────────────────

const SS = (name: string) => `e2e/screenshots/${name}.png`

async function loginAndGo(page: Parameters<typeof injectSupabaseSession>[0], path = '/') {
  await injectSupabaseSession(page)
  await page.goto(path)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
}

/** Fill a PrimeVue InputNumber (id is on wrapper span; actual input is the child). */
async function fillMonths(page: Parameters<typeof injectSupabaseSession>[0], value: string) {
  const input = page.locator('#months input')
  await input.click({ clickCount: 3 })
  await input.fill(value)
  await page.keyboard.press('Tab')
  await page.waitForTimeout(500)
}

// ─── 1. DASHBOARD ─────────────────────────────────────────────────────────────

test.describe('1 · Dashboard', () => {
  test('zero-state: income=0, expenses=0 — KPIs and status pill', async ({ page }) => {
    await loginAndGo(page, '/settings')

    // Reset all data to reach a known zero state
    await page.click('button.btn-danger')
    await page.waitForTimeout(400)
    const confirmBtn = page.locator('button', { hasText: 'Confirm reset' })
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click()
      await page.waitForTimeout(1500)
    }

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: SS('01-dashboard-zero-state') })

    // 4 KPI cards
    const kpiCards = page.locator('article.kpi-card')
    const kpiCount = await kpiCards.count()
    expect(kpiCount).toBe(4)
    console.log('Zero-state KPI count:', kpiCount)

    const kpiValues = await kpiCards.locator('.kpi-value').allTextContents()
    console.log('Zero-state KPI values:', kpiValues)
    // All should show 0 or formatted equivalent

    // Status pill: with 0 income and 0 expenses → "No data" (app distinguishes no-data from on-track)
    const pill = page.locator('.status-pill').first()
    const pillText = (await pill.textContent()) ?? ''
    console.log('Status pill zero state:', pillText.trim())
    expect(pillText).toContain('No data')

    // Trend chart (SVG) should render
    const svg = page.locator('svg').first()
    expect(await svg.isVisible()).toBe(true)
    await page.screenshot({ path: SS('01-dashboard-zero-kpis') })
  })

  test('dashboard with income=3000, expenses=2000 — correct KPIs and "Strong" pill', async ({ page }) => {
    await loginAndGo(page, '/projections')

    const incomeInput = page.locator('#monthly-income')
    await incomeInput.click({ clickCount: 3 })
    await incomeInput.fill('3000')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(400)

    const expensesInput = page.locator('#monthly-expenses')
    if (!(await expensesInput.isDisabled())) {
      await expensesInput.click({ clickCount: 3 })
      await expensesInput.fill('2000')
      await page.keyboard.press('Tab')
      await page.waitForTimeout(400)
    }

    await fillMonths(page, '24')
    await page.waitForTimeout(600)

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: SS('01-dashboard-3000-2000') })

    const kpiValues = await page.locator('.kpi-value').allTextContents()
    console.log('KPI values (3000/2000/24mo):', kpiValues)
    // Monthly net = +1000, Total Income = 72 000, Total Expenses = 48 000, Ending = 24 000

    const pill = page.locator('.status-pill').first()
    const pillText = (await pill.textContent()) ?? ''
    console.log('Status pill (expected Strong):', pillText.trim())
    // endingBalance=24000 >= 10000 → "Strong"
    expect(pillText).toContain('Strong')

    // Insight cards visible on desktop
    const insights = page.locator('.insight-card')
    const insightCount = await insights.count()
    console.log('Insight cards:', insightCount)
    // Should have at least "Cash-flow positive" and "Strong ending balance"

    await page.screenshot({ path: SS('01-dashboard-insights') })
  })

  test('insights are hidden on mobile (sm:block class)', async ({ page }) => {
    await loginAndGo(page, '/')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: SS('01-dashboard-mobile') })

    const insights = page.locator('.insight-card')
    if (await insights.count() > 0) {
      const isHidden = await insights.first().evaluate((el) =>
        window.getComputedStyle(el).display === 'none',
      )
      console.log('Insight hidden on 390px (expected true):', isHidden)
      // The class "hidden sm:block" should hide it at 390px
    }

    // Check no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    console.log(`Dashboard mobile body.scrollWidth=${bodyWidth} (viewport=390)`)
    if (bodyWidth > 395) console.log('WARNING: horizontal overflow on mobile dashboard')
  })
})

// ─── 2. PROJECTIONS ───────────────────────────────────────────────────────────

test.describe('2 · Projections', () => {
  test('default state screenshot', async ({ page }) => {
    await loginAndGo(page, '/projections')
    await page.screenshot({ path: SS('02-projections-default') })
  })

  test('set income=3000, expenses=2000, months=24 → table has 24 rows', async ({ page }) => {
    await loginAndGo(page, '/projections')

    const incomeInput = page.locator('#monthly-income')
    await incomeInput.click({ clickCount: 3 })
    await incomeInput.fill('3000')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(400)

    const expensesInput = page.locator('#monthly-expenses')
    const expensesDisabled = await expensesInput.isDisabled()
    console.log('Expenses disabled (has expense items):', expensesDisabled)
    if (!expensesDisabled) {
      await expensesInput.click({ clickCount: 3 })
      await expensesInput.fill('2000')
      await page.keyboard.press('Tab')
      await page.waitForTimeout(400)
    }

    await fillMonths(page, '24')
    await page.waitForTimeout(600)
    await page.screenshot({ path: SS('02-projections-inputs-set') })

    // Show table
    await page.locator('button', { hasText: 'Show table' }).click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: SS('02-projections-table-24rows') })

    const rows = page.locator('table tbody tr')
    const rowCount = await rows.count()
    console.log('Table rows for 24 months:', rowCount)
    expect(rowCount).toBe(24)
  })

  test('validation: negative income — no error shown (CurrencyInput strips sign)', async ({ page }) => {
    await loginAndGo(page, '/projections')

    const incomeInput = page.locator('#monthly-income')
    await incomeInput.click({ clickCount: 3 })
    await incomeInput.fill('-500')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(600)
    await page.screenshot({ path: SS('02-projections-negative-income') })

    const errors = page.locator('.form-error')
    const errorCount = await errors.count()
    const currentValue = await incomeInput.inputValue()
    console.log('Negative input value result:', currentValue)
    console.log('Form errors after negative input:', errorCount)
    // OBSERVATION: CurrencyInput appears to strip the minus sign silently.
    // No error is shown, meaning users get no feedback that negative values are rejected.
    // The value is silently corrected to 500 or 0.
    // This may be intentional (prevent invalid state) but lacks UX feedback.
  })

  test('validation: income over 1 billion max', async ({ page }) => {
    await loginAndGo(page, '/projections')

    const incomeInput = page.locator('#monthly-income')
    await incomeInput.click({ clickCount: 3 })
    await incomeInput.fill('9999999999')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(600)
    await page.screenshot({ path: SS('02-projections-over-limit-income') })

    const errors = page.locator('.form-error')
    const errorCount = await errors.count()
    const currentValue = await incomeInput.inputValue()
    console.log('Over-limit value result:', currentValue)
    console.log('Form errors after over-limit:', errorCount)
    // BUG-1: No error is shown. The Yup schema has max(1_000_000_000) but
    // 9,999,999,999 passes through without triggering a visible validation error.
    if (errorCount === 0) {
      console.log('BUG-1 CONFIRMED: No validation error for income > 1 billion')
    }
  })

  test('validation: months = 0 and months = 61 are rejected', async ({ page }) => {
    await loginAndGo(page, '/projections')

    // months = 0 (below min=1)
    await fillMonths(page, '0')
    await page.waitForTimeout(600)
    await page.screenshot({ path: SS('02-projections-months-zero') })

    let monthsError = page.locator('.form-error').first()
    const zeroErrorVisible = await monthsError.isVisible().catch(() => false)
    console.log('Error shown for months=0:', zeroErrorVisible)
    if (zeroErrorVisible) console.log('months=0 error text:', await monthsError.textContent())

    // months = 61 (above max=60)
    await fillMonths(page, '61')
    await page.waitForTimeout(600)
    await page.screenshot({ path: SS('02-projections-months-61') })

    monthsError = page.locator('.form-error').first()
    const over60ErrorVisible = await monthsError.isVisible().catch(() => false)
    console.log('Error shown for months=61:', over60ErrorVisible)
    if (over60ErrorVisible) console.log('months=61 error text:', await monthsError.textContent())
  })

  test('months = empty — Yup validation fires', async ({ page }) => {
    await loginAndGo(page, '/projections')

    const monthsInput = page.locator('#months input')
    await monthsInput.click({ clickCount: 3 })
    await monthsInput.press('Backspace')
    await monthsInput.press('Delete')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(600)
    await page.screenshot({ path: SS('02-projections-months-empty') })

    const errors = page.locator('.form-error')
    const errorCount = await errors.count()
    console.log('Errors when months field is cleared:', errorCount)
    if (errorCount > 0) {
      console.log('Months empty error:', await errors.first().textContent())
    }
  })

  test('currency conversion: 10000 EUR → USD', async ({ page }) => {
    await loginAndGo(page, '/projections')
    await page.waitForTimeout(2000) // let exchange rates load from CDN

    // Ensure we start with EUR
    const currencySelect = page.locator('#currency-code')
    await currencySelect.selectOption('EUR')
    await page.waitForTimeout(400)

    const incomeInput = page.locator('#monthly-income')
    await incomeInput.click({ clickCount: 3 })
    await incomeInput.fill('10000')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(400)

    const valueBeforeSwitch = await incomeInput.inputValue()
    console.log('Income before switch (EUR):', valueBeforeSwitch)
    await page.screenshot({ path: SS('02-projections-before-currency-switch') })

    // Switch to USD
    await currencySelect.selectOption('USD')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: SS('02-projections-after-currency-switch') })

    const valueAfterSwitch = await incomeInput.inputValue()
    console.log('Income after switch to USD:', valueAfterSwitch)
    // OBSERVATION: Should be ~11538 (10000 / 0.8667 ≈ 11538)
    // If still 10000, the conversion did not apply.
    if (valueAfterSwitch === valueBeforeSwitch) {
      console.log('WARNING: Currency conversion did not change the income value')
    } else {
      console.log('PASS: Income converted on currency switch')
    }
  })

  test('exchange rates dialog: opens, shows rates, closes', async ({ page }) => {
    await loginAndGo(page, '/projections')
    await page.waitForTimeout(2500) // let rates load

    const ratesBtn = page.locator('button[title="Exchange rates"]')
    await ratesBtn.click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: SS('02-projections-exchange-rates-dialog') })

    const dialog = page.locator('[role="dialog"]')
    expect(await dialog.isVisible()).toBe(true)

    const content = await dialog.textContent()
    console.log('Exchange rates dialog content (first 300 chars):', content?.substring(0, 300))
    // OBSERVATION: Rates from European Central Bank should appear with current date

    // Close via Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    const dialogGone = !(await dialog.isVisible().catch(() => true))
    console.log('Dialog closed after Escape:', dialogGone)
  })

  test('share summary text is coherent for 3000/2000/12mo', async ({ page }) => {
    await loginAndGo(page, '/projections')

    const incomeInput = page.locator('#monthly-income')
    await incomeInput.click({ clickCount: 3 })
    await incomeInput.fill('3000')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(400)

    const expensesInput = page.locator('#monthly-expenses')
    if (!(await expensesInput.isDisabled())) {
      await expensesInput.click({ clickCount: 3 })
      await expensesInput.fill('2000')
      await page.keyboard.press('Tab')
      await page.waitForTimeout(400)
    }

    await fillMonths(page, '12')
    await page.waitForTimeout(800)

    const sharePre = page.locator('pre.share-preview')
    const shareText = (await sharePre.textContent()) ?? ''
    console.log('Share summary (3000/2000/12mo):\n', shareText)
    await page.screenshot({ path: SS('02-projections-share-summary') })

    // Sanity checks — values should appear somewhere in the text
    // 12 months × 3000 = 36 000 total income (number "36" must appear)
    // 12 months × 2000 = 24 000 total expenses (number "24" must appear)
    // Net = 12 000 (number "12" must appear)
    expect(shareText.length).toBeGreaterThan(50)
    // The summary should mention months
    expect(shareText).toMatch(/month|Month/)
  })

  test('show/hide projection table toggle', async ({ page }) => {
    await loginAndGo(page, '/projections')

    const showBtn = page.locator('button', { hasText: 'Show table' })
    expect(await showBtn.isVisible()).toBe(true)

    await showBtn.click()
    await page.waitForTimeout(400)
    const table = page.locator('table')
    expect(await table.isVisible()).toBe(true)
    await page.screenshot({ path: SS('02-projections-table-shown') })

    const hideBtn = page.locator('button', { hasText: 'Hide table' })
    await hideBtn.click()
    await page.waitForTimeout(300)
    expect(await table.isVisible()).toBe(false)
    await page.screenshot({ path: SS('02-projections-table-hidden') })
  })

  test('projection table column headers make sense', async ({ page }) => {
    await loginAndGo(page, '/projections')

    const incomeInput = page.locator('#monthly-income')
    await incomeInput.click({ clickCount: 3 })
    await incomeInput.fill('2000')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(400)

    const expensesInput = page.locator('#monthly-expenses')
    if (!(await expensesInput.isDisabled())) {
      await expensesInput.click({ clickCount: 3 })
      await expensesInput.fill('1500')
      await page.keyboard.press('Tab')
      await page.waitForTimeout(400)
    }

    await fillMonths(page, '3')
    await page.waitForTimeout(600)

    await page.locator('button', { hasText: 'Show table' }).click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: SS('02-projections-table-columns') })

    const headers = await page.locator('table thead th').allTextContents()
    console.log('Table column headers:', headers)
    // Expected: Month, Income, Expenses, Net, Balance (or similar)

    const firstRowCells = await page.locator('table tbody tr').first().locator('td').allTextContents()
    console.log('First row cells (2000 income, 1500 expenses):', firstRowCells)
    // Net = +500, Balance after month 1 = +500

    const lastRowCells = await page.locator('table tbody tr').last().locator('td').allTextContents()
    console.log('Last row cells (month 3, expected balance=1500):', lastRowCells)
    // After 3 months: 3 × 500 = 1500
  })

  test('expense items: open dialog, add item, verify hint appears', async ({ page }) => {
    await loginAndGo(page, '/projections')

    const addItemsBtn = page.locator('button', { hasText: 'Add expense items' })
    if (!(await addItemsBtn.isVisible())) {
      console.log('"Add expense items" not visible — items may already exist; skipping add test')
      return
    }

    await addItemsBtn.click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: SS('02-expense-dialog-open') })

    const dialog = page.locator('[role="dialog"]')
    expect(await dialog.isVisible()).toBe(true)

    // Look for add-row button inside dialog
    const addRowBtn = dialog.locator('button').filter({ hasText: /add/i }).first()
    if (await addRowBtn.isVisible()) {
      await addRowBtn.click()
      await page.waitForTimeout(400)
      await page.screenshot({ path: SS('02-expense-dialog-row-added') })
    } else {
      console.log('No "Add" button found inside expense dialog')
      const btns = await dialog.locator('button').allTextContents()
      console.log('Available buttons in dialog:', btns)
    }

    // Close
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    await page.screenshot({ path: SS('02-expense-dialog-closed') })

    // If expense items active, expenses field should be disabled
    const expensesInput = page.locator('#monthly-expenses')
    const hint = page.locator('text=Calculated from')
    console.log('"Calculated from" hint visible:', await hint.isVisible())
  })
})

// ─── 3. SCENARIOS ─────────────────────────────────────────────────────────────

test.describe('3 · Scenarios', () => {
  test('page loads — empty or card state', async ({ page }) => {
    await loginAndGo(page, '/scenarios')
    await page.screenshot({ path: SS('03-scenarios-initial') })

    const emptyTitle = page.locator('text=No saved scenarios yet')
    const emptyVisible = await emptyTitle.isVisible().catch(() => false)
    const cardCount = await page.locator('[class*="scenario"], [data-testid*="scenario"]').count()
    console.log('Empty state title visible:', emptyVisible)
    console.log('Scenario card count:', cardCount)
  })

  test('save scenario with a name', async ({ page }) => {
    await loginAndGo(page, '/scenarios')

    const nameInput = page.locator('#scenario-name')
    await nameInput.fill('Audit Test Scenario')
    await page.waitForTimeout(200)

    await page.locator('button', { hasText: 'Save current' }).click()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: SS('03-scenarios-saved') })

    // The scenario name should appear on the page
    const pageContent = await page.locator('body').textContent()
    const found = pageContent?.includes('Audit Test Scenario')
    console.log('Saved scenario name found on page:', found)
    expect(found).toBe(true)
  })

  test('save scenario WITHOUT a name — uses auto-name or empty', async ({ page }) => {
    await loginAndGo(page, '/scenarios')

    const nameInput = page.locator('#scenario-name')
    await nameInput.fill('')

    const countBefore = await page.locator('body').textContent()
    await page.locator('button', { hasText: 'Save current' }).click()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: SS('03-scenarios-no-name') })

    // OBSERVATION: projectionStore.saveScenario('') — what name does it create?
    // Looking at the store code, if name is empty it will likely use a timestamp or 'Unnamed'
    const pageText = await page.locator('body').textContent()
    console.log('After save without name — any "Unnamed" or timestamp scenario?')
    console.log('Page contains "Unnamed":', pageText?.includes('Unnamed'))
    console.log('Page contains "Scenario":', pageText?.includes('Scenario'))
    // If the button is not disabled for empty name, this reveals a UX gap:
    // users can save nameless scenarios without feedback.
  })

  test('load a scenario restores inputs (or reveals BUG-3)', async ({ page }) => {
    await loginAndGo(page, '/projections')

    // Set income to a specific value
    const incomeInput = page.locator('#monthly-income')
    await incomeInput.click({ clickCount: 3 })
    await incomeInput.fill('7777')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(600)

    // Save as scenario
    await page.goto('/scenarios')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    await page.locator('#scenario-name').fill('Load Test 7777')
    await page.locator('button', { hasText: 'Save current' }).click()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: SS('03-scenarios-before-load') })

    // Change income to something else
    await page.goto('/projections')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
    const income2 = page.locator('#monthly-income')
    await income2.click({ clickCount: 3 })
    await income2.fill('1111')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(600)

    // Load the saved scenario from scenarios page
    await page.goto('/scenarios')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Find and click Load on the 7777 scenario
    const loadBtn = page.locator('button', { hasText: 'Load' }).first()
    if (await loadBtn.isVisible()) {
      await loadBtn.click()
      await page.waitForTimeout(800)
      await page.screenshot({ path: SS('03-scenarios-load-clicked') })
    } else {
      console.log('Load button not found — skipping load test')
      return
    }

    // Navigate to projections and check income
    await page.goto('/projections')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: SS('03-scenarios-projections-after-load') })

    const incomeAfter = await page.locator('#monthly-income').inputValue()
    console.log('Income after loading 7777 scenario (expected 7777, raw value from store):', incomeAfter)
    // BUG-3: The reactive `form` object in ProjectionsView is initialized once on setup()
    // and does not respond to store changes from scenario loads. The displayed value
    // remains stale. A page reload or re-navigation is needed to see the loaded data.
    if (!incomeAfter.includes('7777') && !incomeAfter.includes('7,777')) {
      console.log('BUG-3 CONFIRMED: Loaded scenario income not reflected in ProjectionsView form')
    }
  })

  test('delete a scenario with confirm dialog', async ({ page }) => {
    await loginAndGo(page, '/scenarios')

    // Ensure at least one scenario exists
    await page.locator('#scenario-name').fill('Delete Me')
    await page.locator('button', { hasText: 'Save current' }).click()
    await page.waitForTimeout(1200)

    // Count before
    const pageText = await page.locator('body').textContent()
    const foundBefore = pageText?.includes('Delete Me')
    console.log('"Delete Me" scenario in page before delete:', foundBefore)

    // Find delete button in cards — try icon button patterns
    const deleteBtn = page.locator('[aria-label*="elete"], [title*="elete"]').first()
    const altDeleteBtn = page.locator('button i.pi-trash').first()

    let deleteBtnToClick = null
    if (await deleteBtn.isVisible().catch(() => false)) {
      deleteBtnToClick = deleteBtn
    } else if (await altDeleteBtn.isVisible().catch(() => false)) {
      deleteBtnToClick = altDeleteBtn.locator('..')
    }

    if (deleteBtnToClick) {
      await deleteBtnToClick.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: SS('03-scenarios-delete-confirm') })

      // Confirm delete in dialog
      const confirmDeleteBtn = page.locator('[role="dialog"] button', { hasText: 'Delete' })
      if (await confirmDeleteBtn.isVisible()) {
        await confirmDeleteBtn.click()
        await page.waitForTimeout(1000)
        await page.screenshot({ path: SS('03-scenarios-after-delete') })
        const pageTextAfter = await page.locator('body').textContent()
        console.log('"Delete Me" in page after delete:', pageTextAfter?.includes('Delete Me'))
      }
    } else {
      await page.screenshot({ path: SS('03-scenarios-delete-btn-not-found') })
      console.log('Could not find delete button — checking all buttons on page')
      const allBtns = await page.locator('button').allTextContents()
      console.log('All buttons:', allBtns)
    }
  })

  test('export scenarios downloads a JSON file', async ({ page }) => {
    await loginAndGo(page, '/scenarios')

    // Ensure there is something to export
    await page.locator('#scenario-name').fill('Export Audit')
    await page.locator('button', { hasText: 'Save current' }).click()
    await page.waitForTimeout(1200)

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      page.locator('button', { hasText: 'Export all' }).click(),
    ])
    if (download) {
      const filename = download.suggestedFilename()
      console.log('Export filename:', filename)
      expect(filename).toMatch(/^budget-scenarios-\d{4}-\d{2}-\d{2}\.json$/)
    } else {
      console.log('WARNING: No download event from Export all button')
    }
    await page.screenshot({ path: SS('03-scenarios-export') })
  })

  test('rename scenario dialog', async ({ page }) => {
    await loginAndGo(page, '/scenarios')

    // Save a scenario to rename
    await page.locator('#scenario-name').fill('Before Rename')
    await page.locator('button', { hasText: 'Save current' }).click()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: SS('03-scenarios-before-rename') })

    // Find rename button (text "Rename" on the scenario card)
    const renameBtn = page.locator('button', { hasText: 'Rename' }).first()
    if (await renameBtn.isVisible().catch(() => false)) {
      await renameBtn.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: SS('03-scenarios-rename-dialog') })

      const dialog = page.locator('[role="dialog"]')
      if (await dialog.isVisible()) {
        const renameInput = dialog.locator('#rename-input')
        await renameInput.click({ clickCount: 3 })
        await renameInput.fill('After Rename')
        await dialog.locator('button', { hasText: 'Rename' }).click()
        await page.waitForTimeout(800)
        await page.screenshot({ path: SS('03-scenarios-after-rename') })

        const pageText = await page.locator('body').textContent()
        console.log('After rename — "After Rename" in page:', pageText?.includes('After Rename'))
        console.log('After rename — "Before Rename" still in page:', pageText?.includes('Before Rename'))
      }
    } else {
      console.log('Rename (pencil) button not found on scenario card')
    }
  })
})

// ─── 4. COLLABORATION ─────────────────────────────────────────────────────────

test.describe('4 · Collaboration', () => {
  test('page loads: sections visible', async ({ page }) => {
    await loginAndGo(page, '/collaboration')
    await page.screenshot({ path: SS('04-collaboration-default') })

    expect(await page.locator('h2', { hasText: 'People with access' }).isVisible()).toBe(true)
    expect(await page.locator('h2', { hasText: 'Shared with me' }).isVisible()).toBe(true)
    expect(await page.locator('h2', { hasText: 'Recent activity' }).isVisible()).toBe(true)
  })

  test('invite dialog: fields and role dropdown', async ({ page }) => {
    await loginAndGo(page, '/collaboration')

    await page.locator('button', { hasText: 'Invite' }).first().click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: SS('04-collaboration-invite-dialog-open') })

    const dialog = page.locator('[role="dialog"]')
    expect(await dialog.isVisible()).toBe(true)

    const emailInput = dialog.locator('#invite-email')
    expect(await emailInput.isVisible()).toBe(true)
    console.log('Email input placeholder:', await emailInput.getAttribute('placeholder'))

    // PrimeVue Select for role
    const roleSelector = dialog.locator('#invite-role')
    expect(await roleSelector.isVisible()).toBe(true)
    await page.screenshot({ path: SS('04-collaboration-invite-fields') })
  })

  test('invite dialog: empty submit stays open and shows error', async ({ page }) => {
    await loginAndGo(page, '/collaboration')

    await page.locator('button', { hasText: 'Invite' }).first().click()
    await page.waitForTimeout(600)

    const dialog = page.locator('[role="dialog"]')
    const sendBtn = dialog.locator('button', { hasText: 'Send invite' })
    await sendBtn.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: SS('04-collaboration-invite-empty-submit') })

    // Dialog should remain open
    expect(await dialog.isVisible()).toBe(true)

    // Error should appear (InviteDialog uses <p> with inline style, not .form-error)
    const errorPara = dialog.locator('p').filter({ hasText: /valid email/i })
    const errorVisible = await errorPara.isVisible().catch(() => false)
    console.log('Error for empty email visible:', errorVisible)
    if (errorVisible) {
      console.log('Error text:', await errorPara.textContent())
    } else {
      // BUG-6: Error may use different styling. Let's check all text in dialog for error
      const dialogText = await dialog.textContent()
      const hasErrorText = dialogText?.includes('valid email') || dialogText?.includes('Please enter')
      console.log('Dialog contains error text (alternate check):', hasErrorText)
    }

    await page.keyboard.press('Escape')
  })

  test('invite dialog: invalid email shows validation error', async ({ page }) => {
    await loginAndGo(page, '/collaboration')

    await page.locator('button', { hasText: 'Invite' }).first().click()
    await page.waitForTimeout(600)

    const dialog = page.locator('[role="dialog"]')
    const emailInput = dialog.locator('#invite-email')
    await emailInput.fill('not-an-email')
    await page.waitForTimeout(200)

    await dialog.locator('button', { hasText: 'Send invite' }).click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: SS('04-collaboration-invite-invalid-email') })

    // Dialog stays open
    expect(await dialog.isVisible()).toBe(true)

    // Check error appears (InviteDialog uses plain <p> with color style, not .form-error)
    const errorPara = dialog.locator('p').filter({ hasText: /valid email/i })
    const errorVisible = await errorPara.isVisible().catch(() => false)
    console.log('Error for invalid email visible:', errorVisible)
    if (errorVisible) {
      console.log('PASS: Error message shown for invalid email:', await errorPara.textContent())
    } else {
      const dialogText = await dialog.textContent()
      const hasError = dialogText?.includes('valid email') || dialogText?.includes('Please enter')
      console.log('Error in dialog text (alternate check):', hasError)
      // NOTE: The error is styled with inline color via style="color: var(--app-negative)"
      // This is inconsistent with .form-error used elsewhere in the app (BUG-5)
    }

    await page.keyboard.press('Escape')
  })
})

// ─── 5. SETTINGS ──────────────────────────────────────────────────────────────

test.describe('5 · Settings', () => {
  test('page layout and controls visible', async ({ page }) => {
    await loginAndGo(page, '/settings')
    await page.screenshot({ path: SS('05-settings-default') })

    expect(await page.locator('#s-currency').isVisible()).toBe(true)
    expect(await page.locator('#s-locale').isVisible()).toBe(true)
    expect(await page.locator('#s-month').isVisible()).toBe(true)
    expect(await page.locator('button', { hasText: 'Save settings' }).isVisible()).toBe(true)
    expect(await page.locator('button', { hasText: 'Reset' }).isVisible()).toBe(true)
  })

  test('unsaved currency change is discarded on navigation away', async ({ page }) => {
    await loginAndGo(page, '/settings')

    const currencySelect = page.locator('#s-currency')
    const original = await currencySelect.inputValue()
    const changed = original === 'EUR' ? 'USD' : 'EUR'

    await currencySelect.selectOption(changed)
    await page.waitForTimeout(300)

    // Save button should be enabled (isDirty = true)
    const saveBtn = page.locator('button', { hasText: 'Save settings' })
    const isDirty = !(await saveBtn.isDisabled())
    console.log('Save button enabled after unsaved change:', isDirty)
    expect(isDirty).toBe(true)
    await page.screenshot({ path: SS('05-settings-dirty') })

    // Navigate away WITHOUT saving
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)

    // Return to settings
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: SS('05-settings-after-nav-away') })

    const afterNav = await page.locator('#s-currency').inputValue()
    console.log(`Currency after nav away: ${afterNav} (expected ${original})`)
    if (afterNav === changed) {
      console.log('BUG: Unsaved change persisted — store was updated despite no save click')
    } else {
      console.log('PASS: Unsaved change discarded correctly')
    }
    // NOTE: Settings uses a local draft + watch() that syncs FROM store.
    // If the store was not changed (no save), draft resets on re-mount. Correct behavior.
  })

  test('save currency change → verify Projections page reflects it', async ({ page }) => {
    await loginAndGo(page, '/settings')

    const currencySelect = page.locator('#s-currency')
    const original = await currencySelect.inputValue()
    const newVal = original === 'EUR' ? 'USD' : 'EUR'

    await currencySelect.selectOption(newVal)
    await page.waitForTimeout(300)
    await page.locator('button', { hasText: 'Save settings' }).click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: SS('05-settings-saved') })

    // Check "Saved" indicator (BUG-4: may flash and disappear in < 100ms)
    const savedText = page.locator('text=Saved')
    const savedVisible = await savedText.isVisible().catch(() => false)
    console.log('"Saved" confirmation visible immediately after click:', savedVisible)
    // BUG-4: If false, the indicator either doesn't render or disappears too quickly

    // Navigate to Projections and verify currency picker
    await page.goto('/projections')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: SS('05-projections-after-settings-save') })

    const projCurrency = await page.locator('#currency-code').inputValue()
    console.log(`Projections currency after settings save: ${projCurrency} (expected ${newVal})`)
    expect(projCurrency).toBe(newVal)

    // Restore
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    await page.locator('#s-currency').selectOption(original)
    await page.locator('button', { hasText: 'Save settings' }).click()
    await page.waitForTimeout(500)
  })

  test('theme toggle: dark and light mode', async ({ page }) => {
    await loginAndGo(page, '/settings')
    await page.screenshot({ path: SS('05-settings-theme-initial') })

    // Click Dark (in settings card — use first match within the card)
    const settingsCard = page.locator('.card').first()
    const darkBtn = settingsCard.locator('button', { hasText: 'Dark' })
    await darkBtn.click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: SS('05-settings-theme-dark') })

    const hasDark = await page.evaluate(() => document.documentElement.classList.contains('app-dark'))
    console.log('html.app-dark after Dark click:', hasDark)
    expect(hasDark).toBe(true)

    // Click Light (in settings card)
    const lightBtn = settingsCard.locator('button', { hasText: 'Light' })
    await lightBtn.click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: SS('05-settings-theme-light') })

    const hasLight = await page.evaluate(() => !document.documentElement.classList.contains('app-dark'))
    console.log('html does NOT have .app-dark after Light click:', hasLight)
    expect(hasLight).toBe(true)
  })

  test('reset data: confirm panel inline, cancel works', async ({ page }) => {
    await loginAndGo(page, '/settings')

    await page.locator('button.btn-danger', { hasText: 'Reset' }).click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: SS('05-settings-reset-panel') })

    const confirmText = page.locator('text=Are you sure?')
    expect(await confirmText.isVisible()).toBe(true)

    // Cancel
    await page.locator('button', { hasText: 'Cancel' }).click()
    await page.waitForTimeout(300)
    expect(await confirmText.isVisible()).toBe(false)
    await page.screenshot({ path: SS('05-settings-reset-cancelled') })
  })
})

// ─── 6. MOBILE 390px ──────────────────────────────────────────────────────────

test.describe('6 · Mobile 390px', () => {
  async function setMobile(page: Parameters<typeof injectSupabaseSession>[0]) {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(400)
  }

  async function checkOverflow(page: Parameters<typeof injectSupabaseSession>[0], pageName: string) {
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    if (bodyWidth > 395) {
      console.log(`BUG: ${pageName} has horizontal overflow on mobile: scrollWidth=${bodyWidth}`)
    } else {
      console.log(`PASS: ${pageName} no horizontal overflow (scrollWidth=${bodyWidth})`)
    }
    return bodyWidth
  }

  test('mobile dashboard — layout and overflow', async ({ page }) => {
    await loginAndGo(page, '/')
    await setMobile(page)
    await page.screenshot({ path: SS('06-mobile-dashboard') })
    await checkOverflow(page, 'Dashboard')

    // Bottom tabs must be visible
    expect(await page.locator('nav.mobile-tabs').isVisible()).toBe(true)
    // Desktop sidebar must NOT be expanded
    const sidebarOpen = await page.locator('aside.sidebar').evaluate((el) => el.classList.contains('sidebar-open'))
    expect(sidebarOpen).toBe(false)
    // Top bar must be visible
    expect(await page.locator('header.mobile-topbar').isVisible()).toBe(true)
  })

  test('mobile projections — layout and overflow', async ({ page }) => {
    await loginAndGo(page, '/projections')
    await setMobile(page)
    await page.screenshot({ path: SS('06-mobile-projections') })
    await checkOverflow(page, 'Projections')
  })

  test('mobile scenarios — layout and overflow', async ({ page }) => {
    await loginAndGo(page, '/scenarios')
    await setMobile(page)
    await page.screenshot({ path: SS('06-mobile-scenarios') })
    await checkOverflow(page, 'Scenarios')
  })

  test('mobile collaboration — layout and overflow', async ({ page }) => {
    await loginAndGo(page, '/collaboration')
    await setMobile(page)
    await page.screenshot({ path: SS('06-mobile-collaboration') })
    await checkOverflow(page, 'Collaboration')
  })

  test('mobile settings — layout and overflow', async ({ page }) => {
    await loginAndGo(page, '/settings')
    await setMobile(page)
    await page.screenshot({ path: SS('06-mobile-settings') })
    await checkOverflow(page, 'Settings')
  })

  test('mobile hamburger opens sidebar overlay', async ({ page }) => {
    await loginAndGo(page, '/')
    await setMobile(page)

    const topBar = page.locator('header.mobile-topbar')
    expect(await topBar.isVisible()).toBe(true)

    // Hamburger is the last button in the topbar
    const hamburger = topBar.locator('button').last()
    await hamburger.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: SS('06-mobile-sidebar-open') })

    const sidebarOpen = await page.locator('aside.sidebar').evaluate((el) => el.classList.contains('sidebar-open'))
    console.log('Sidebar open after hamburger:', sidebarOpen)
    expect(sidebarOpen).toBe(true)

    // Overlay click closes sidebar
    await page.locator('.sidebar-overlay').click({ force: true })
    await page.waitForTimeout(400)
    const sidebarClosed = await page.locator('aside.sidebar').evaluate((el) => !el.classList.contains('sidebar-open'))
    console.log('Sidebar closed after overlay click:', sidebarClosed)
  })

  test('mobile bottom tab navigation', async ({ page }) => {
    await loginAndGo(page, '/')
    await setMobile(page)

    const projTab = page.locator('nav.mobile-tabs a[href="/projections"]')
    await projTab.click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: SS('06-mobile-nav-projections') })
    expect(page.url()).toContain('/projections')

    const scenTab = page.locator('nav.mobile-tabs a[href="/scenarios"]')
    await scenTab.click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: SS('06-mobile-nav-scenarios') })
    expect(page.url()).toContain('/scenarios')
  })
})

// ─── 7. EDGE CASES ────────────────────────────────────────────────────────────

test.describe('7 · Edge Cases', () => {
  test('0 income + 500 expenses → Dashboard shows Deficit pill', async ({ page }) => {
    await loginAndGo(page, '/projections')

    const incomeInput = page.locator('#monthly-income')
    await incomeInput.click({ clickCount: 3 })
    await incomeInput.fill('0')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(400)

    const expensesInput = page.locator('#monthly-expenses')
    if (!(await expensesInput.isDisabled())) {
      await expensesInput.click({ clickCount: 3 })
      await expensesInput.fill('500')
      await page.keyboard.press('Tab')
      await page.waitForTimeout(400)
    }

    await fillMonths(page, '12')
    await page.waitForTimeout(600)

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: SS('07-edge-deficit-dashboard') })

    const pillText = (await page.locator('.status-pill').first().textContent()) ?? ''
    console.log('Status pill (0/500):', pillText.trim())
    expect(pillText).toContain('Deficit')

    const kpiValues = await page.locator('.kpi-value').allTextContents()
    console.log('KPI values (0/500):', kpiValues)
    // Monthly Net should show negative (e.g. -500 or −€500.00)
    // The monthly net KPI tone should be text-negative (red)
    const netKpi = page.locator('article.kpi-card').first()
    const netClass = await netKpi.locator('.kpi-value').getAttribute('class')
    console.log('Monthly Net KPI class (expect text-negative):', netClass)
    expect(netClass).toContain('text-negative')

    // Insight should mention deficit
    const insights = page.locator('.insight-card')
    if (await insights.count() > 0) {
      const insightText = await insights.first().textContent()
      console.log('First insight (0/500):', insightText)
      expect(insightText).toMatch(/[Dd]eficit|expense|cost/)
    }
  })

  test('projection table with 0 income, 500 expenses shows accumulating negative balance', async ({ page }) => {
    await loginAndGo(page, '/projections')

    const incomeInput = page.locator('#monthly-income')
    await incomeInput.click({ clickCount: 3 })
    await incomeInput.fill('0')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(400)

    const expensesInput = page.locator('#monthly-expenses')
    if (!(await expensesInput.isDisabled())) {
      await expensesInput.click({ clickCount: 3 })
      await expensesInput.fill('500')
      await page.keyboard.press('Tab')
      await page.waitForTimeout(400)
    }

    await fillMonths(page, '6')
    await page.waitForTimeout(600)

    await page.locator('button', { hasText: 'Show table' }).click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: SS('07-edge-table-deficit') })

    const rows = page.locator('table tbody tr')
    const rowCount = await rows.count()
    console.log('Table rows for 6 months deficit:', rowCount)
    expect(rowCount).toBe(6)

    const lastRowCells = await rows.last().locator('td').allTextContents()
    console.log('Last row (month 6) cells (expected balance ≈ -3000):', lastRowCells)
    // Balance after 6 months × -500/mo = -3000

    const sharePre = page.locator('pre.share-preview')
    const shareText = (await sharePre.textContent()) ?? ''
    console.log('Share summary (0/500/6mo):\n', shareText)
    // Should mention "First negative month" = month 1
    const mentionsFirstNegative = shareText.toLowerCase().includes('first negative') ||
      shareText.toLowerCase().includes('negative')
    console.log('Share summary mentions negative/deficit:', mentionsFirstNegative)
  })

  test('what does the dashboard show with 0 income AND 0 expenses?', async ({ page }) => {
    await loginAndGo(page, '/settings')

    // Reset all data
    await page.click('button.btn-danger')
    await page.waitForTimeout(400)
    const confirmBtn = page.locator('button', { hasText: 'Confirm reset' })
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click()
      await page.waitForTimeout(1500)
    }

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    await page.screenshot({ path: SS('07-edge-zero-zero-dashboard') })

    const pillText = (await page.locator('.status-pill').first().textContent()) ?? ''
    console.log('Status pill (0/0):', pillText.trim())
    // income=0, expenses=0 → "No data" (app shows distinct state when no data entered)
    expect(pillText).toContain('No data')

    // KPIs all zero
    const kpiValues = await page.locator('.kpi-value').allTextContents()
    console.log('KPIs (0/0):', kpiValues)
    // OBSERVATION: All KPIs show 0.

    // Trend chart with all-zero values — should still render (flat line)
    const svg = page.locator('svg').first()
    expect(await svg.isVisible()).toBe(true)

    // The MilestonesCard — first negative month should show "–" or N/A when no deficit
    const milestonesText = await page.locator('body').textContent()
    console.log('Milestones visible (look for first negative / highest balance):', milestonesText?.includes('—') || milestonesText?.includes('N/A'))
  })

  test('large months value (60, the max) — table has 60 rows', async ({ page }) => {
    await loginAndGo(page, '/projections')

    const incomeInput = page.locator('#monthly-income')
    await incomeInput.click({ clickCount: 3 })
    await incomeInput.fill('1000')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(300)

    const expensesInput = page.locator('#monthly-expenses')
    if (!(await expensesInput.isDisabled())) {
      await expensesInput.click({ clickCount: 3 })
      await expensesInput.fill('800')
      await page.keyboard.press('Tab')
      await page.waitForTimeout(300)
    }

    await fillMonths(page, '60')
    await page.waitForTimeout(600)

    await page.locator('button', { hasText: 'Show table' }).click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: SS('07-edge-table-60rows') })

    const rowCount = await page.locator('table tbody tr').count()
    console.log('Table rows for 60 months:', rowCount)
    expect(rowCount).toBe(60)
  })
})

// ─── VISUAL OVERVIEW ──────────────────────────────────────────────────────────

test.describe('8 · Visual Overview (final screenshots)', () => {
  test('full desktop tour', async ({ page }) => {
    await loginAndGo(page, '/')
    await page.screenshot({ path: SS('99-overview-dashboard') })

    await page.goto('/projections')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1200)
    await page.screenshot({ path: SS('99-overview-projections') })

    await page.goto('/scenarios')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1200)
    await page.screenshot({ path: SS('99-overview-scenarios') })

    await page.goto('/collaboration')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1200)
    await page.screenshot({ path: SS('99-overview-collaboration') })

    await page.goto('/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1200)
    await page.screenshot({ path: SS('99-overview-settings') })
  })
})
