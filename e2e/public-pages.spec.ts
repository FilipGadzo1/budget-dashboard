import { test, expect } from '@playwright/test'

test.describe('Public pages', () => {
  test('login page loads and shows Google sign-in button', async ({ page }) => {
    await page.goto('/')
    // Should redirect to /login if not authenticated
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 })
    await expect(page.locator('text=Continue with Google')).toBeVisible()
  })

  test('invalid invite token shows error state', async ({ page }) => {
    await page.goto('/invite/00000000-0000-0000-0000-000000000000')
    // Should show an error or loading state (not crash)
    await page.waitForTimeout(3000)
    const body = await page.locator('body').textContent()
    expect(body).not.toContain('Cannot read')   // no JS errors leaked to DOM
    expect(body).not.toContain('undefined')
    // Should show either an error message or the invite card
    const hasError = await page.locator('text=invalid').count() > 0
    const hasExpired = await page.locator('text=expired').count() > 0
    const hasCard = await page.locator('.invite-card').count() > 0
    expect(hasError || hasExpired || hasCard).toBe(true)
  })

  test('unauthenticated routes redirect to login', async ({ page }) => {
    for (const route of ['/settings', '/collaboration', '/scenarios']) {
      await page.goto(route)
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 })
    }
  })
})
