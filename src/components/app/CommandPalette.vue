<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useCommandPalette } from '@/composables/useCommandPalette'
import { useScenarioLoader } from '@/composables/useScenarioLoader'
import type { ThemeMode } from '@/models'
import { useCollaborationStore } from '@/stores/collaboration'
import { useProjectionStore } from '@/stores/projection'
import { useUiStore } from '@/stores/ui'

// Ctrl/⌘ K: jump to a page or run a common action from the keyboard. The shell
// owns the shortcut; this component is the dialog. It follows the combobox
// pattern — focus stays in the input and the arrow keys move the active option.

interface Command {
  id: string
  group: 'Go to' | 'Do' | 'Load a scenario' | 'Theme'
  label: string
  icon: string
  /** Extra words the search matches besides the label. */
  keywords?: string
  run: () => void
}

const { open, hide } = useCommandPalette()
const router = useRouter()
const uiStore = useUiStore()
const collabStore = useCollaborationStore()
const projectionStore = useProjectionStore()
const { loadScenario } = useScenarioLoader()

const go = (to: string | { path: string; query: Record<string, string> }) => (): void => { void router.push(to) }
const theme = (mode: ThemeMode) => (): void => uiStore.setThemeMode(mode)

const commands = computed((): Command[] => {
  const canEdit = !collabStore.isReadOnly
  const ownBudget = !collabStore.isViewingSharedBudget
  return [
    { id: 'go-overview', group: 'Go to', label: 'Overview', icon: 'pi pi-objects-column', keywords: 'dashboard home', run: go('/') },
    { id: 'go-plan', group: 'Go to', label: 'Plan', icon: 'pi pi-sliders-h', keywords: 'income expenses budget starting balance', run: go('/plan') },
    { id: 'go-forecast', group: 'Go to', label: 'Forecast', icon: 'pi pi-chart-line', keywords: 'projections months table', run: go('/forecast') },
    { id: 'go-savings', group: 'Go to', label: 'Savings', icon: 'pi pi-wallet', keywords: 'goals deposits', run: go('/savings') },
    { id: 'go-scenarios', group: 'Go to', label: 'Scenarios', icon: 'pi pi-bookmark', keywords: 'compare plans', run: go('/scenarios') },
    { id: 'go-sharing', group: 'Go to', label: 'Sharing', icon: 'pi pi-users', keywords: 'collaboration invite people', run: go('/collaboration') },
    { id: 'go-settings', group: 'Go to', label: 'Settings', icon: 'pi pi-cog', keywords: 'currency locale language', run: go('/settings') },
    ...(canEdit
      ? [
          { id: 'do-income', group: 'Do' as const, label: 'Add an income source', icon: 'pi pi-plus', keywords: 'salary new', run: go({ path: '/plan', query: { edit: 'income' } }) },
          { id: 'do-expense', group: 'Do' as const, label: 'Add an expense', icon: 'pi pi-plus', keywords: 'bill cost new', run: go({ path: '/plan', query: { edit: 'expense' } }) },
        ]
      : []),
    ...(ownBudget
      ? [{ id: 'do-goal', group: 'Do' as const, label: 'Create a savings goal', icon: 'pi pi-plus', keywords: 'new', run: go({ path: '/savings', query: { new: '1' } }) }]
      : []),
    ...(canEdit
      ? projectionStore.savedScenarios.map((scenario) => ({
          id: `scenario-${scenario.id}`,
          group: 'Load a scenario' as const,
          label: scenario.name,
          icon: 'pi pi-bookmark',
          keywords: 'load scenario',
          run: (): void => loadScenario(scenario.id),
        }))
      : []),
    { id: 'theme-light', group: 'Theme', label: 'Light theme', icon: 'pi pi-sun', keywords: 'appearance mode', run: theme('light') },
    { id: 'theme-dark', group: 'Theme', label: 'Dark theme', icon: 'pi pi-moon', keywords: 'appearance mode', run: theme('dark') },
    { id: 'theme-system', group: 'Theme', label: 'Match the device theme', icon: 'pi pi-desktop', keywords: 'appearance mode system auto', run: theme('system') },
  ]
})

const query = ref('')
const activeIndex = ref(0)
const input = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)

