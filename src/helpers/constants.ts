// A global variable tracking the registered classes count.
// This is used for providing unique class names.
let registerCount = 0

/**
 * A {@link Symbol} that is used for keeping the source zod object inside a model class built from
 * that source.
 */
export const ZodObjectKey = Symbol('[[DynamicZodModelSource]]')

/**
 * Hard cap on Zod schema recursion / wrapper-stack depth. There are cycle-detection mechanisms in
 * this package which should be able to detect simpler cycles and handle them gracefully, but this
 * cap is a last-resort safeguard to cleanly fail when cycle detection fails and to prevent JS OOM
 * errors which are hard to debug.
 *
 * Real-world schemas top out at single-digit wrapper depths and a few levels of nested objects, 128
 * should be more than sufficient headroom for even the most complex schemas.
 */
export const MAX_ZOD_DEPTH = 128

/**
 * Gets the total registered class count.
 *
 * @returns {number} The registered class count.
 * @export
 */
export function getRegisterCount(): number {
  return registerCount
}

/**
 * Gets the total registered class count after increases the global counter.
 *
 * @returns {number} The new registered class count.
 * @export
 */
export function getAndIncreaseRegisterCount(): number {
  return ++registerCount
}
