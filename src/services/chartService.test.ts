import { labelStride, linePath, niceScale } from './chartService'

describe('niceScale', () => {
  it('lands on round numbers and includes zero', () => {
    const scale = niceScale([1200, 4800, 9300])
    expect(scale.min).toBe(0)
    expect(scale.max).toBe(10000)
    expect(scale.ticks).toEqual([0, 2500, 5000, 7500, 10000])
  })

  it('extends below zero for negative values', () => {
    const scale = niceScale([-1800, 600, 3200])
    expect(scale.min).toBeLessThanOrEqual(-1800)
    expect(scale.max).toBeGreaterThanOrEqual(3200)
    expect(scale.ticks).toContain(0)
  })

  it('copes with a flat series', () => {
    const scale = niceScale([0, 0, 0])
    expect(scale.max).toBeGreaterThan(scale.min)
    expect(scale.ticks.length).toBeGreaterThan(1)
  })

  it('produces evenly spaced ticks without floating point noise', () => {
    const { ticks } = niceScale([0.1, 0.7])
    ticks.forEach((t) => expect(String(t).length).toBeLessThan(8))
  })
})

describe('labelStride', () => {
  it('labels every point when there is room', () => {
    expect(labelStride(6, 600)).toBe(1)
  })

  it('skips labels when they would collide', () => {
    expect(labelStride(60, 440)).toBe(6)
  })
})

describe('linePath', () => {
  it('builds a move followed by lines', () => {
    expect(linePath([{ x: 0, y: 10 }, { x: 5, y: 2.5 }])).toBe('M 0.00 10.00 L 5.00 2.50')
  })

  it('is empty for no points', () => {
    expect(linePath([])).toBe('')
  })
})
