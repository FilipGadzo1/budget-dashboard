import type { Page } from '@playwright/test'

// Signs in as a dedicated E2E test user with email + password and plants the
// session in localStorage, where the Supabase client picks it up.
//
// Credentials come from the environment — never from this file:
//   E2E_SUPABASE_URL   e.g. https://<project-ref>.supabase.co
//   E2E_SUPABASE_KEY   the project's publishable (anon) key
//   E2E_EMAIL          the test user's email
//   E2E_PASSWORD       the test user's password
//
// The test user must exist with the Email provider enabled in Supabase Auth.
// When any variable is missing, injectSupabaseSession returns false and the
// authenticated specs skip.

const SUPABASE_URL = process.env.E2E_SUPABASE_URL
const SUPABASE_KEY = process.env.E2E_SUPABASE_KEY
const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

async function signIn(): Promise<{ storageKey: string; session: string } | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY || !EMAIL || !PASSWORD) return null

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`E2E sign-in failed: ${res.status} ${await res.text()}`)

  // supabase-js stores the session under sb-<project-ref>-auth-token
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
  return {
    storageKey: `sb-${projectRef}-auth-token`,
    session: JSON.stringify(await res.json()),
  }
}

export async function injectSupabaseSession(page: Page): Promise<boolean> {
  let auth: Awaited<ReturnType<typeof signIn>>
  try {
    auth = await signIn()
  } catch (e) {
    console.error('[auth] Could not sign in the E2E user:', e)
    return false
  }
  if (!auth) return false

  // Go to a neutral page so localStorage is on the right origin
  await page.goto('/')
  await page.evaluate(
    ([key, value]) => { localStorage.setItem(key, value) },
    [auth.storageKey, auth.session],
  )
  return true
}
