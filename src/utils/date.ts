export const formatMonthKey = (value: Date): string => {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')

  return `${year}-${month}`
}

export const monthKeyToDate = (value: string): Date => {
  const [year, month] = value.split('-').map(Number)

  return new Date(year, (month ?? 1) - 1, 1)
}

export const isoDateToDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number)

  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export const dateToIsoDate = (value: Date): string => {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

export const getMonthStart = (monthKey: string): string => `${monthKey}-01`

export const getMonthEnd = (monthKey: string): string => {
  const monthDate = monthKeyToDate(monthKey)
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)

  return dateToIsoDate(lastDay)
}

export const formatDisplayDate = (value: string, locale = 'en-US'): string =>
  isoDateToDate(value).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

export const formatDisplayMonth = (monthKey: string, locale = 'en-US'): string =>
  monthKeyToDate(monthKey).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  })
