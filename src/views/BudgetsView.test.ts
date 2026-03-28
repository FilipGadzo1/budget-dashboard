// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'

import { useProjectionStore } from '@/stores/projection'
import { useUiStore } from '@/stores/ui'

import BudgetsView from './BudgetsView.vue'

const InputNumberStub = defineComponent({
  name: 'InputNumber',
  props: {
    modelValue: {
      type: Number,
      default: 0,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        value: props.modelValue,
        onInput: (event: Event) => {
          const target = event.target as HTMLInputElement
          emit('update:modelValue', Number(target.value))
        },
      })
  },
})

const InputTextStub = defineComponent({
  name: 'InputText',
  props: {
    modelValue: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        value: props.modelValue,
        onInput: (event: Event) => {
          const target = event.target as HTMLInputElement
          emit('update:modelValue', target.value)
        },
      })
  },
})

describe('BudgetsView', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setActivePinia(createPinia())
  })

  it('renders an overview-first layout with the main planning signals', () => {
    const projectionStore = useProjectionStore()
    const uiStore = useUiStore()

    projectionStore.setInputs({
      monthlyIncome: 2000,
      monthlyExpenses: 2600,
      months: 36,
    })
    uiStore.setSelectedMonth('2026-01')

    const wrapper = mount(BudgetsView, {
      global: {
        stubs: {
          InputNumber: InputNumberStub,
          InputText: InputTextStub,
        },
      },
    })

    expect(wrapper.text()).toContain('Total income')
    expect(wrapper.text()).toContain('Ending balance')
    expect(wrapper.text()).toContain('Monthly deficit detected')
    expect(wrapper.text()).toContain('Closing the gap needs')
    expect(wrapper.text()).toContain('Open details')
    expect(wrapper.text()).toContain('Manage saved plans')
    expect(wrapper.text()).toContain('First negative month')
    expect(wrapper.text()).toContain('Peak balance month')
    expect(wrapper.text()).toContain('Peak balance')
    expect(wrapper.text()).toContain('Trend preview')
    expect(wrapper.text()).not.toContain('Portable summary')
    expect(wrapper.text()).not.toContain('Save the current plan to start comparing multiple budgeting scenarios.')
  })

  it('opens the saved plans section when selected', async () => {
    const projectionStore = useProjectionStore()
    projectionStore.setInputs({
      monthlyIncome: 4800,
      monthlyExpenses: 2800,
      months: 12,
    })
    projectionStore.saveScenario('Base case')

    const wrapper = mount(BudgetsView, {
      global: {
        stubs: {
          InputNumber: InputNumberStub,
          InputText: InputTextStub,
        },
      },
    })

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Saved plans')
      ?.trigger('click')

    expect(wrapper.text()).toContain('Base case')
    expect(wrapper.text()).toContain('Load')
    expect(wrapper.text()).toContain('Rename')
    expect(wrapper.text()).toContain('Overwrite active')
  })

  it('opens the details section on demand', async () => {
    const wrapper = mount(BudgetsView, {
      global: {
        stubs: {
          InputNumber: InputNumberStub,
          InputText: InputTextStub,
        },
      },
    })

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Details')
      ?.trigger('click')

    expect(wrapper.text()).toContain('Portable summary')
    expect(wrapper.text()).toContain('Copy summary')
    expect(wrapper.text()).toContain('Show monthly table')
    expect(wrapper.text()).toContain('Budget Projection Snapshot')
  })
})
