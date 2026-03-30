// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { mockProjectionInputs } from '@/data/mockData'

import { useProjectionStore } from './projection'

describe('projection store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with default inputs and empty scenarios', () => {
    const projectionStore = useProjectionStore()

    expect(projectionStore.inputs).toEqual(mockProjectionInputs)
    expect(projectionStore.savedScenarios).toEqual([])
    expect(projectionStore.activeScenarioId).toBeNull()
  })

  it('saves, loads, and deletes named scenarios', () => {
    const projectionStore = useProjectionStore()

    projectionStore.setInputs({
      monthlyIncome: 6000,
      monthlyExpenses: 3500,
      months: 18,
      expenseItems: [],
    })

    const scenario = projectionStore.saveScenario('Stretch plan')

    expect(projectionStore.savedScenarios).toHaveLength(1)
    expect(projectionStore.activeScenarioId).toBe(scenario.id)

    projectionStore.setInputs({
      monthlyIncome: 4200,
      monthlyExpenses: 2800,
      months: 12,
      expenseItems: [],
    })
    projectionStore.loadScenario(scenario.id)

    expect(projectionStore.inputs).toEqual({
      monthlyIncome: 6000,
      monthlyExpenses: 3500,
      months: 18,
      expenseItems: [],
      monthlyAdjustments: [],
    })

    projectionStore.deleteScenario(scenario.id)
    expect(projectionStore.savedScenarios).toEqual([])
    expect(projectionStore.activeScenarioId).toBeNull()
  })

  it('exports and imports scenario payloads', () => {
    const projectionStore = useProjectionStore()
    projectionStore.setInputs({
      monthlyIncome: 5300,
      monthlyExpenses: 3100,
      months: 10,
      expenseItems: [],
    })

    projectionStore.saveScenario('Imported later')
    const exported = projectionStore.exportScenarios()

    setActivePinia(createPinia())
    const anotherStore = useProjectionStore()
    const importedCount = anotherStore.importScenarios(exported)

    expect(importedCount).toBe(1)
    expect(anotherStore.savedScenarios[0]?.name).toBe('Imported later')
  })

  it('renames and overwrites the active scenario', () => {
    const projectionStore = useProjectionStore()
    projectionStore.setInputs({
      monthlyIncome: 4000,
      monthlyExpenses: 2600,
      months: 12,
      expenseItems: [],
    })

    const scenario = projectionStore.saveScenario('Base plan')

    projectionStore.setInputs({
      monthlyIncome: 4700,
      monthlyExpenses: 2800,
      months: 18,
      expenseItems: [],
    })

    expect(projectionStore.overwriteActiveScenario('Growth plan')).toBe(true)
    expect(projectionStore.savedScenarios[0]?.name).toBe('Growth plan')
    expect(projectionStore.savedScenarios[0]?.inputs).toEqual({
      monthlyIncome: 4700,
      monthlyExpenses: 2800,
      months: 18,
      expenseItems: [],
      monthlyAdjustments: [],
    })

    expect(projectionStore.renameScenario(scenario.id, 'Travel year')).toBe(true)
    expect(projectionStore.savedScenarios[0]?.name).toBe('Travel year')
  })

  it('skips exact duplicate imports and renames name collisions', () => {
    const projectionStore = useProjectionStore()
    projectionStore.setInputs({
      monthlyIncome: 4100,
      monthlyExpenses: 2600,
      months: 12,
      expenseItems: [],
    })
    projectionStore.saveScenario('Baseline plan')

    const importedCount = projectionStore.importScenarios(
      JSON.stringify({
        version: 1,
        exportedAt: '2026-03-27T00:00:00.000Z',
        scenarios: [
          {
            id: 'scenario-duplicate-values',
            name: 'Baseline plan',
            updatedAt: '2026-03-27T00:00:00.000Z',
            inputs: {
              monthlyIncome: 4100,
              monthlyExpenses: 2600,
              months: 12,
            },
          },
          {
            id: 'scenario-different-values',
            name: 'Baseline plan',
            updatedAt: '2026-03-27T00:00:00.000Z',
            inputs: {
              monthlyIncome: 5000,
              monthlyExpenses: 2700,
              months: 18,
            },
          },
        ],
      }),
    )

    expect(importedCount).toBe(1)
    expect(projectionStore.savedScenarios[0]?.name).toBe('Baseline plan (Imported)')
  })
})
