export const monthKeyToDate = (value: string): Date => {
  const [year, month] = value.split('-').map(Number)

  return new Date(year, (month ?? 1) - 1, 1)
}

export const isoDateToDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number)

  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export const formatDisplayMonth = (monthKey: string, locale = 'en-US'): string =>
  monthKeyToDate(monthKey).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  })

const toMonthIndex = (monthKey: string): number => {
  const [year, month] = monthKey.split('-').map(Number)
  return year * 12 + (month ?? 1) - 1
}

/** The month key `count` months after `monthKey` (negative goes back). */
export const addMonthsToKey = (monthKey: string, count: number): string => {
  const index = toMonthIndex(monthKey) + count
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** Whole months from `fromKey` to `toKey` (0 when they are the same month). */
export const monthsBetween = (fromKey: string, toKey: string): number =>
  toMonthIndex(toKey) - toMonthIndex(fromKey)

export const formatShortMonth = (monthKey: string, locale = 'en-US'): string =>
  monthKeyToDate(monthKey).toLocaleDateString(locale, { month: 'short' })

export const formatShortMonthYear = (monthKey: string, locale = 'en-US'): string =>
  monthKeyToDate(monthKey).toLocaleDateString(locale, { month: 'short', year: 'numeric' })

/** "Nov ’26" — the shortest unambiguous month label. */
export const formatCompactMonthYear = (monthKey: string, locale = 'en-US'): string =>
  `${formatShortMonth(monthKey, locale)} ’${monthKey.slice(2, 4)}`
