import { ref } from 'vue'
import type { User } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'

const user = ref<User | null>(null)
const loading = ref(true)

let initPromise: Promise<void> | null = null

function initialize(): Promise<void> {
  if (initPromise) return initPromise

  initPromise = new Promise<void>((resolve) => {
    supabase.auth.getSession().then(({ data }) => {
      user.value = data.session?.user ?? null
      loading.value = false
      resolve()
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null
      loading.value = false
    })
  })

  return initPromise
}

async function signInWithGoogle(): Promise<void> {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/` },
  })
}

async function signOut(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' })
  user.value = null
}

export function useAuth() {
  return {
    user,
    loading,
    initialize,
    signInWithGoogle,
    signOut,
  }
}
