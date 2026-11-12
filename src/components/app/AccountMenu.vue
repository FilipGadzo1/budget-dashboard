<script setup lang="ts">
import { useRouter } from 'vue-router'

import { useAuth } from '@/composables/useAuth'
import type { ThemeMode } from '@/models'
import { useUiStore } from '@/stores/ui'

// The contents of the account menu: who is signed in, the theme switch, Settings
// and Sign out. Used by the sidebar (opens upward from the footer) and by the
// mobile top bar (opens downward from the avatar), so both stay identical.

const emit = defineEmits<{
  /** Fired after an action that should close the menu. */
  close: []
}>()

const router = useRouter()
const uiStore = useUiStore()
const { user, signOut } = useAuth()

const themes: Array<{ value: ThemeMode; label: string; icon: string }> = [
  { value: 'light', label: 'Light', icon: 'pi pi-sun' },
  { value: 'dark', label: 'Dark', icon: 'pi pi-moon' },
  { value: 'system', label: 'System', icon: 'pi pi-desktop' },
]

const goToSettings = (): void => {
  emit('close')
  void router.push('/settings')
}

const handleSignOut = async (): Promise<void> => {
  emit('close')
  await signOut()
}
</script>

<template>
  <div class="account-menu" role="menu" aria-label="Account">
    <div v-if="user" class="account-menu-user">
      <p class="account-menu-name">{{ user.user_metadata?.full_name || user.email }}</p>
      <p class="account-menu-email">{{ user.email }}</p>
    </div>

    <div class="account-menu-theme">
      <p id="account-theme-label" class="account-menu-label">Theme</p>
      <div class="account-theme-seg" role="radiogroup" aria-labelledby="account-theme-label">
        <button
          v-for="theme in themes"
          :key="theme.value"
          class="account-theme-btn"
          :class="{ 'account-theme-btn-on': uiStore.themeMode === theme.value }"
          role="radio"
          :aria-checked="uiStore.themeMode === theme.value"
          @click="uiStore.setThemeMode(theme.value)"
        >
          <i :class="theme.icon" aria-hidden="true" />
          {{ theme.label }}
        </button>
      </div>
    </div>

    <button class="account-menu-item" role="menuitem" @click="goToSettings">
      <i class="pi pi-cog" aria-hidden="true" />
      Settings
    </button>

    <div class="account-menu-divider" />

    <button class="account-menu-item account-menu-item-danger" role="menuitem" @click="handleSignOut">
      <i class="pi pi-sign-out" aria-hidden="true" />
      Sign out
    </button>
  </div>
</template>

<style scoped>
.account-menu {
  display: flex;
  flex-direction: column;
}

.account-menu-user {
  padding: 0.5rem 0.625rem 0.625rem;
  border-bottom: 1px solid var(--app-border);
  margin-bottom: 0.5rem;
}

.account-menu-name {
  margin: 0 0 0.125rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--app-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-menu-email {
  margin: 0;
  font-size: 0.7rem;
  color: var(--app-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-menu-theme {
  padding: 0 0.625rem 0.5rem;
}

.account-menu-label {
  margin: 0 0 0.375rem;
  font-size: 0.65625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--app-text-secondary);
}

/* Segmented control: one option always selected */
.account-theme-seg {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  padding: 2px;
  border-radius: 0.5rem;
  background: var(--app-surface-hover);
}

.account-theme-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3125rem;
  padding: 0.3125rem 0;
  border: none;
  border-radius: 0.375rem;
  background: none;
  font: inherit;
  font-size: 0.71875rem;
  color: var(--app-text-secondary);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.account-theme-btn .pi {
  font-size: 0.6875rem;
}

.account-theme-btn:hover {
  color: var(--app-text);
}

.account-theme-btn-on {
  background: var(--app-surface);
  color: var(--app-text);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.14);
}

.account-menu-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: none;
  border-radius: 0.5rem;
  background: none;
  font: inherit;
  font-size: 0.8125rem;
  color: var(--app-text);
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease;
}

.account-menu-item .pi {
  width: 1rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--app-text-secondary);
}

.account-menu-item:hover {
  background: var(--app-surface-hover);
}

.account-menu-item-danger,
.account-menu-item-danger .pi {
  color: var(--app-negative);
}

.account-menu-item-danger:hover {
  background: var(--app-negative-soft);
}

.account-menu-divider {
  height: 1px;
  margin: 0.375rem 0;
  background: var(--app-border);
}
</style>
