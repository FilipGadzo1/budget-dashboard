import * as yup from 'yup'

export const projectionSchema = yup.object({
  monthlyIncome: yup
    .number()
    .transform((value, originalValue) => (originalValue === '' ? Number.NaN : value))
    .typeError('Monthly income is required')
    .required('Monthly income is required')
    .min(0, 'Monthly income cannot be negative')
    .max(1_000_000_000, 'Monthly income cannot exceed 1 billion'),
  monthlyExpenses: yup
    .number()
    .transform((value, originalValue) => (originalValue === '' ? Number.NaN : value))
    .typeError('Monthly expenses are required')
    .required('Monthly expenses are required')
    .min(0, 'Monthly expenses cannot be negative')
    .max(1_000_000_000, 'Monthly expenses cannot exceed 1 billion'),
  months: yup
    .number()
    .transform((value, originalValue) => (originalValue === '' ? Number.NaN : value))
    .typeError('Projection length is required')
    .required('Projection length is required')
    .integer('Projection length must be a whole number')
    .min(1, 'Projection length must be at least 1 month')
    .max(60, 'Projection length must be 60 months or less'),
})

export const buildErrorMap = (error: unknown): Record<string, string> => {
  if (!(error instanceof yup.ValidationError)) {
    return {}
  }

  return error.inner.reduce<Record<string, string>>((accumulator, issue) => {
    if (issue.path && !accumulator[issue.path]) {
      accumulator[issue.path] = issue.message
    }
    return accumulator
  }, {})
}
