<script setup lang="ts">
import { computed, ref } from 'vue'

import ConfirmDeleteDialog from '@/components/shared/ConfirmDeleteDialog.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import DepositDialog from '@/components/savings/DepositDialog.vue'
import SavingsGoalCard from '@/components/savings/SavingsGoalCard.vue'
import SavingsGoalDialog from '@/components/savings/SavingsGoalDialog.vue'
import { useCurrency } from '@/composables/useCurrency'
import type { SavingsGoal, SavingsGoalStatus } from '@/models'
import { computeRequiredMonthly } from '@/services/savingsService'
import { useCollaborationStore } from '@/stores/collaboration'
import { useSavingsStore } from '@/stores/savings'

const savingsStore = useSavingsStore()
const collabStore = useCollaborationStore()
const { formatCurrency } = useCurrency()

const readonly = computed(() => collabStore.isReadOnly)

// ─── Goal dialog (create / edit) ──────────────────────────────────────────────

const showGoalDialog = ref(false)
const editingGoal = ref<SavingsGoal | null>(null)

const openNewGoal = (): void => {
  editingGoal.value = null
  showGoalDialog.value = true
}

const openEditGoal = (goal: SavingsGoal): void => {
  editingGoal.value = goal
  showGoalDialog.value = true
}

const handleGoalSave = (data: {
  name: string
  emoji: string
  targetAmount: number
  monthlyContribution: number
  targetDate: string | null
  status: SavingsGoalStatus
  note: string | null
}): void => {
  if (editingGoal.value) {
    savingsStore.updateGoal(editingGoal.value.id, data)
  } else {
    savingsStore.addGoal({ ...data })
  }
}

// ─── Delete dialog ─────────────────────────────────────────────────────────────

const showDeleteDialog = ref(false)
const deleteTargetId = ref<string | null>(null)

const openDelete = (goalId: string): void => {
  deleteTargetId.value = goalId
  showDeleteDialog.value = true
}

const confirmDelete = (): void => {
  if (deleteTargetId.value) {
    savingsStore.deleteGoal(deleteTargetId.value)
  }
  deleteTargetId.value = null
}

// ─── Deposit dialog ────────────────────────────────────────────────────────────

const showDepositDialog = ref(false)
const depositGoal = ref<SavingsGoal | null>(null)

const openDeposit = async (goal: SavingsGoal): Promise<void> => {
  depositGoal.value = goal
  showDepositDialog.value = true
  await savingsStore.loadDeposits(goal.id)
}

const handleDepositSave = async (
  amount: number,
  note: string | null,
  depositDate: string,
): Promise<void> => {
  if (!depositGoal.value) return
  await savingsStore.addDeposit(depositGoal.value.id, { amount, note, depositDate })
  // Sync the ref so the dialog shows the updated goal
  depositGoal.value = savingsStore.goals.find((g) => g.id === depositGoal.value!.id) ?? depositGoal.value
}

const handleDeleteDeposit = async (depositId: string): Promise<void> => {
  if (!depositGoal.value) return
  await savingsStore.removeDeposit(depositId, depositGoal.value.id)
  depositGoal.value = savingsStore.goals.find((g) => g.id === depositGoal.value!.id) ?? depositGoal.value
}

const handleUseRequired = (goal: SavingsGoal): void => {
  const required = computeRequiredMonthly(goal)
  if (required === null) return
  savingsStore.updateGoal(goal.id, { monthlyContribution: required })
}

const depositDeposits = computed(() =>
  depositGoal.value ? (savingsStore.deposits[depositGoal.value.id] ?? []) : [],
)

// ─── Summary strip ─────────────────────────────────────────────────────────────

const totalSaved = computed(() =>
  savingsStore.goals.reduce((sum, g) => sum + g.currentAmount, 0),
)
const activeGoals = computed(() => savingsStore.goals.filter((g) => g.status === 'active').length)
</script>

