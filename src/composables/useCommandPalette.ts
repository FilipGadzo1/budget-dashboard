import { ref } from 'vue'

// Module-level so the shell's shortcut, the sidebar button and the palette itself
// all share one open state.
const open = ref(false)

export const useCommandPalette = () => ({
  open,
  show: (): void => { open.value = true },
  hide: (): void => { open.value = false },
  toggle: (): void => { open.value = !open.value },
})
