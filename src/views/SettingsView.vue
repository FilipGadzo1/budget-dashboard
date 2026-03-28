<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import ExchangeRatesPanel from '@/components/shared/ExchangeRatesPanel.vue'
import { useCurrency } from '@/composables/useCurrency'
import { useExchangeRates } from '@/composables/useExchangeRates'
import { useProjectionStore } from '@/stores/projection'
import { useUiStore } from '@/stores/ui'

const currencyOptions = [
  { value: 'SEK', label: 'Swedish Krona (SEK)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
]

const localeOptions = [
  { value: 'sv-SE', label: 'Swedish (Sweden)' },
  { value: 'en-IE', label: 'English (Ireland)' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'hr-HR', label: 'Croatian (Croatia)' },
]

const uiStore = useUiStore()
const projectionStore = useProjectionStore()
const { currencyCode } = useCurrency()
const { getRatesFor, fetchRates, loading: ratesLoading, error: ratesError, rateDate } = useExchangeRates()

const supportedCurrencyCodes = currencyOptions.map((o) => o.value)
const currentRates = computed(() => getRatesFor(currencyCode.value, supportedCurrencyCodes))
const currencyLabel = (code: string): string =>
  currencyOptions.find((o) => o.value === code)?.label.split(' (')[0] ?? code

const showResetConfirm = ref(false)

const selectedCurrencyCode = computed({
  get: () => uiStore.currencyCode,
  set: (val: string) => uiStore.setPreferences({ currencyCode: val, locale: uiStore.locale }),
})

const selectedLocale = computed({
  get: () => uiStore.locale,
  set: (val: string) => uiStore.setPreferences({ currencyCode: uiStore.currencyCode, locale: val }),
})

const selectedMonth = computed({
  get: () => uiStore.selectedMonth,
  set: (val: string) => uiStore.setSelectedMonth(val),
})

const resetAll = (): void => {
  uiStore.clearAllData()
  projectionStore.reset()
  showResetConfirm.value = false
}

onMounted(() => { void fetchRates() })
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
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label class="form-label" for="s-currency">Currency</label>
          <select id="s-currency" v-model="selectedCurrencyCode" class="form-select">
            <option v-for="opt in currencyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div>
          <label class="form-label" for="s-locale">Locale</label>
          <select id="s-locale" v-model="selectedLocale" class="form-select">
            <option v-for="opt in localeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div>
          <label class="form-label" for="s-month">Start month</label>
          <input id="s-month" v-model="selectedMonth" class="form-select" type="month" />
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
    </div>

    <!-- Exchange rates -->
    <div class="card mb-6">
      <p class="text-heading mb-1">Exchange rates</p>
      <p class="text-body mb-4">Live reference rates from the European Central Bank.</p>
      <ExchangeRatesPanel
        :currency-code="currencyCode"
        :rates="currentRates"
        :rate-date="rateDate"
        :loading="ratesLoading"
        :error="ratesError"
        :currency-label="currencyLabel"
        layout="grid"
      />
    </div>

    <!-- Data management -->
    <div class="card">
      <p class="text-heading mb-1">Data management</p>
      <p class="text-body mb-4">All data is stored in the cloud linked to your account.</p>

      <div class="flex items-center justify-between rounded-lg border border-app px-4 py-3">
        <div>
          <p class="text-sm font-medium text-primary">Reset all data</p>
          <p class="mt-0.5 text-xs text-secondary">Revert inputs and clear all saved scenarios.</p>
        </div>
        <button class="btn btn-danger btn-sm" @click="showResetConfirm = true">Reset</button>
      </div>

      <div
        v-if="showResetConfirm"
        class="mt-3 rounded-lg border p-4"
        style="border-color: var(--app-negative-border); background: var(--app-negative-soft);"
      >
        <p class="text-sm font-medium text-negative">Are you sure? This will erase all saved scenarios and reset inputs to defaults.</p>
        <div class="mt-3 flex gap-2">
          <button class="btn btn-danger btn-sm" @click="resetAll">Confirm reset</button>
          <button class="btn btn-secondary btn-sm" @click="showResetConfirm = false">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>
