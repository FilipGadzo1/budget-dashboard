import { readonly, ref } from 'vue'

// Rates keyed by lowercase currency code, relative to EUR (e.g. rates['sek'] = 11.38 means 1 EUR = 11.38 SEK)
const rates = ref<Record<string, number>>({})
const rateDate = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const fetchedAt = ref<number | null>(null)

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour — rates update daily, no need to refetch every visit

export function useExchangeRates() {
  async function fetchRates(): Promise<void> {
    const now = Date.now()
    if (fetchedAt.value && now - fetchedAt.value < CACHE_TTL_MS) return

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
        return
      } catch {
        // try next URL
      }
    }

    error.value = 'Could not load live rates'
    loading.value = false
  }

  /** Convert amount from one currency to another. Returns original amount if rates not loaded. */
  function convert(amount: number, from: string, to: string): number {
    if (from === to || !amount) return amount
    const fromRate = rates.value[from.toLowerCase()]
    const toRate = rates.value[to.toLowerCase()]
    if (!fromRate || !toRate) return amount
    return Math.round(amount * (toRate / fromRate))
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

  return {
    loading: readonly(loading),
    error: readonly(error),
    rateDate: readonly(rateDate),
    fetchRates,
    convert,
    getRatesFor,
  }
}
