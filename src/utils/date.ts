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
