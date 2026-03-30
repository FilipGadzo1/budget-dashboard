import { test } from '@playwright/test'
import { injectSupabaseSession } from './auth.setup'

test('screenshot expenses modal with items', async ({ page }) => {
  await injectSupabaseSession(page)
  await page.goto('/projections')
  await page.waitForURL(/\/projections/, { timeout: 8000 })
  await page.waitForTimeout(1500)

  await page.click('button:has-text("Add expense items")')
  await page.waitForTimeout(600)

  for (const name of ['Rent', 'Food', 'Transport', 'Utilities', 'Subscriptions']) {
    await page.click('button:has-text("Add item")')
    await page.waitForTimeout(150)
    const lastNameInput = page.locator('input[placeholder="Expense name"]').last()
    await lastNameInput.fill(name)
  }

  await page.waitForTimeout(300)
  await page.screenshot({ path: 'e2e/screenshots/modal-with-items.png' })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(200)
  await page.screenshot({ path: 'e2e/screenshots/modal-mobile.png' })
})
