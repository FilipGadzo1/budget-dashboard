<script setup lang="ts">
import { reactive, ref } from 'vue'

import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

import { useCurrency } from '@/composables/useCurrency'
import type { ProjectionScenario } from '@/models'
import { useProjectionStore } from '@/stores/projection'

import ConfirmDeleteDialog from '@/components/shared/ConfirmDeleteDialog.vue'
import EmptyState from '@/components/shared/EmptyState.vue'

const projectionStore = useProjectionStore()
const { formatCurrency } = useCurrency()

const scenarioName = ref('')
const importState = reactive({
  message: '',
  tone: 'neutral' as 'neutral' | 'success' | 'error',
})

const showRenameDialog = ref(false)
const renameTarget = ref<ProjectionScenario | null>(null)
const renameValue = ref('')

const showDeleteDialog = ref(false)
const deleteTargetId = ref<string | null>(null)

const saveScenario = (): void => {
  projectionStore.saveScenario(scenarioName.value)
  scenarioName.value = ''
}

const loadScenario = (id: string): void => {
  projectionStore.loadScenario(id)
}

const openRename = (scenario: ProjectionScenario): void => {
  renameTarget.value = scenario
  renameValue.value = scenario.name
  showRenameDialog.value = true
}

const confirmRename = (): void => {
  if (renameTarget.value && renameValue.value.trim()) {
    projectionStore.renameScenario(renameTarget.value.id, renameValue.value)
  }
  showRenameDialog.value = false
}

const openDelete = (id: string): void => {
  deleteTargetId.value = id
  showDeleteDialog.value = true
}

const confirmDelete = (): void => {
  if (deleteTargetId.value) {
    projectionStore.deleteScenario(deleteTargetId.value)
  }
  deleteTargetId.value = null
}

const overwriteActive = (): void => {
  projectionStore.overwriteActiveScenario(scenarioName.value)
  scenarioName.value = ''
}

const exportFile = (): void => {
  const payload = projectionStore.exportScenarios()
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `budget-scenarios-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

const importFile = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const payload = await file.text()
    const imported = projectionStore.importScenarios(payload)
    importState.message = imported
      ? `Imported ${imported} scenario${imported === 1 ? '' : 's'}.`
      : 'No new scenarios found.'
    importState.tone = imported ? 'success' : 'neutral'
  } catch {
    importState.message = 'Could not import file.'
    importState.tone = 'error'
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Scenarios</h1>
      <p class="page-description">Save, compare, and manage different budget plans.</p>
    </div>

    <!-- Toolbar -->
    <div class="card mb-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div class="flex-1">
          <label class="form-label" for="scenario-name">Scenario name</label>
          <InputText
            id="scenario-name"
            v-model="scenarioName"
            placeholder="e.g. Conservative plan"
            class="w-full"
          />
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <button class="btn btn-primary" @click="saveScenario">
            <i class="pi pi-save text-sm" /> Save current
          </button>
          <button
            v-if="projectionStore.activeScenarioId"
            class="btn btn-secondary"
            @click="overwriteActive"
          >
            Overwrite active
          </button>
        </div>
      </div>
    </div>

    <!-- Import/Export bar -->
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <button class="btn btn-secondary btn-sm" @click="exportFile">
        <i class="pi pi-upload text-xs" /> Export all
      </button>
      <label class="btn btn-secondary btn-sm import-label">
        <i class="pi pi-download text-xs" /> Import
        <input class="import-input" type="file" accept="application/json" @change="importFile" />
      </label>
      <p
        v-if="importState.message"
        class="text-sm"
        :class="importState.tone === 'success' ? 'text-positive' : importState.tone === 'error' ? 'text-negative' : 'text-secondary'"
      >
        {{ importState.message }}
      </p>
    </div>

    <!-- Empty state -->
    <EmptyState
      v-if="!projectionStore.savedScenarios.length"
      title="No saved scenarios yet"
      description="Save your current budget inputs as a scenario to start comparing different plans side by side."
      icon="pi pi-bookmark"
      action-label="Save baseline"
      @action="projectionStore.saveScenario('Baseline plan')"
    />

    <!-- Scenario list -->
    <div v-else class="grid gap-3 lg:grid-cols-2">
      <article
        v-for="scenario in projectionStore.savedScenarios"
        :key="scenario.id"
        class="scenario-card"
        :class="{ 'scenario-card-active': scenario.id === projectionStore.activeScenarioId }"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold truncate" style="color: var(--app-text)">{{ scenario.name }}</h3>
            <span v-if="scenario.id === projectionStore.activeScenarioId" class="status-pill status-pill-positive text-xs">Active</span>
          </div>
          <p class="mt-1 text-xs text-secondary tabular-nums">
            {{ formatCurrency(scenario.inputs.monthlyIncome) }} income · {{ formatCurrency(scenario.inputs.monthlyExpenses) }} expenses · {{ scenario.inputs.months }}mo
          </p>
        </div>
        <div class="flex gap-1.5 flex-shrink-0">
          <button class="btn btn-primary btn-sm" @click="loadScenario(scenario.id)">Load</button>
          <button class="btn btn-ghost btn-sm" @click="openRename(scenario)">Rename</button>
          <button class="btn btn-danger btn-sm" @click="openDelete(scenario.id)">Delete</button>
        </div>
      </article>
    </div>

    <!-- Rename dialog -->
    <Dialog
      v-model:visible="showRenameDialog"
      modal
      dismissable-mask
      :draggable="false"
      :style="{ width: 'min(92vw, 26rem)' }"
    >
      <template #header>
        <div>
          <p class="text-label">Rename</p>
          <h3 class="mt-1 text-lg font-semibold" style="color: var(--app-text)">Rename scenario</h3>
        </div>
      </template>
      <div>
        <label class="form-label" for="rename-input">New name</label>
        <InputText id="rename-input" v-model="renameValue" class="w-full" @keyup.enter="confirmRename" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button class="btn btn-secondary" @click="showRenameDialog = false">Cancel</button>
          <button class="btn btn-primary" @click="confirmRename">Rename</button>
        </div>
      </template>
    </Dialog>

    <!-- Delete dialog -->
    <ConfirmDeleteDialog
      v-model:visible="showDeleteDialog"
      title="Delete scenario"
      message="This scenario will be permanently removed. This cannot be undone."
      confirm-label="Delete"
      @confirm="confirmDelete"
    />
  </div>
</template>
