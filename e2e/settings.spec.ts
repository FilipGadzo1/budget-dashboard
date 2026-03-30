import { test, expect } from '@playwright/test'
import { injectSupabaseSession } from './auth.setup'

test.describe('Settings page (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    const injected = await injectSupabaseSession(page)
    test.skip(!injected, 'E2E_SUPABASE_TOKEN not set — skipping authenticated tests')
    await page.goto('/settings')
    await page.waitForURL(/\/settings/, { timeout: 8000 })
    // Wait for settings content to appear (not just URL)
    await expect(page.locator('button:has-text("Save settings")')).toBeVisible({ timeout: 8000 })
  })

  test('shows Save settings button', async ({ page }) => {
    await expect(page.locator('button:has-text("Save settings")')).toBeVisible()
  })

  test('Save button is disabled when nothing changed', async ({ page }) => {
    await expect(page.locator('button:has-text("Save settings")')).toBeDisabled()
  })

  test('Save button enables after changing currency', async ({ page }) => {
    await page.selectOption('#s-currency', 'USD')
    await expect(page.locator('button:has-text("Save settings")')).toBeEnabled()
  })

  test('Save button shows Saved confirmation after click', async ({ page }) => {
    await page.selectOption('#s-currency', 'GBP')
    await page.click('button:has-text("Save settings")')
    // The Saved span appears for 2.5 s after save (v-if on saveStatus === 'saved')
    await expect(page.locator('span:has(.pi-check-circle)')).toBeVisible({ timeout: 5000 })
  })

  test('no exchange rates panel on settings page', async ({ page }) => {
    await expect(page.locator('text=Exchange rates')).not.toBeVisible()
  })

  test('Reset resets income and expenses to 0', async ({ page }) => {
    await page.click('button.btn-danger:has-text("Reset")')
    await expect(page.locator('text=Confirm reset')).toBeVisible()
    await page.click('button.btn-danger:has-text("Confirm reset")')

    // Wait for reset to complete (spinner disappears)
    await expect(page.locator('button.btn-danger:has-text("Confirm reset")')).not.toBeVisible({ timeout: 10000 })

    // Navigate to projections (NOT dashboard — income/expense inputs live there)
    await page.goto('/projections')
    await page.waitForURL(/\/projections/, { timeout: 8000 })

    // PrimeVue InputNumber renders the actual <input> with the given inputId
    const incomeInput = page.locator('#monthly-income')
    await expect(incomeInput).toBeVisible({ timeout: 8000 })
    await expect(incomeInput).toHaveValue('0')

    const expensesInput = page.locator('#monthly-expenses')
    await expect(expensesInput).toHaveValue('0')
  })

  test('Reset sets currency to EUR and locale to en-US', async ({ page }) => {
    // First force to something else so we can verify the reset
    await page.selectOption('#s-currency', 'SEK')
    await page.selectOption('#s-locale', 'sv-SE')
    await page.click('button:has-text("Save settings")')
    await page.waitForTimeout(500)

    await page.click('button.btn-danger:has-text("Reset")')
    await page.click('button.btn-danger:has-text("Confirm reset")')
    await expect(page.locator('button.btn-danger:has-text("Confirm reset")')).not.toBeVisible({ timeout: 10000 })

    // Navigate away and back to reload from store
    await page.goto('/projections')
    await page.goto('/settings')
    await page.waitForURL(/\/settings/, { timeout: 8000 })
    await expect(page.locator('button:has-text("Save settings")')).toBeVisible({ timeout: 8000 })

    await expect(page.locator('#s-currency')).toHaveValue('EUR')
    await expect(page.locator('#s-locale')).toHaveValue('en-US')
  })
})
