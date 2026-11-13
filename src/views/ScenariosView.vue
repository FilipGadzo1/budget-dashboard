<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import { vAutoAnimate } from '@formkit/auto-animate/vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'

import ConfirmDeleteDialog from '@/components/shared/ConfirmDeleteDialog.vue'
import DialogHeader from '@/components/shared/DialogHeader.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import LineChart, { type ChartSeries } from '@/components/shared/LineChart.vue'
import StatusMessage from '@/components/shared/StatusMessage.vue'
import ScenarioCard from '@/components/scenarios/ScenarioCard.vue'
import ScenarioComparison, { type ComparisonRow } from '@/components/scenarios/ScenarioComparison.vue'
import { useCurrency } from '@/composables/useCurrency'
import { useScenarioLoader } from '@/composables/useScenarioLoader'
import { useTimeTravel } from '@/composables/useTimeTravel'
import { useEffectiveProjection } from '@/composables/useEffectiveProjection'
import type { ProjectionInputs, ProjectionScenario } from '@/models'
import { useCollaborationStore } from '@/stores/collaboration'
import { useProjectionStore } from '@/stores/projection'

const projectionStore = useProjectionStore()
const collabStore = useCollaborationStore()
const { formatCurrency, formatCompactCurrency, locale } = useCurrency()
const { loadScenario } = useScenarioLoader()

const { projectPlan, rows, hasFocus, focusIdx } = useEffectiveProjection()
const { focus } = useTimeTravel()

// The live plan and every saved scenario as lines on one chart, so you can see
// where the paths split. Each scenario is projected the same way as the live plan.
const SCENARIO_HUES = [215, 38, 322, 265, 190, 24]
const compareSeries = computed((): ChartSeries[] => [
  { key: '__current__', label: 'Current plan', color: 'var(--chart-1)', values: rows.value.map((r) => r.cumulativeBalance), area: true },
  ...projectionStore.savedScenarios.map((scenario, i) => ({
    key: scenario.id,
    label: scenario.name,
    color: `hsl(${SCENARIO_HUES[i % SCENARIO_HUES.length]} 75% 62%)`,
    values: projectPlan(scenario.inputs).rows.map((r) => r.cumulativeBalance),
    dashed: true,
  })),
])

const totalsFor = (scenario: ProjectionScenario): { income: number; expenses: number } =>
  projectPlan(scenario.inputs).totals

