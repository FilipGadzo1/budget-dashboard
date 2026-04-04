import { expect, test } from '@playwright/test'

import { injectSupabaseSession } from './auth.setup'

const MOBILE = { width: 390, height: 844 }

const ROUTES = [
  { href: '/', label: 'Dashboard' },
  { href: '/projections', label: 'Projections' },
  { href: '/savings', label: 'Savings' },
  { href: '/scenarios', label: 'Scenarios' },
  { href: '/collaboration', label: 'Collab' },
]

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(MOBILE)
  await injectSupabaseSession(page)
})

// ─── 1. Floating nav renders with all 5 tabs visible ──────────────────────────

test('floating nav renders with all 5 tabs visible', async ({ page }) => {
  await page.goto('/')
  await page.waitForURL('/', { timeout: 8000 })

  const nav = page.locator('.mobile-tabs')
  await expect(nav).toBeVisible({ timeout: 5000 })

  const tabs = nav.locator('.mobile-tab')
  await expect(tabs).toHaveCount(5, { timeout: 5000 })

  // Assert none are clipped — each tab has positive width and height
  for (let i = 0; i < 5; i++) {
    const box = await tabs.nth(i).boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(0)
    expect(box!.height).toBeGreaterThan(0)
  }
})

// ─── 2. Each tab navigates to the correct route and gets active style ─────────

test('each tab navigates to the correct route and gets active style', async ({ page }) => {
  await page.goto('/')
  await page.waitForURL('/', { timeout: 8000 })
  await expect(page.locator('.mobile-tabs')).toBeVisible({ timeout: 5000 })

  for (const route of ROUTES) {
    // Click the tab by its href attribute
    const tab = page.locator(`.mobile-tab[href="${route.href}"]`)
    await tab.click()
    await page.waitForURL(route.href === '/' ? /^\/$/ : new RegExp(route.href), { timeout: 5000 })

    // The clicked tab should have the active class
    await expect(tab).toHaveClass(/mobile-tab-active/, { timeout: 5000 })

    // No other tab should have the active class
    const allTabs = page.locator('.mobile-tab')
    const count = await allTabs.count()
    for (let i = 0; i < count; i++) {
      const other = allTabs.nth(i)
      const otherHref = await other.getAttribute('href')
      if (otherHref !== route.href) {
        await expect(other).not.toHaveClass(/mobile-tab-active/)
      }
    }
  }
})

// ─── 3. Sidebar opens via avatar button and closes on overlay click ───────────

test('sidebar opens via avatar button and closes on overlay click', async ({ page }) => {
  await page.goto('/')
  await page.waitForURL('/', { timeout: 8000 })

  const sidebar = page.locator('.sidebar')
  const overlay = page.locator('.sidebar-overlay')
  const avatarBtn = page.locator('.mobile-topbar-avatar')

  // Sidebar should NOT be open initially
  await expect(sidebar).not.toHaveClass(/sidebar-open/, { timeout: 5000 })

  // Open sidebar via avatar button
  await avatarBtn.click()
  await expect(sidebar).toHaveClass(/sidebar-open/, { timeout: 5000 })

  // Close sidebar by clicking the overlay
  await overlay.click()
  await expect(sidebar).not.toHaveClass(/sidebar-open/, { timeout: 5000 })
})

// ─── 4. Page content is not obscured by floating nav ─────────────────────────

test('page content is not obscured by floating nav', async ({ page }) => {
  await page.goto('/')
  await page.waitForURL('/', { timeout: 8000 })
  await expect(page.locator('.mobile-tabs')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.main-content')).toBeVisible({ timeout: 5000 })

  const navBox = await page.locator('.mobile-tabs').boundingBox()
  const contentBox = await page.locator('.main-content').boundingBox()

  expect(navBox).not.toBeNull()
  expect(contentBox).not.toBeNull()

  // Meaningful content exists above the nav — content area is taller than the nav
  expect(contentBox!.height).toBeGreaterThan(navBox!.height)

  // Scroll to the bottom of the page
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(300)

  // Floating nav should still be visible after scrolling (position: fixed)
  await expect(page.locator('.mobile-tabs')).toBeVisible()

  // Verify it still has positive dimensions (still rendered in place)
  const navBoxAfterScroll = await page.locator('.mobile-tabs').boundingBox()
  expect(navBoxAfterScroll).not.toBeNull()
  expect(navBoxAfterScroll!.width).toBeGreaterThan(0)
  expect(navBoxAfterScroll!.height).toBeGreaterThan(0)
})
