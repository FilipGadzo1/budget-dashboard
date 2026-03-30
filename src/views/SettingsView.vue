<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useCollaborationStore } from '@/stores/collaboration'
import { useProjectionStore } from '@/stores/projection'
import { useUiStore } from '@/stores/ui'

const currencyOptions = [
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'SEK', label: 'Swedish Krona (SEK)' },
]

const localeOptions = [
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-IE', label: 'English (Ireland)' },
  { value: 'sv-SE', label: 'Swedish (Sweden)' },
  { value: 'hr-HR', label: 'Croatian (Croatia)' },
]

const uiStore = useUiStore()
const projectionStore = useProjectionStore()
const collabStore = useCollaborationStore()

// ── Local draft state ─────────────────────────────────────────────────────────
const draftCurrency = ref(uiStore.currencyCode)
const draftLocale = ref(uiStore.locale)
const draftMonth = ref(uiStore.selectedMonth)

// Keep draft in sync if another part of the app changes the store
watch(() => uiStore.currencyCode, (v) => { draftCurrency.value = v })
watch(() => uiStore.locale, (v) => { draftLocale.value = v })
watch(() => uiStore.selectedMonth, (v) => { draftMonth.value = v })

const isDirty = computed(
  () =>
    draftCurrency.value !== uiStore.currencyCode
    || draftLocale.value !== uiStore.locale
    || draftMonth.value !== uiStore.selectedMonth,
)

const saveStatus = ref<'idle' | 'saved'>('idle')
let saveStatusTimer: ReturnType<typeof setTimeout> | undefined

const saveSettings = (): void => {
  uiStore.setPreferences({ currencyCode: draftCurrency.value, locale: draftLocale.value })
  uiStore.setSelectedMonth(draftMonth.value)
  collabStore.broadcastProfileUpdate(draftCurrency.value, draftLocale.value, draftMonth.value)
  clearTimeout(saveStatusTimer)
  saveStatus.value = 'saved'
  saveStatusTimer = setTimeout(() => { saveStatus.value = 'idle' }, 2500)
}

// ── Reset ─────────────────────────────────────────────────────────────────────
const showResetConfirm = ref(false)
const resetLoading = ref(false)

const resetAll = async (): Promise<void> => {
  resetLoading.value = true
  try {
    await Promise.all([uiStore.clearAllData(), projectionStore.reset()])
  } finally {
    resetLoading.value = false
    showResetConfirm.value = false
  }
  // Sync drafts to the new defaults
  draftCurrency.value = uiStore.currencyCode
  draftLocale.value = uiStore.locale
  draftMonth.value = uiStore.selectedMonth
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Settings</h1>
      <p class="page-description">Manage your display preferences and app configuration.</p>
    </div>

    <!-- Display preferences -->
    <div class="card mb-6">
      <p class="text-heading mb-4">Display preferences</p>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div>
          <label class="form-label" for="s-currency">Currency</label>
          <select id="s-currency" v-model="draftCurrency" class="form-select">
            <option v-for="opt in currencyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div>
          <label class="form-label" for="s-locale">Locale</label>
          <select id="s-locale" v-model="draftLocale" class="form-select">
            <option v-for="opt in localeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div>
          <label class="form-label" for="s-month">Start month</label>
          <input id="s-month" v-model="draftMonth" class="form-select" type="month" />
        </div>
      </div>

      <div class="mt-5">
        <label class="form-label">Theme</label>
        <div class="mt-1 flex gap-2">
          <button
            class="btn btn-sm"
            :class="uiStore.themeMode === 'light' ? 'btn-primary' : 'btn-secondary'"
            @click="uiStore.setThemeMode('light')"
          >
            <i class="pi pi-sun text-xs" /> Light
          </button>
          <button
            class="btn btn-sm"
            :class="uiStore.themeMode === 'dark' ? 'btn-primary' : 'btn-secondary'"
            @click="uiStore.setThemeMode('dark')"
          >
            <i class="pi pi-moon text-xs" /> Dark
          </button>
        </div>
      </div>

      <div class="mt-5 flex items-center gap-3">
        <button
          class="btn btn-primary btn-sm"
          :disabled="!isDirty"
          @click="saveSettings"
        >
          <i class="pi pi-check text-xs" /> Save settings
        </button>
        <span v-if="saveStatus === 'saved'" class="text-xs" style="color: var(--app-positive)">
          <i class="pi pi-check-circle" /> Saved
        </span>
      </div>
    </div>

    <!-- Data management -->
    <div class="card">
      <p class="text-heading mb-1">Data management</p>
      <p class="text-body mb-4">All data is stored in the cloud linked to your account.</p>

      <div class="flex items-center justify-between rounded-lg border border-app px-4 py-3">
        <div>
          <p class="text-sm font-medium text-primary">Reset all data</p>
          <p class="mt-0.5 text-xs text-secondary">Revert inputs to zero and clear all saved scenarios.</p>
        </div>
        <button class="btn btn-danger btn-sm" @click="showResetConfirm = true">Reset</button>
      </div>

      <div
        v-if="showResetConfirm"
        class="mt-3 rounded-lg border p-4"
        style="border-color: var(--app-negative-border); background: var(--app-negative-soft);"
      >
        <p class="text-sm font-medium text-negative">Are you sure? This will erase all saved scenarios and reset inputs to zero.</p>
        <div class="mt-3 flex gap-2">
          <button class="btn btn-danger btn-sm" :disabled="resetLoading" @click="resetAll">
            <i v-if="resetLoading" class="pi pi-spin pi-spinner text-xs" />
            Confirm reset
          </button>
          <button class="btn btn-secondary btn-sm" @click="showResetConfirm = false">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>
