import type { Page } from '@playwright/test'

const SUPABASE_URL = 'https://ldgxjpehzgesgehhvwow.supabase.co'
const ANON_KEY = 'sb_publishable_m_qUk6RkmT0ekqpVl9mZjA_-pS9VHUQ'
const PROJECT_REF = 'ldgxjpehzgesgehhvwow'
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`

// Hardcoded refresh token — rotates each use, updated automatically below
const REFRESH_TOKEN = 'q4snpm7ldxi5'

async function getFreshSession(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: REFRESH_TOKEN }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`)
  return res.json().then((d) => JSON.stringify(d))
}

export async function injectSupabaseSession(page: Page): Promise<boolean> {
  let session: string
  try {
    session = await getFreshSession()
  } catch (e) {
    console.error('[auth] Could not refresh token:', e)
    return false
  }
  // Go to a neutral page so localStorage is on the right origin
  await page.goto('/')
  await page.evaluate(
    ([key, value]) => { localStorage.setItem(key, value) },
    [STORAGE_KEY, session],
  )
  return true
}
