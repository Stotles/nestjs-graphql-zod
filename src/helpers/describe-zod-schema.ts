import type { ZodType } from 'zod'

import { getDescription } from './get-description'

/**
 * Builds a short ` for zod schema '<label>'` suffix for error messages, or an
 * empty string when no human-readable identifier is available. The explicit
 * name from options takes precedence over the schema's own description.
 */
export function describeZodSchema(input: ZodType, explicitName?: string): string {
  const label = explicitName ?? getDescription(input)
  return label ? ` for zod schema '${label}'` : ''
}
