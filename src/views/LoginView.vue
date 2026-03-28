<script setup lang="ts">
import { useAuth } from '@/composables/useAuth'

const { signInWithGoogle } = useAuth()
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-logo">B</div>
      <h1 class="login-title">Budget Dashboard</h1>
      <p class="login-subtitle">Sign in to sync your financial plans across devices.</p>
      <button class="btn btn-primary login-btn" @click="signInWithGoogle">
        <svg class="login-google-icon" viewBox="0 0 24 24" width="20" height="20">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </button>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-bg);
  padding: 1rem;
}

.login-card {
  width: 100%;
  max-width: 24rem;
  text-align: center;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 16px;
  padding: 3rem 2rem;
}

.login-logo {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: var(--app-accent);
  color: #fff;
  font-size: 1.5rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
}

.login-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--app-text);
  margin-bottom: 0.5rem;
}

.login-subtitle {
  font-size: 0.875rem;
  color: var(--app-text-secondary);
  line-height: 1.6;
  margin-bottom: 2rem;
}

.login-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  font-size: 0.9375rem;
  padding: 0.75rem 1.5rem;
}

.login-google-icon {
  flex-shrink: 0;
}
</style>
