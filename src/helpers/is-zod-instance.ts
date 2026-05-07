import type { ZodType } from 'zod'
import type { Type } from '@nestjs/common'

/**
 * Checks whether the given `input` is an instance of the given `klass` via
 * `instanceof`.
 *
 * Earlier versions of this helper compared `klass.name` against
 * `input.constructor.name` to avoid issues with multiple zod copies in the
 * tree, but that broke when bundlers minified class names. With zod v4 a
 * direct `instanceof` check is reliable and narrows correctly for callers.
 *
 * @export
 * @template T The class type.
 * @param {T} klass The zod class to test against.
 * @param {Object} input The value to check.
 * @return {input is InstanceType<T>} `true` if `input` is an instance of
 * `klass`.
 */
export function isZodInstance<T extends Type<ZodType>>(
  klass: T,
  input: Object
): input is InstanceType<T> {
  return input instanceof klass
}