// The live plan followed by every saved scenario, each projected the same way.
const comparisonRows = computed((): ComparisonRow[] => {
  const row = (id: string, name: string, inputs: ProjectionInputs, flags: { isCurrent: boolean; isActive: boolean }): ComparisonRow => {
    const plan = projectPlan(inputs)
    return {
      id,
      name,
      ...flags,
      income: plan.totals.income,
      expenses: plan.totals.expenses,
      months: plan.months,
      endingBalance: plan.summary.endingBalance,
      firstNegativeMonthLabel: plan.milestones.firstNegativeMonthLabel,
    }
  }
  return [
    row('__current__', 'Current plan', projectionStore.inputs, { isCurrent: true, isActive: false }),
    ...projectionStore.savedScenarios.map((s) =>
      row(s.id, s.name, s.inputs, { isCurrent: false, isActive: s.id === projectionStore.activeScenarioId }),
    ),
  ]
})

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
  <div class="page">
    <header class="page-head">
      <div>
        <h1 class="page-title">Scenarios</h1>
        <p class="page-description">Save a plan, change things, and see where the paths split.</p>
      </div>
    </header>

    <div class="page-body with-rail">
      <div class="stack">
        <!-- Empty state -->
        <EmptyState
          v-if="!projectionStore.savedScenarios.length"
          class="grow"
          title="No saved scenarios yet"
          description="Save your current plan as a scenario, then change things and compare the two side by side."
          icon="pi pi-bookmark"
          :action-label="collabStore.isReadOnly ? '' : 'Save baseline'"
          @action="projectionStore.saveScenario('Baseline plan')"
        />

        <!-- The paths on one chart, then the figures -->
        <template v-else>
          <section class="card card-col grow chart-box" aria-labelledby="scn-chart-title">
            <h2 id="scn-chart-title" class="card-title">Cash under each plan</h2>
            <LineChart
              :month-keys="rows.map((r) => r.monthKey)"
              :month-labels="rows.map((r) => r.monthLabel)"
              :series="compareSeries"
              :format-currency="formatCurrency"
              :format-compact="formatCompactCurrency"
              :locale="locale"
              :focus-index="hasFocus ? focusIdx : null"
              label="Cash under the current plan and each saved scenario"
              @select="focus"
            />
          </section>

          <ScenarioComparison class="scn-table scroll-y" :rows="comparisonRows" />
        </template>
      </div>

      <!-- Rail: save the current plan, the saved scenarios, moving them in and out -->
      <aside class="stack">
        <section class="card card-col scn-card" aria-labelledby="scn-save-title">
          <h2 id="scn-save-title" class="card-title">Save the current plan</h2>
          <p v-if="collabStore.isReadOnly" class="scn-note scn-note-warning">
            <i class="pi pi-eye text-xs" aria-hidden="true" />
            View only: you can load and export scenarios, not save or change them.
          </p>
          <div>
            <label class="form-label" for="scenario-name">Scenario name</label>
            <InputText id="scenario-name" v-model="scenarioName" placeholder="e.g. Conservative plan" class="w-full" :disabled="collabStore.isReadOnly" />
          </div>
          <div class="scn-actions">
            <button class="btn btn-primary" :disabled="collabStore.isReadOnly" @click="saveScenario">
              <i class="pi pi-save text-sm" aria-hidden="true" /> Save current
            </button>
            <button v-if="projectionStore.activeScenarioId" class="btn btn-secondary" :disabled="collabStore.isReadOnly" @click="overwriteActive">
              Overwrite active
            </button>
          </div>
        </section>

        <!-- Saved scenarios: the list scrolls inside this space -->
        <div v-if="projectionStore.savedScenarios.length" v-auto-animate="{ duration: 200 }" class="scn-cards scroll-y grow">
          <ScenarioCard
            v-for="scenario in projectionStore.savedScenarios"
            :key="scenario.id"
            :scenario="scenario"
            :totals="totalsFor(scenario)"
            :is-active="scenario.id === projectionStore.activeScenarioId"
            :format-currency="formatCurrency"
            :readonly="collabStore.isReadOnly"
            @load="loadScenario(scenario.id)"
            @rename="openRename(scenario)"
            @delete="openDelete(scenario.id)"
          />
        </div>
        <div v-else class="grow" />

        <section class="card card-col scn-card" aria-labelledby="scn-file-title">
          <h2 id="scn-file-title" class="card-title">Back up or move</h2>
          <div class="scn-actions">
            <button class="btn btn-secondary btn-sm" @click="exportFile">
              <i class="pi pi-upload text-xs" aria-hidden="true" /> Export all
            </button>
            <label class="btn btn-secondary btn-sm import-label" :class="{ 'btn-disabled': collabStore.isReadOnly }">
              <i class="pi pi-download text-xs" aria-hidden="true" /> Import
              <input class="import-input" type="file" accept="application/json" :disabled="collabStore.isReadOnly" @change="importFile" />
            </label>
          </div>
          <StatusMessage :message="importState.message" :tone="importState.tone" />
        </section>
      </aside>
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

<style scoped>
/* The figures table keeps to a share of the height and scrolls if it is long */
.scn-table {
  flex: 0 1 auto;
  max-height: 42%;
}

.scn-cards {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-right: 0.25rem;
}

.scn-card {
  flex: none;
}

.scn-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.scn-note {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--app-text-secondary);
}

.scn-note-warning {
  color: var(--app-warning);
}

@media (max-width: 1023px) {
  .scn-table {
    max-height: none;
  }
}
</style>
