import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'

interface Schemas {
  body?: ZodType
  query?: ZodType
  params?: ZodType
}

/**
 * Validates req.body / req.query / req.params with zod. On success the parsed value replaces the original,
 * so fields that are not in the schema are dropped (no mass assignment) and numbers/dates are already typed.
 * On failure answers 400 with the first problem in `message` and every problem in `errors`.
 */
export function validate(schemas: Schemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: { field: string; message: string }[] = []
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part]
      if (!schema) continue
      const result = schema.safeParse(req[part] ?? {})
      if (result.success) {
        if (part === 'body') req.body = result.data
        else Object.assign(req[part], result.data)
      } else {
        for (const issue of result.error.issues) {
          const field = issue.path.join('.') || part
          errors.push({ field, message: issue.message })
        }
      }
    }
    if (errors.length) {
      const first = errors[0]
      res.status(400).json({ message: first.field === 'body' ? first.message : `${first.field}: ${first.message}`, errors })
      return
    }
    next()
  }
}
