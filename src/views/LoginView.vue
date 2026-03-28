<script setup lang="ts">
import { useAuth } from '@/composables/useAuth'

const { signInWithGoogle } = useAuth()

const features = [
  { icon: 'pi pi-calculator', title: 'Budget Projections', desc: 'Model income and expenses over time.' },
  { icon: 'pi pi-bookmark', title: 'Save Scenarios', desc: 'Compare different budget plans side by side.' },
  { icon: 'pi pi-arrows-h', title: 'Live Exchange Rates', desc: 'Real-time European Central Bank data.' },
  { icon: 'pi pi-sync', title: 'Cloud Sync', desc: 'Access your data securely from any device.' },
]
</script>

<template>
  <div class="login-page">
    <!-- Left: Branding & features -->
    <div class="login-hero">
      <div class="login-hero-inner">
        <div class="login-logo-icon">B</div>
        <h1 class="login-heading">Budget Dashboard</h1>
        <p class="login-tagline">Smart projections, scenario planning, and real-time currency tracking.</p>

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

    <!-- Right: Sign-in -->
    <div class="login-card-wrapper">
      <div class="login-card">
        <h2 class="login-card-title">Get started</h2>
        <p class="login-card-subtitle">Sign in with your Google account to start planning.</p>

        <button class="login-google-btn" @click="signInWithGoogle">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <p class="login-disclaimer">Your data is stored securely. We only access your name and email.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4rem;
  padding: 2rem;
  background: var(--app-bg);
}

/* ── Left: Hero ──────────────────────────────── */

.login-hero {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 2rem;
  background: var(--sidebar-bg);
  color: #fafafa;
  border-radius: 16px;
}

.login-hero-inner {
  max-width: 26rem;
}

.login-logo-icon {
  width: 44px;
  height: 44px;
  border-radius: 11px;
  background: linear-gradient(135deg, #059669, #34d399);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.125rem;
  color: white;
  margin-bottom: 1.25rem;
}

.login-heading {
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.15;
  margin-bottom: 0.5rem;
}

.login-tagline {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: #a1a1aa;
  margin-bottom: 2rem;
}

.login-features {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.login-feature {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.login-feature-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.8125rem;
  color: #34d399;
}

.login-feature-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fafafa;
}

.login-feature-desc {
  font-size: 0.75rem;
  color: #71717a;
  line-height: 1.4;
}

/* ── Right: Card ─────────────────────────────── */

.login-card-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.login-card {
  width: 100%;
  max-width: 20rem;
  text-align: center;
}

.login-card-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--app-text);
  margin-bottom: 0.375rem;
}

.login-card-subtitle {
  font-size: 0.8125rem;
  color: var(--app-text-secondary);
  line-height: 1.5;
  margin-bottom: 1.5rem;
}

.login-google-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 0.6875rem 1.25rem;
  font-size: 0.875rem;
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
  margin-top: 1rem;
  font-size: 0.6875rem;
  color: var(--app-text-secondary);
  line-height: 1.5;
}

/* ── Mobile ──────────────────────────────────── */

@media (max-width: 767px) {
  .login-page {
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.25rem;
    justify-content: flex-start;
    padding-top: 2rem;
  }

  .login-hero {
    padding: 1.5rem 1.25rem;
  }

  .login-logo-icon {
    width: 36px;
    height: 36px;
    font-size: 1rem;
    border-radius: 9px;
    margin-bottom: 1rem;
  }

  .login-heading {
    font-size: 1.375rem;
    margin-bottom: 0.375rem;
  }

  .login-tagline {
    font-size: 0.8125rem;
    margin-bottom: 1.25rem;
  }

  .login-features {
    gap: 0.625rem;
  }

  .login-feature-icon {
    width: 30px;
    height: 30px;
    font-size: 0.75rem;
  }

  .login-feature-desc {
    display: none;
  }

  .login-card-wrapper {
    width: auto;
  }
}
</style>
