import { addMonthsToKey, monthsBetween } from './date'

describe('addMonthsToKey', () => {
  it('moves forward across a year boundary', () => {
    expect(addMonthsToKey('2026-11', 3)).toBe('2027-02')
    expect(addMonthsToKey('2026-01', 11)).toBe('2026-12')
    expect(addMonthsToKey('2026-01', 12)).toBe('2027-01')
  })

  it('moves backward and stays put for zero', () => {
    expect(addMonthsToKey('2026-01', -1)).toBe('2025-12')
    expect(addMonthsToKey('2026-06', 0)).toBe('2026-06')
  })
})

describe('monthsBetween', () => {
  it('counts whole months between two month keys', () => {
    expect(monthsBetween('2026-11', '2028-04')).toBe(17)
    expect(monthsBetween('2026-06', '2026-06')).toBe(0)
    expect(monthsBetween('2026-06', '2026-03')).toBe(-3)
  })

  it('is the inverse of addMonthsToKey', () => {
    expect(monthsBetween('2026-11', addMonthsToKey('2026-11', 41))).toBe(41)
  })
})
