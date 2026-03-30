<script setup lang="ts">
import { reactive, ref } from 'vue'

import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

import ConfirmDeleteDialog from '@/components/shared/ConfirmDeleteDialog.vue'
import DialogHeader from '@/components/shared/DialogHeader.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import StatusMessage from '@/components/shared/StatusMessage.vue'
import ScenarioCard from '@/components/scenarios/ScenarioCard.vue'
import { useCurrency } from '@/composables/useCurrency'
import type { ProjectionScenario } from '@/models'
import { useCollaborationStore } from '@/stores/collaboration'
import { useProjectionStore } from '@/stores/projection'

const projectionStore = useProjectionStore()
const collabStore = useCollaborationStore()
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
  const scenario = projectionStore.saveScenario(scenarioName.value)
  void collabStore.logActivity('saved_scenario', { name: scenario.name })
  scenarioName.value = ''
}

const loadScenario = (id: string): void => { projectionStore.loadScenario(id) }

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
    const scenario = projectionStore.savedScenarios.find((s) => s.id === deleteTargetId.value)
    projectionStore.deleteScenario(deleteTargetId.value)
    void collabStore.logActivity('deleted_scenario', { name: scenario?.name ?? '' })
  }
  deleteTargetId.value = null
}

const overwriteActive = (): void => {
  projectionStore.overwriteActiveScenario(scenarioName.value)
  scenarioName.value = ''
}

const exportFile = (): void => {
  const blob = new Blob([projectionStore.exportScenarios()], { type: 'application/json' })
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
    const imported = projectionStore.importScenarios(await file.text())
    importState.message = imported ? `Imported ${imported} scenario${imported === 1 ? '' : 's'}.` : 'No new scenarios found.'
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
      <div v-if="collabStore.isReadOnly" class="mb-3 flex items-center gap-2 text-sm" style="color: var(--app-warning)">
        <i class="pi pi-eye text-xs" />
        <span>You have view-only access. Load and export scenarios, but cannot save or modify.</span>
      </div>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div class="flex-1">
          <label class="form-label" for="scenario-name">Scenario name</label>
          <InputText id="scenario-name" v-model="scenarioName" placeholder="e.g. Conservative plan" class="w-full" :disabled="collabStore.isReadOnly" />
        </div>
        <div class="flex gap-2 sm:flex-shrink-0">
          <button class="btn btn-primary flex-1 sm:flex-none" :disabled="collabStore.isReadOnly" @click="saveScenario">
            <i class="pi pi-save text-sm" /> Save current
          </button>
          <button v-if="projectionStore.activeScenarioId" class="btn btn-secondary flex-1 sm:flex-none" :disabled="collabStore.isReadOnly" @click="overwriteActive">
            Overwrite active
          </button>
        </div>
      </div>
    </div>

    <!-- Import/Export bar -->
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <button class="btn btn-secondary btn-sm" @click="exportFile">
        <i class="pi pi-upload text-xs" /> Export all
      </button>
      <label class="btn btn-secondary btn-sm import-label" :class="{ 'btn-disabled': collabStore.isReadOnly }">
        <i class="pi pi-download text-xs" /> Import
        <input class="import-input" type="file" accept="application/json" :disabled="collabStore.isReadOnly" @change="importFile" />
      </label>
      <StatusMessage :message="importState.message" :tone="importState.tone" />
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
      <ScenarioCard
        v-for="scenario in projectionStore.savedScenarios"
        :key="scenario.id"
        :scenario="scenario"
        :is-active="scenario.id === projectionStore.activeScenarioId"
        :format-currency="formatCurrency"
        :readonly="collabStore.isReadOnly"
        @load="loadScenario(scenario.id)"
        @rename="openRename(scenario)"
        @delete="openDelete(scenario.id)"
      />
    </div>

    <!-- Rename dialog -->
    <Dialog v-model:visible="showRenameDialog" modal dismissable-mask :draggable="false" :style="{ width: 'min(92vw, 26rem)' }">
      <template #header>
        <DialogHeader label="Rename" title="Rename scenario" />
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
