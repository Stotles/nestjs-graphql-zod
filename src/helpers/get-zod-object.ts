import { ZodObjectKey } from './constants'

/**
 * Extracts the source zod object that is used for creating passed dynamic model class.
 *
 * @template T The type of the model class that is dynamically generated from a zod object.
 * @param {T} input The model class instance that is dynamically generated from a zod object.
 * @returns {any} The source zod object.
 * @export
 */
export function getZodObject<T extends Record<string | number | symbol, any>>(input: T) {
  return input[ZodObjectKey]
}
