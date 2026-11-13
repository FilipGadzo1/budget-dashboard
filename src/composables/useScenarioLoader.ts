import { useCurrency } from '@/composables/useCurrency'
import { rebaseInputs } from '@/services/currencyService'
import { useProjectionStore } from '@/stores/projection'

/** Loads a saved scenario into the live plan. Shared by Scenarios and the command palette. */
export const useScenarioLoader = () => {
  const projectionStore = useProjectionStore()
  const { currencyCode, convert } = useCurrency()

  const loadScenario = (id: string): void => {
    projectionStore.loadScenario(id)
    // A scenario saved while another display currency was active: bring its plain
    // income/expenses fields into the current one. Itemised amounts keep their own.
    const loaded = projectionStore.inputs
    if (loaded.currency && loaded.currency !== currencyCode.value) {
      projectionStore.setInputs(rebaseInputs(loaded, loaded.currency, currencyCode.value, convert))
    }
  }

  return { loadScenario }
}
