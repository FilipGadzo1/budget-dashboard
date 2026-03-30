<script setup lang="ts">
import { ref } from 'vue'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'

import type { MonthAdjustment, ProjectionRow } from '@/models'

const props = defineProps<{
  rows: ProjectionRow[]
  formatCurrency: (n: number) => string
  adjustments: MonthAdjustment[]
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:adjustments': [adjustments: MonthAdjustment[]]
}>()

const expandedMonthKey = ref<string | null>(null)
const draft = ref({ incomeAdjustment: 0, expenseAdjustment: 0, note: '' })

const toggleExpand = (monthKey: string): void => {
  if (expandedMonthKey.value === monthKey) {
    expandedMonthKey.value = null
    return
  }
  const existing = props.adjustments.find((a) => a.monthKey === monthKey)
  draft.value = {
    incomeAdjustment: existing?.incomeAdjustment ?? 0,
    expenseAdjustment: existing?.expenseAdjustment ?? 0,
    note: existing?.note ?? '',
  }
  expandedMonthKey.value = monthKey
}

const saveAdjustment = (monthKey: string): void => {
  const withoutThis = props.adjustments.filter((a) => a.monthKey !== monthKey)
  const isNoop = draft.value.incomeAdjustment === 0 && draft.value.expenseAdjustment === 0
  const next: MonthAdjustment[] = isNoop
    ? withoutThis
    : [
        ...withoutThis,
        {
          id: props.adjustments.find((a) => a.monthKey === monthKey)?.id ?? crypto.randomUUID(),
          monthKey,
          incomeAdjustment: draft.value.incomeAdjustment,
          expenseAdjustment: draft.value.expenseAdjustment,
          note: draft.value.note.trim() || undefined,
        },
      ]
  emit('update:adjustments', next)
  expandedMonthKey.value = null
}

const clearAdjustment = (monthKey: string): void => {
  emit('update:adjustments', props.adjustments.filter((a) => a.monthKey !== monthKey))
  expandedMonthKey.value = null
}
</script>

<template>
  <div class="mt-6 overflow-x-auto rounded-lg border border-app">
    <table class="data-table">
      <thead>
        <tr>
          <th>Month</th>
          <th>Income</th>
          <th>Expenses</th>
          <th>Net</th>
          <th>Cumulative Balance</th>
          <th v-if="!readonly" class="w-8" />
        </tr>
      </thead>
      <tbody>
        <template v-for="row in rows" :key="row.monthKey">
          <tr
            :class="{ 'cursor-pointer select-none hover:bg-[var(--app-surface-hover)]': !readonly }"
            @click="!readonly && toggleExpand(row.monthKey)"
          >
            <td class="font-medium">
              <span class="flex items-center gap-2">
                {{ row.monthLabel }}
                <span
                  v-if="row.incomeAdjustment !== 0 || row.expenseAdjustment !== 0"
                  class="status-pill status-pill-warning py-0 px-1.5 text-xs leading-4"
                >adj</span>
              </span>
            </td>
            <td class="tabular-nums">
              {{ formatCurrency(row.income) }}
              <span
                v-if="row.incomeAdjustment !== 0"
                class="ml-1 text-xs"
                :class="row.incomeAdjustment > 0 ? 'text-positive' : 'text-negative'"
              >{{ row.incomeAdjustment > 0 ? '+' : '' }}{{ formatCurrency(row.incomeAdjustment) }}</span>
            </td>
            <td class="tabular-nums">
              {{ formatCurrency(row.expenses) }}
              <span
                v-if="row.expenseAdjustment !== 0"
                class="ml-1 text-xs text-negative"
              >+{{ formatCurrency(row.expenseAdjustment) }}</span>
            </td>
            <td class="tabular-nums" :class="row.net >= 0 ? 'text-positive' : 'text-negative'">{{ formatCurrency(row.net) }}</td>
            <td class="tabular-nums" :class="row.cumulativeBalance >= 0 ? '' : 'text-negative'">{{ formatCurrency(row.cumulativeBalance) }}</td>
            <td v-if="!readonly" class="w-8 text-right">
              <i
                class="pi text-xs text-secondary transition-transform duration-150"
                :class="expandedMonthKey === row.monthKey ? 'pi-chevron-up' : 'pi-chevron-down'"
              />
            </td>
          </tr>

          <tr
            v-if="expandedMonthKey === row.monthKey && !readonly"
            class="bg-[var(--app-surface-hover)]"
          >
            <td colspan="6" class="px-4 py-3">
              <div class="flex flex-wrap items-end gap-3">
                <div>
                  <label class="form-label">Extra income</label>
                  <InputNumber
                    v-model="draft.incomeAdjustment"
                    :min-fraction-digits="0"
                    :max-fraction-digits="2"
                    mode="decimal"
                    :use-grouping="true"
                    fluid
                    @click.stop
                  />
                </div>
                <div>
                  <label class="form-label">Extra expense</label>
                  <InputNumber
                    v-model="draft.expenseAdjustment"
                    :min-fraction-digits="0"
                    :max-fraction-digits="2"
                    mode="decimal"
                    :use-grouping="true"
                    fluid
                    @click.stop
                  />
                </div>
                <div class="min-w-32 flex-1">
                  <label class="form-label">Note (optional)</label>
                  <InputText v-model="draft.note" placeholder="e.g. Annual bonus" fluid @click.stop />
                </div>
                <div class="flex shrink-0 gap-2" @click.stop>
                  <button class="btn btn-primary btn-sm" @click="saveAdjustment(row.monthKey)">Save</button>
                  <button
                    v-if="row.incomeAdjustment !== 0 || row.expenseAdjustment !== 0"
                    class="btn btn-danger btn-sm"
                    @click="clearAdjustment(row.monthKey)"
                  >Clear</button>
                  <button class="btn btn-secondary btn-sm" @click="expandedMonthKey = null">Cancel</button>
                </div>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
