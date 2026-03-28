import type { AnyObjectSchema, InferType } from 'yup'

import {
  buildErrorMap,
  projectionSchema,
} from '@/validation/forms'

interface ValidationResult<T> {
  data: T | null
  errors: Record<string, string>
}

export const useFormSchemas = () => {
  const validate = async <TSchema extends AnyObjectSchema>(
    schema: TSchema,
    value: unknown,
  ): Promise<ValidationResult<InferType<TSchema>>> => {
    try {
      const data = await schema.validate(value, {
        abortEarly: false,
        stripUnknown: true,
      })

      return {
        data,
        errors: {},
      }
    } catch (error) {
      return {
        data: null,
        errors: buildErrorMap(error),
      }
    }
  }

  return {
    schemas: {
      projection: projectionSchema,
    },
    validate,
  }
}
