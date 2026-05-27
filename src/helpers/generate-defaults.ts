import {
  ZodCatch,
  ZodDefault,
  ZodLazy,
  ZodNullable,
  ZodObject,
  ZodOptional,
  ZodPrefault,
  ZodReadonly,
  ZodType,
} from 'zod'

import { MAX_ZOD_DEPTH } from './constants'
import { isZodInstance } from './is-zod-instance'

/**
 * Finds the default value attached to a `ZodDefault` or `ZodPrefault`
 * nested inside any combination of identity-preserving wrappers
 * (`ZodOptional`, `ZodNullable`, `ZodReadonly`, `ZodCatch`, `ZodLazy`).
 *
 * Structural wrappers (`ZodArray`, `ZodSet`, `ZodPromise`, `ZodPipe`) are
 * intentionally not traversed because the inner schema's default does not
 * apply to the outer schema (e.g. `z.array(z.string().default('x'))` —
 * `'x'` is the element default, not the array default).
 *
 * Has a hard cap of {@link MAX_ZOD_DEPTH} on number of wrappers it will
 * traverse before throwing an error to prevent infinite loops, but it
 * will try detecting cycles and exit early if this occurs.
 */
export function getZodDefaultValue(input: ZodType): unknown {
  // We need to track which nodes have been visited since there can be cycles
  // in the schema graph due to `ZodLazy`.
  // There is also a hard cap on depth to prevent infinite loops that can't be
  // detected via identity (e.g. a `ZodLazy.getter()` that manufactures a fresh
  // schema on each call).
  const visited = new Set<ZodType>()
  let current: ZodType = input
  for (let depth = 0; depth < MAX_ZOD_DEPTH; depth++) {
    if (visited.has(current)) {
      // Since it's a loop, there isn't a default value as one should have been discovered by now if there was one
      return undefined
    }
    visited.add(current)
    
    if (isZodInstance(ZodDefault, current))  return current._def.defaultValue
    if (isZodInstance(ZodPrefault, current)) return current._def.defaultValue

    if (isZodInstance(ZodReadonly, current))      current = current._def.innerType as ZodType
    else if (isZodInstance(ZodOptional, current)) current = current.unwrap() as ZodType
    else if (isZodInstance(ZodNullable, current)) current = current.unwrap() as ZodType
    else if (isZodInstance(ZodCatch, current))    current = current._def.innerType as ZodType
    else if (isZodInstance(ZodLazy, current))     current = current._def.getter() as ZodType
    else return undefined
  }
  throw new Error(
    `getZodDefaultValue exceeded MAX_ZOD_DEPTH (${MAX_ZOD_DEPTH}). This usually `
    + `indicates a ZodLazy getter that manufactures a fresh schema on each call, `
    + `preventing identity-based cycle detection.`
  )
}

/**
 * Generates the default values for given object.
 *
 * @param {ZodObject} input The input.
 * @return {Record<string, ZodType>} A record of default values.
 */
function generateDefaultsForObject(input: ZodObject) {
  return Object.keys(input.shape).reduce<Record<string, any>>((curr, key) => {
    const res = generateDefaults<ZodType>(input.shape[ key ])
    if (res !== undefined) {
      curr[ key ] = res
    }

    return curr
  }, {})
}

/**
 * Generates the default vales for given input.
 *
 * @export
 * @template T The type of the input.
 * @param {T} input The input.
 * @return {*} A record containing keys and the zod
 * values with defaults.
 */
export function generateDefaults<T extends ZodType>(input: T) {
  if (isZodInstance(ZodObject, input)) {
    return generateDefaultsForObject(input)
  }
  return getZodDefaultValue(input)
}
