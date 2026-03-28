import { ref } from 'vue'
import type { User } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'

const user = ref<User | null>(null)
const loading = ref(true)

let initialized = false

async function initialize(): Promise<void> {
  if (initialized) return
  initialized = true

  const { data } = await supabase.auth.getSession()
  user.value = data.session?.user ?? null
  loading.value = false

  supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null
    loading.value = false
  })
}

async function signInWithGoogle(): Promise<void> {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/` },
  })
}

async function signOut(): Promise<void> {
  await supabase.auth.signOut()
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