<template>
  <div class="page-container">
    <!-- Page header -->
    <header class="page-header savings-page-header">
      <div>
        <h1 class="page-title">Savings Goals</h1>
        <p class="page-subtitle text-secondary text-sm">
          Track your savings targets and deposits
        </p>
      </div>
      <button v-if="!readonly" class="btn btn-primary" @click="openNewGoal">
        <i class="pi pi-plus" /> New goal
      </button>
    </header>

    <!-- Summary strip -->
    <div v-if="savingsStore.goals.length > 0" class="card card-sm savings-summary">
      <div class="savings-summary-items">
        <div class="savings-summary-item">
          <span class="savings-summary-label">Total saved</span>
          <span class="savings-summary-value tabular-nums">{{ formatCurrency(totalSaved) }}</span>
        </div>
        <div class="savings-summary-divider" />
        <div class="savings-summary-item">
          <span class="savings-summary-label">Monthly allocated</span>
          <span class="savings-summary-value tabular-nums">
            {{ formatCurrency(savingsStore.totalMonthlyContributions) }}/mo
          </span>
        </div>
        <div class="savings-summary-divider" />
        <div class="savings-summary-item">
          <span class="savings-summary-label">Active goals</span>
          <span class="savings-summary-value">{{ activeGoals }}</span>
        </div>
      </div>
    </div>

    <!-- Goal cards -->
    <div v-if="savingsStore.sortedGoals.length > 0" class="savings-goals-grid">
      <SavingsGoalCard
        v-for="goal in savingsStore.sortedGoals"
        :key="goal.id"
        :goal="goal"
        :format-currency="formatCurrency"
        :readonly="readonly"
        @deposit="openDeposit(goal)"
        @edit="openEditGoal(goal)"
        @delete="openDelete(goal.id)"
        @use-required="handleUseRequired(goal)"
      />
    </div>

    <!-- Empty state -->
    <EmptyState
      v-else-if="!savingsStore.isReady"
      icon="pi-spin pi-spinner"
      title="Loading goals…"
      description=""
    />
    <EmptyState
      v-else
      icon="pi-wallet"
      title="No savings goals yet"
      :description="readonly ? 'No goals have been created for this budget.' : 'Create your first goal to start tracking your savings.'"
      :action-label="readonly ? '' : 'New goal'"
      @action="openNewGoal"
    />
  </div>

  <!-- Dialogs -->
  <SavingsGoalDialog
    v-model:visible="showGoalDialog"
    :goal="editingGoal"
    @save="handleGoalSave"
  />

  <DepositDialog
    v-model:visible="showDepositDialog"
    :goal="depositGoal"
    :deposits="depositDeposits"
    :format-currency="formatCurrency"
    :readonly="readonly"
    @save="handleDepositSave"
    @delete-deposit="handleDeleteDeposit"
  />

  <ConfirmDeleteDialog
    :visible="showDeleteDialog"
    title="Delete goal"
    message="This will permanently delete the goal and all its deposit history."
    @confirm="confirmDelete"
    @update:visible="showDeleteDialog = $event"
  />
</template>

<style scoped>
.page-container {
  max-width: 800px;
}

.savings-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.page-title {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--app-text);
  margin: 0 0 0.25rem;
}

.page-subtitle {
  margin: 0;
}

.savings-summary {
  margin-bottom: 1.5rem;
}

.savings-summary-items {
  display: flex;
  align-items: center;
  gap: 0;
  flex-wrap: wrap;
}

.savings-summary-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.25rem 1.5rem 0.25rem 0;
  flex: 1;
  min-width: 120px;
}

.savings-summary-item:first-child {
  padding-left: 0;
}

.savings-summary-label {
  font-size: 0.75rem;
  color: var(--app-text-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.savings-summary-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--app-text);
}

.savings-summary-divider {
  width: 1px;
  height: 2.5rem;
  background: var(--app-border);
  margin: 0 1.5rem 0 0;
  flex-shrink: 0;
}

.savings-goals-grid {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}
</style>
