import { test } from '@playwright/test'
import { injectSupabaseSession } from './auth.setup'

test.beforeEach(async ({ page }) => {
  await injectSupabaseSession(page)
})

test('dashboard', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'e2e/screenshots/dashboard.png' })
})

test('projections', async ({ page }) => {
  await page.goto('/projections')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'e2e/screenshots/projections.png' })
  // Mobile
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'e2e/screenshots/projections-mobile.png' })
})

test('scenarios', async ({ page }) => {
  await page.goto('/scenarios')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'e2e/screenshots/scenarios.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'e2e/screenshots/scenarios-mobile.png' })
})

test('collaboration', async ({ page }) => {
  await page.goto('/collaboration')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'e2e/screenshots/collaboration.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'e2e/screenshots/collaboration-mobile.png' })
})

test('settings', async ({ page }) => {
  await page.goto('/settings')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'e2e/screenshots/settings.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'e2e/screenshots/settings-mobile.png' })
})
