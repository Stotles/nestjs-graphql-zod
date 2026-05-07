import { ZodDefault, ZodObject, ZodPrefault, ZodType } from 'zod'

import { isZodInstance } from './is-zod-instance'
import { findInnerDefault } from './unwrap'

/**
 * Generates the default values for given object.
 *
 * @param {ZodObject} input The input.
 * @return {Record<string, ZodType>} A record of default values.
 */
function generateDefaultsForObject(input: ZodObject) {
  return Object.keys(input.shape).reduce((curr, key) => {
    const res = generateDefaults<ZodType>(input.shape[ key ] as ZodType)
    if (res !== undefined) {
      curr[ key ] = res
    }

    return curr
  }, {} as Record<string, any>)
}

/**
 * Generates the default vales for given input.
 *
 * Walks through wrapper schemas (e.g. `ZodOptional`, `ZodNullable`,
 * `ZodReadonly`, `ZodCatch`) so a {@link ZodDefault} or {@link ZodPrefault}
 * nested anywhere inside still surfaces its value.
 *
 * @export
 * @template T The type of the input.
 * @param {T} input The input.
 * @return {*} A record containing keys and the zod
 * values with defaults.
 */
export function generateDefaults<T extends ZodType>(input: T) {
  if (isZodInstance(ZodObject, input)) {
    return generateDefaultsForObject(input as ZodObject)
  }

  const defaulted = findInnerDefault(input)
  if (defaulted) return defaulted._def.defaultValue
}
