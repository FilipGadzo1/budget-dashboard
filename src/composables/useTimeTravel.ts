import { ref } from 'vue'

// The month of the forecast the app is "looking at", shared by every page
// (module-level singleton). It is picked by clicking a month in a chart, the
// month strip or the forecast table; null means the end of the plan, the
// default. It is never saved and resets when the shell unmounts (sign-out).

const focusIndex = ref<number | null>(null)

export const useTimeTravel = () => {
  const focus = (index: number | null): void => { focusIndex.value = index }
  const resetAll = (): void => { focusIndex.value = null }

  return { focusIndex, focus, resetAll }
}
