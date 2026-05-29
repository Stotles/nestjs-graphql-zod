import { globalRegistry, safeParse, type $ZodType } from 'zod/v4/core'

/**
 * Reads a schema's metadata from zod's `globalRegistry`. This is the variant-agnostic equivalent of
 * classic zod's `.meta()` method — classic, mini, and bare core schemas all share this registry.
 */
export function getZodMeta(schema: $ZodType) {
  return globalRegistry.get(schema)
}

/**
 * Reads a schema's `description` metadata. Equivalent to classic zod's `schema.description`
 * accessor, which itself reads from `globalRegistry`.
 */
export function getZodDescription(schema: $ZodType): string | undefined {
  return globalRegistry.get(schema)?.description
}

// `safeParse` despite its name can throw if the schema contains `.transform()`
// or `.preprocess()` that throw on inputs they can't handle. In those cases, we
// just assume it can't handle `undefined`/`null` and return false since it will
// be a mistake to throw in that scenario. While there is a small risk of masking
// a real error from zod, this is something we accept since ZodError shouldn't be
// ever returned here.
export function isOptionalSchema(schema: $ZodType): boolean {
  try {
    return safeParse(schema, undefined).success
  } catch {
    return false
  }
}

export function isNullableSchema(schema: $ZodType): boolean {
  try {
    return safeParse(schema, null).success
  } catch {
    return false
  }
}
