import type { ZodType } from 'zod'
import type { Type } from '@nestjs/common'

/**
 * Checks whether the given `input` is instance of given `zodClass`.
 *
 * @template T The class type.
 * @param {T} zodClass The zod class to test against.
 * @param {Object} input The value to check.
 * @returns {input is InstanceType<T>} `true` if `input` is an instance of `zodClass`, otherwise
 *   `false`.
 * @export
 */
export function isZodInstance<T extends Type<ZodType>>(
  zodClass: T,
  input: Object,
): input is InstanceType<T> {
  // zod v4 tags every schema instance with `_zod.traits` — a Set of class
  // names (concrete and abstract) the instance satisfies — and overrides
  // `Symbol.hasInstance` to check that Set rather than the prototype chain.
  // https://github.com/colinhacks/zod/blob/v4.0.1/packages/zod/src/v4/core/core.ts#L56-L61
  // Because trait names are plain strings, `instanceof` works across
  // module boundaries too (CJS/ESM split or multiple zod copies in the
  // dep tree). Therefore, no constructor-name fallback is needed.
  return input instanceof zodClass
}
