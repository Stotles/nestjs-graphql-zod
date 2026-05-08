import type { ZodType } from 'zod'
import type { Type } from '@nestjs/common'

/**
 * Checks whether the given `input` is an instance of the given `klass`.
 *
 * Uses `instanceof` first (the reliable path when both sides come from the
 * same zod module). Falls back to a constructor-name comparison so the
 * check still succeeds when two copies of zod are loaded into one process
 * — for example a CJS `zod/index.js` pulled in by one dependency and an
 * ESM `zod/index.mjs` pulled in by another. The two copies expose
 * structurally identical classes but distinct prototype chains, and a
 * straight `instanceof` would report `false` for what is, semantically,
 * the same type.
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
  if (input instanceof klass) return true
  return input?.constructor?.name === klass.name
}
