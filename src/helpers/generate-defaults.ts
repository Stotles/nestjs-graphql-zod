import { ZodDefault, ZodObject, ZodType } from 'zod'

import { isZodInstance } from './is-zod-instance'

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
  else if (isZodInstance(ZodDefault, input)) {
    return input._def.defaultValue
  }
}
