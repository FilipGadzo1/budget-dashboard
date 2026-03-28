// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import { useLocalStorageSync } from './useLocalStorageSync'

describe('useLocalStorageSync', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns the seed value when nothing is stored', () => {
    const sync = useLocalStorageSync('budget:test:missing', { count: 1 })

    expect(sync.read()).toEqual({ count: 1 })
  })

  it('writes data with a versioned envelope', () => {
    const sync = useLocalStorageSync('budget:test:write', { count: 0 }, 2)

    sync.write({ count: 7 })

    expect(window.localStorage.getItem('budget:test:write')).toBe(
      JSON.stringify({
        version: 2,
        data: { count: 7 },
      }),
    )
  })

  it('falls back to the seed value when the stored version does not match', () => {
    window.localStorage.setItem(
      'budget:test:version',
      JSON.stringify({
        version: 1,
        data: { count: 99 },
      }),
    )

    const sync = useLocalStorageSync('budget:test:version', { count: 3 }, 2)

    expect(sync.read()).toEqual({ count: 3 })
  })
})
