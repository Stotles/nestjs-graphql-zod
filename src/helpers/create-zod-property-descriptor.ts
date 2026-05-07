import {
  output,
  ZodType,
} from 'zod'

import { findInnerDefault } from './unwrap'

import type { IModelFromZodOptions } from '../model-from-zod'

/**
 * Creates a property descriptor that provides `get` and `set` functions
 * that are using `parse` or `safeParse` methods of the `zod` library.
 *
 * @export
 * @template T The type of the target object.
 * @param {keyof T} key The key of the property that is being created.
 * @param {ZodType} input The zod object input.
 * @param {IModelFromZodOptions<T>} opts The options.
 * @return {PropertyDescriptor} A {@link PropertyDescriptor}.
 */
export function createZodPropertyDescriptor<T extends ZodType>(
  key: string | keyof output<T>,
  input: ZodType,
  opts: IModelFromZodOptions<T>
): PropertyDescriptor {
  let localVariable: any

  // Walk through wrappers (Optional/Nullable/Readonly/Catch/...) to find a
  // ZodDefault or ZodPrefault anywhere inside the schema, so the seed value
  // matches what zod's parser would produce on undefined input.
  const defaulted = findInnerDefault(input)
  if (defaulted) {
    localVariable = defaulted._def.defaultValue
  }

  const {
    safe,
    doNotThrow,

    onParsing,
    onParseError,
  } = opts

  let keyProps: Record<string, unknown> | undefined
  if (typeof onParsing === 'function') {
    keyProps = onParsing(key as keyof output<T>, localVariable)
  }

  return {
    get() {
      return localVariable
    },
    set(newValue) {
      if (safe) {
        const result = input.safeParse(newValue, keyProps)
        if (result.success) {
          localVariable = result.data
        }
        else {
          let replaceValue: typeof localVariable

          if (typeof onParseError === 'function') {
            replaceValue = onParseError(
              key as keyof output<T>,
              newValue,
              localVariable,
              result.error
            )
          }

          if (typeof replaceValue !== 'undefined') {
            localVariable = replaceValue
          }
          else if (doNotThrow) {
            localVariable = undefined
          }
          else {
            throw result.error
          }
        }
      }
      else {
        if (doNotThrow) {
          try {
            const result = input.parse(newValue, keyProps)
            localVariable = result
          }
          catch (_) {
            localVariable = undefined
          }
        }
        else {
          const result = input.parse(newValue, keyProps)
          localVariable = result
        }
      }
    }
  }
}
