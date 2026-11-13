<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import ExchangeRatesPanel from '@/components/shared/ExchangeRatesPanel.vue'
import { useExchangeRates } from '@/composables/useExchangeRates'
import { currencyOptions, localeOptions } from '@/data/defaults'
import { rebaseInputs } from '@/services/currencyService'
import { useCollaborationStore } from '@/stores/collaboration'
import { useProjectionStore } from '@/stores/projection'
import { useUiStore } from '@/stores/ui'

const uiStore = useUiStore()
const projectionStore = useProjectionStore()
const collabStore = useCollaborationStore()
const { fetchRates, canConvert, convert, getRatesFor, loading: ratesLoading, error: ratesError, rateDate } = useExchangeRates()

// ── Exchange rates, shown against the saved display currency ─────────────────
const supportedCurrencyCodes = currencyOptions.map((o) => o.value)
const currentRates = computed(() => getRatesFor(uiStore.currencyCode, supportedCurrencyCodes))
const currencyLabel = (code: string): string =>
  currencyOptions.find((o) => o.value === code)?.label.split(' (')[0] ?? code

onMounted(() => { void fetchRates() })

// ── Local draft state ─────────────────────────────────────────────────────────
const draftCurrency = ref(uiStore.currencyCode)
const draftLocale = ref(uiStore.locale)

// Keep draft in sync if another part of the app changes the store
watch(() => uiStore.currencyCode, (v) => { draftCurrency.value = v })
watch(() => uiStore.locale, (v) => { draftLocale.value = v })

const isDirty = computed(
  () =>
    draftCurrency.value !== uiStore.currencyCode
    || draftLocale.value !== uiStore.locale,
)

const saveStatus = ref<'idle' | 'saved'>('idle')
let saveStatusTimer: ReturnType<typeof setTimeout> | undefined

const saveError = ref('')

const saveSettings = async (): Promise<void> => {
  saveError.value = ''
  const from = uiStore.currencyCode
  const to = draftCurrency.value

  if (from !== to) {
    // Switching display currency converts everything on screen, so rates are required.
    await fetchRates()
    if (!canConvert(from, to)) {
      saveError.value = 'Exchange rates are unavailable right now, so the currency was not changed. Try again shortly.'
      return
    }
    // Own budget only: when a shared budget is open the projection store holds
    // the owner's data, which this user's display preference must not rewrite.
    if (!collabStore.isViewingSharedBudget) {
      projectionStore.setInputs(rebaseInputs(projectionStore.inputs, from, to, convert))
    }
  }

  uiStore.setPreferences({ currencyCode: draftCurrency.value, locale: draftLocale.value })
  collabStore.broadcastProfileUpdate(draftCurrency.value, draftLocale.value, uiStore.selectedMonth)
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
}
</script>

<template>
  <div class="page settings-page">
    <header class="page-head">
      <div>
        <h1 class="page-title">Settings</h1>
        <p class="page-description">How amounts are shown, and your data.</p>
      </div>
    </header>

    <div class="settings-grid scroll-y">
    <!-- Display preferences -->
    <div class="card">
      <p class="text-heading mb-4">Display preferences</p>
      <div class="settings-selects-grid grid grid-cols-2 gap-3">
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
      </div>
      <p class="mt-2 text-xs text-secondary">
        Everything is shown converted to this currency at today's exchange rates. Each income
        source, expense and savings goal keeps the currency you entered it in, so you can mix
        currencies and switch back without losing precision.
      </p>
      <p v-if="saveError" class="form-error">{{ saveError }}</p>

      <div class="mt-5">
        <label class="form-label">Theme</label>
        <div class="settings-theme-row mt-1 flex gap-2">
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
          <button
            class="btn btn-sm"
            :class="uiStore.themeMode === 'system' ? 'btn-primary' : 'btn-secondary'"
            @click="uiStore.setThemeMode('system')"
          >
            <i class="pi pi-desktop text-xs" /> System
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

    <div class="settings-side">
    <div class="card">
      <p class="text-heading mb-1">Exchange rates</p>
      <p class="text-body mb-4">Today's rates against your display currency.</p>
      <ExchangeRatesPanel
        :currency-code="uiStore.currencyCode"
        :rates="currentRates"
        :rate-date="rateDate"
        :loading="ratesLoading"
        :error="ratesError"
        :currency-label="currencyLabel"
        layout="list"
      />
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
        <div class="settings-actions mt-3 flex gap-2">
          <button class="btn btn-danger btn-sm" :disabled="resetLoading" @click="resetAll">
            <i v-if="resetLoading" class="pi pi-spin pi-spinner text-xs" />
            Confirm reset
          </button>
          <button class="btn btn-secondary btn-sm" @click="showResetConfirm = false">Cancel</button>
        </div>
      </div>
    </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
/* Preferences beside rates and data, so the page uses its width */
.settings-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.settings-side {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

@media (max-width: 1099px) {
  .settings-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 1023px) {
  .settings-selects-grid {
    grid-template-columns: 1fr;
  }

  .form-select,
  :deep(.p-select) {
    width: 100% !important;
  }

  .settings-theme-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.5rem;
  }

  .text-heading {
    font-family: var(--font-sans);
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .settings-actions {
    flex-direction: column;
    gap: 0.5rem;
  }

  .settings-actions .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
