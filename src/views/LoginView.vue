<script setup lang="ts">
import { useAuth } from '@/composables/useAuth'

const { signInWithGoogle } = useAuth()

const features = [
  { icon: 'pi pi-calculator', title: 'Budget Projections', desc: 'Model income and expenses over time to see where your finances are heading.' },
  { icon: 'pi pi-bookmark', title: 'Save Scenarios', desc: 'Compare different budget plans side by side and pick the one that works.' },
  { icon: 'pi pi-arrows-h', title: 'Live Exchange Rates', desc: 'Convert between currencies using real-time European Central Bank data.' },
  { icon: 'pi pi-sync', title: 'Sync Across Devices', desc: 'Your data is stored securely in the cloud so you can access it anywhere.' },
]
</script>

<template>
  <div class="login-page">
    <!-- Hero section -->
    <div class="login-hero">
      <div class="login-hero-inner">
        <div class="login-logo">
          <div class="login-logo-icon">B</div>
        </div>
        <h1 class="login-heading">Budget Dashboard</h1>
        <p class="login-tagline">Take control of your finances with smart projections, scenario planning, and real-time currency tracking.</p>

        <!-- Feature grid -->
        <div class="login-features">
          <div v-for="f in features" :key="f.title" class="login-feature">
            <div class="login-feature-icon">
              <i :class="f.icon" />
            </div>
            <div>
              <p class="login-feature-title">{{ f.title }}</p>
              <p class="login-feature-desc">{{ f.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sign-in card -->
    <div class="login-card-wrapper">
      <div class="login-card">
        <h2 class="login-card-title">Get started</h2>
        <p class="login-card-subtitle">Sign in with your Google account to start planning your budget.</p>

        <button class="login-google-btn" @click="signInWithGoogle">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <p class="login-disclaimer">Your data is stored securely with Supabase. We only access your name and email.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
}

@media (min-width: 768px) {
  .login-page {
    flex-direction: row;
  }
}

/* ── Left: Hero ──────────────────────────────── */

.login-hero {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  background: var(--sidebar-bg);
  color: #fafafa;
}

@media (min-width: 768px) {
  .login-hero {
    padding: 4rem 3rem;
  }
}

.login-hero-inner {
  max-width: 28rem;
}

.login-logo {
  margin-bottom: 1.5rem;
}

.login-logo-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #059669, #34d399);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
  color: white;
}

.login-heading {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.15;
  margin-bottom: 0.75rem;
}

.login-tagline {
  font-size: 1rem;
  line-height: 1.7;
  color: #a1a1aa;
  margin-bottom: 2.5rem;
}

.login-features {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.login-feature {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
}

.login-feature-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.875rem;
  color: #34d399;
}

.login-feature-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #fafafa;
  margin-bottom: 2px;
}

.login-feature-desc {
  font-size: 0.8125rem;
  color: #a1a1aa;
  line-height: 1.5;
}

/* ── Right: Card ─────────────────────────────── */

.login-card-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
}

@media (min-width: 768px) {
  .login-card-wrapper {
    width: 420px;
    flex-shrink: 0;
    padding: 4rem 2.5rem;
  }
}

.login-card {
  width: 100%;
  max-width: 22rem;
  text-align: center;
}

.login-card-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--app-text);
  margin-bottom: 0.5rem;
}

.login-card-subtitle {
  font-size: 0.875rem;
  color: var(--app-text-secondary);
  line-height: 1.6;
  margin-bottom: 2rem;
}

.login-google-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 0.75rem 1.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--app-text);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.login-google-btn:hover {
  background: var(--app-border);
}

.login-disclaimer {
  margin-top: 1.25rem;
  font-size: 0.75rem;
  color: var(--app-text-secondary);
  line-height: 1.5;
}
</style>
