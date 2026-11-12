import { computed, readonly, ref } from 'vue'

// Rates keyed by lowercase currency code, relative to EUR (e.g. rates['sek'] = 11.38 means 1 EUR = 11.38 SEK)
const rates = ref<Record<string, number>>({})
const rateDate = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const fetchedAt = ref<number | null>(null)

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour — rates update daily, no need to refetch every visit
const STORAGE_KEY = 'budget-dashboard:exchange-rates'

// Amounts in other currencies cannot be shown without rates, so the last good set
// is kept in localStorage and used until a fresh fetch succeeds (or if it fails).
const restoreCachedRates = (): void => {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return
    const cached = JSON.parse(raw) as { date: string; rates: Record<string, number> }
    if (cached?.rates && typeof cached.rates === 'object') {
      rates.value = cached.rates
      rateDate.value = cached.date ?? null
    }
  } catch {
    // unreadable cache — ignore, a fetch will replace it
  }
}

restoreCachedRates()

const hasRates = computed(() => Object.keys(rates.value).length > 0)

async function fetchRates(): Promise<void> {
  const now = Date.now()
  if (fetchedAt.value && now - fetchedAt.value < CACHE_TTL_MS) return
  if (loading.value) return

  loading.value = true
  error.value = null

  const urls = [
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json',
    'https://latest.currency-api.pages.dev/v1/currencies/eur.json',
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: { date: string; eur: Record<string, number> } = await res.json()
      rates.value = { eur: 1, ...data.eur }
      rateDate.value = data.date
      fetchedAt.value = Date.now()
      loading.value = false
      try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ date: data.date, rates: rates.value }))
      } catch {
        // storage full or unavailable — rates still work for this session
      }
      return
    } catch {
      // try next URL
    }
  }

  error.value = 'Could not load live rates'
  loading.value = false
}

/**
 * Convert amount from one currency to another, rounded to 2 decimals.
 * Returns the original amount if a rate is missing — check `canConvert` first
 * where showing an unconverted number would mislead.
 */
function convert(amount: number, from: string, to: string): number {
  if (from === to || !amount) return amount
  const fromRate = rates.value[from.toLowerCase()]
  const toRate = rates.value[to.toLowerCase()]
  if (!fromRate || !toRate) return amount
  return Math.round(amount * (toRate / fromRate) * 100) / 100
}

/** Unrounded rate: 1 unit of `from` = this many units of `to`. Null when unknown. */
function getRate(from: string, to: string): number | null {
  if (from === to) return 1
  const fromRate = rates.value[from.toLowerCase()]
  const toRate = rates.value[to.toLowerCase()]
  if (!fromRate || !toRate) return null
  return toRate / fromRate
}

/** True when a rate is known for both currencies (or they are the same). */
function canConvert(from: string, to: string): boolean {
  if (from === to) return true
  return !!rates.value[from.toLowerCase()] && !!rates.value[to.toLowerCase()]
}

/** Get rates for supported currencies relative to base, formatted to 4 significant decimal places. */
function getRatesFor(base: string, supported: string[]): Array<{ code: string; rate: number }> {
  const baseRate = rates.value[base.toLowerCase()]
  if (!baseRate) return []
  return supported
    .filter((c) => c !== base)
    .map((code) => ({
      code,
      rate: +((rates.value[code.toLowerCase()] ?? 0) / baseRate).toPrecision(4),
    }))
}

export function useExchangeRates() {
  return {
    loading: readonly(loading),
    error: readonly(error),
    rateDate: readonly(rateDate),
    hasRates,
    fetchRates,
    convert,
    canConvert,
    getRate,
    getRatesFor,
  }
}
