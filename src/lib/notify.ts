import { ref } from 'vue'

export interface SaveError {
  id: number
  message: string
}

// Latest failed write, surfaced to the user by App.vue as a toast.
// Lives outside the stores so the service layer can report without touching them.
export const lastSaveError = ref<SaveError | null>(null)

let nextId = 0

/**
 * Report a failed write to the user. `action` completes the sentence
 * "Couldn't …" (e.g. "save your expense items", "delete the scenario").
 */
export function reportSaveError(action: string, detail?: string): void {
  console.warn(`[save] could not ${action}:`, detail ?? 'unknown error')
  nextId += 1
  lastSaveError.value = {
    id: nextId,
    message: `Couldn't ${action}. The change may be gone after a reload.`,
  }
}