// Every word typed must appear somewhere in the label or its keywords
const results = computed(() => {
  const words = query.value.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return commands.value
  const inLabel = (command: Command): boolean => words.every((word) => command.label.toLowerCase().includes(word))
  const matches = commands.value.filter((command) => {
    const haystack = `${command.label} ${command.group} ${command.keywords ?? ''}`.toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
  // A match in the name itself outranks one found only through keywords
  return [...matches.filter(inLabel), ...matches.filter((command) => !inLabel(command))]
})

// Results in order, with a heading wherever the group changes
const sections = computed(() => {
  const out: Array<{ group: string; items: Array<{ command: Command; index: number }> }> = []
  results.value.forEach((command, index) => {
    let section = out.at(-1)
    if (!section || section.group !== command.group) {
      section = { group: command.group, items: [] }
      out.push(section)
    }
    section.items.push({ command, index })
  })
  return out
})

watch(query, () => { activeIndex.value = 0 })

let returnFocus: HTMLElement | null = null
watch(open, async (isOpen) => {
  if (isOpen) {
    returnFocus = document.activeElement as HTMLElement | null
    query.value = ''
    activeIndex.value = 0
    await nextTick()
    input.value?.focus()
  } else {
    returnFocus?.focus?.()
    returnFocus = null
  }
})

const scrollActiveIntoView = async (): Promise<void> => {
  await nextTick()
  list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
}

const move = (delta: number): void => {
  const count = results.value.length
  if (!count) return
  activeIndex.value = (activeIndex.value + delta + count) % count
  void scrollActiveIntoView()
}

const run = (command: Command | undefined): void => {
  if (!command) return
  hide()
  command.run()
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'ArrowDown') move(1)
  else if (event.key === 'ArrowUp') move(-1)
  else if (event.key === 'Home') { activeIndex.value = 0; void scrollActiveIntoView() }
  else if (event.key === 'End') { activeIndex.value = Math.max(0, results.value.length - 1); void scrollActiveIntoView() }
  else if (event.key === 'Enter') run(results.value[activeIndex.value])
  else if (event.key === 'Escape') hide()
  // Focus stays in the input: it is the only focusable element in the dialog
  else if (event.key === 'Tab') { /* keep focus */ }
  else return
  event.preventDefault()
}

const activeId = computed(() => {
  const command = results.value[activeIndex.value]
  return command ? `cmd-${command.id}` : undefined
})
</script>

<template>
  <Teleport to="body">
    <Transition name="palette">
      <div v-if="open" class="palette-backdrop" @pointerdown.self="hide">
        <div class="palette" role="dialog" aria-modal="true" aria-label="Search pages and actions">
          <div class="palette-search">
            <i class="pi pi-search" aria-hidden="true" />
            <input
              ref="input"
              v-model="query"
              class="palette-input"
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
              aria-autocomplete="list"
              :aria-activedescendant="activeId"
              aria-label="Search pages and actions"
              placeholder="Go to a page or do something…"
              autocomplete="off"
              spellcheck="false"
              @keydown="onKeydown"
            />
            <kbd class="palette-kbd">Esc</kbd>
          </div>

          <div id="palette-list" ref="list" class="palette-list" role="listbox" aria-label="Results">
            <template v-for="section in sections" :key="section.group">
              <p class="palette-group" role="presentation">{{ section.group }}</p>
              <div
                v-for="{ command, index } in section.items"
                :id="`cmd-${command.id}`"
                :key="command.id"
                class="palette-option"
                :class="{ 'palette-option-active': index === activeIndex }"
                role="option"
                :aria-selected="index === activeIndex"
                @pointermove="activeIndex = index"
                @click="run(command)"
              >
                <i :class="command.icon" aria-hidden="true" />
                <span>{{ command.label }}</span>
              </div>
            </template>
            <p v-if="!results.length" class="palette-empty">Nothing matches “{{ query }}”.</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.palette-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 14vh 1rem 1rem;
  background: rgba(10, 14, 12, 0.36);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.palette {
  display: flex;
  flex-direction: column;
  width: min(100%, 34rem);
  max-height: min(70vh, 30rem);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-pop);
  overflow: hidden;
}

.palette-search {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1rem;
  border-bottom: 1px solid var(--app-border);
  color: var(--app-text-secondary);
}

.palette-input {
  flex: 1;
  min-width: 0;
  height: 3.25rem;
  border: none;
  outline: none;
  background: none;
  font-size: 1rem;
  color: var(--app-text);
}

.palette-input::placeholder {
  color: var(--app-text-tertiary);
}

.palette-kbd {
  padding: 0.125rem 0.375rem;
  border: 1px solid var(--app-border);
  border-radius: 0.3125rem;
  font-family: inherit;
  font-size: 0.6875rem;
  color: var(--app-text-secondary);
}

.palette-list {
  padding: 0.375rem;
  overflow-y: auto;
}

.palette-group {
  margin: 0;
  padding: 0.5rem 0.625rem 0.25rem;
  font-size: 0.75rem;
  color: var(--app-text-secondary);
}

.palette-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5625rem 0.625rem;
  border-radius: var(--radius-control);
  font-size: 0.875rem;
  color: var(--app-text);
  cursor: pointer;
}

.palette-option .pi {
  width: 1rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--app-text-secondary);
}

.palette-option-active {
  background: var(--app-surface-hover);
}

.palette-option-active .pi {
  color: var(--app-accent);
}

.palette-empty {
  margin: 0;
  padding: 1.25rem 0.625rem;
  font-size: 0.875rem;
  color: var(--app-text-secondary);
  text-align: center;
}

/* Opens in answer to the shortcut: a short fade and settle */
.palette-enter-active {
  transition: opacity 0.14s ease;
}

.palette-enter-active .palette {
  transition: transform 0.18s var(--ease-out);
}

.palette-leave-active {
  transition: opacity 0.1s ease;
}

.palette-enter-from,
.palette-leave-to {
  opacity: 0;
}

.palette-enter-from .palette {
  transform: translateY(-6px) scale(0.985);
}
</style>
