// Pure geometry helpers for the dashboard chart. No DOM, no Vue.

export interface AxisScale {
  min: number
  max: number
  ticks: number[]
}

/**
 * A y-axis that covers `values`, always includes zero, and lands on round numbers
 * (1, 2, 2.5 or 5 × a power of ten) with roughly `targetTicks` gridlines.
 */
export function niceScale(values: number[], targetTicks = 4): AxisScale {
  const finite = values.filter((v) => Number.isFinite(v))
  let lo = Math.min(0, ...finite)
  let hi = Math.max(0, ...finite)
  if (lo === hi) hi = lo + 1

  const rawStep = (hi - lo) / Math.max(1, targetTicks)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const fraction = rawStep / magnitude
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10) * magnitude

  lo = Math.floor(lo / step) * step
  hi = Math.ceil(hi / step) * step

  const ticks: number[] = []
  // Index-based to avoid accumulating floating point error over many additions
  const count = Math.round((hi - lo) / step)
  for (let i = 0; i <= count; i++) ticks.push(Number((lo + i * step).toPrecision(12)))

  return { min: lo, max: hi, ticks }
}

/**
 * Which x positions get a label: every k-th, with k chosen so labels of
 * `labelWidth` px never touch across `plotWidth` px.
 */
export function labelStride(count: number, plotWidth: number, labelWidth = 44): number {
  if (count <= 0) return 1
  const fit = Math.max(1, Math.floor(plotWidth / labelWidth))
  return Math.max(1, Math.ceil(count / fit))
}

/** SVG path through the points, skipping none. Empty string for no points. */
export function linePath(points: Array<{ x: number; y: number }>): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
}
