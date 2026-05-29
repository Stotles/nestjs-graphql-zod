import {
  $ZodAny,
  $ZodArray,
  $ZodBigInt,
  $ZodBoolean,
  $ZodDate,
  $ZodDefault,
  $ZodEnum,
  $ZodLazy,
  $ZodLiteral,
  $ZodNonOptional,
  $ZodNull,
  $ZodNullable,
  $ZodNumber,
  $ZodObject,
  $ZodOptional,
  $ZodPipe,
  $ZodPrefault,
  $ZodReadonly,
  $ZodRecord,
  $ZodString,
  $ZodStringFormat,
  $ZodTransform,
  $ZodType,
  $ZodUnion,
} from 'zod/v4/core'

import { MAX_ZOD_DEPTH } from './constants'
import { isZodInstance } from './is-zod-instance'
import { toTitleCase } from './to-title-case'
import { getZodDescription } from './zod-core-meta'

/**
 * Which side of a transforming zod schema to inspect when mapping to a GraphQL type. `'input'`
 * walks toward the value a client sends; `'output'` walks toward the value the schema produces.
 */
export type Direction = 'input' | 'output'

/**
 * Builds the corresponding zod type name.
 *
 * Detects `$ZodLazy` cycles and resolves them to `'Unknown'`; throws if a cycle is encountered
 * which cannot be handled.
 *
 * @param {$ZodType} instance The zod type instance.
 * @param {Direction} direction Whether to resolve the input (client-sent) or output
 *   (server-produced) side of transforming schemas like `$ZodPipe`.
 * @returns {string} A built type name for the input.
 * @export
 * @__PURE__
 */
export function getZodObjectName(instance: $ZodType, direction: Direction): string {
  return getZodObjectNameInner(instance, direction, new Set(), 0)
}

/**
 * Internal implementation of `getZodObjectName`, the wrapper is required to support cycle detection
 * without exposing the additional parameters on the public API.
 */
function getZodObjectNameInner(
  instance: $ZodType,
  direction: Direction,
  visited: Set<$ZodType>,
  depth: number,
): string {
  if (depth >= MAX_ZOD_DEPTH) {
    throw new Error(
      `getZodObjectName exceeded MAX_ZOD_DEPTH (${MAX_ZOD_DEPTH}). This usually ` +
        `indicates a ZodLazy getter that manufactures a fresh schema on each call, ` +
        `preventing identity-based cycle detection.`,
    )
  }
  const next = depth + 1

  if (isZodInstance($ZodArray, instance)) {
    const innerName = getZodObjectNameInner(instance._zod.def.element, direction, visited, next)
    return `Array<${innerName}>`
  }

  if (isZodInstance($ZodOptional, instance)) {
    const innerName = getZodObjectNameInner(instance._zod.def.innerType, direction, visited, next)
    return `Optional<${innerName}>`
  }

  if (isZodInstance($ZodNonOptional, instance)) {
    // `.nonoptional()` does not collapse a wrapped `$ZodOptional`; peel both so
    // `z.string().optional().nonoptional()` resolves to `String` rather than `Optional<String>`.
    const inner = instance._zod.def.innerType
    const target = isZodInstance($ZodOptional, inner) ? inner._zod.def.innerType : inner
    return getZodObjectNameInner(target, direction, visited, next)
  }

  if (isZodInstance($ZodPipe, instance)) {
    return getZodObjectNameInner(resolvePipeTarget(instance, direction), direction, visited, next)
  }
  if (isZodInstance($ZodLazy, instance)) {
    // `visited` is path-tracked, not history-tracked: we remove the entry on
    // the way out so a non-cyclic shared lazy referenced twice in sibling
    // positions (e.g. `z.union([shared, shared])`) still resolves on both
    // visits. Only a lazy that appears on the *current* recursion path is
    // treated as a cycle.
    if (visited.has(instance)) return 'Unknown'
    visited.add(instance)
    try {
      return getZodObjectNameInner(instance._zod.def.getter(), direction, visited, next)
    } finally {
      visited.delete(instance)
    }
  }

  if (isZodInstance($ZodDefault, instance)) {
    return getZodObjectNameInner(instance._zod.def.innerType, direction, visited, next)
  }
  if (isZodInstance($ZodReadonly, instance)) {
    return getZodObjectNameInner(instance._zod.def.innerType, direction, visited, next)
  }
  if (isZodInstance($ZodPrefault, instance)) {
    return getZodObjectNameInner(instance._zod.def.innerType, direction, visited, next)
  }

  if (isZodInstance($ZodEnum, instance)) {
    const description = getZodDescription(instance) ?? ''
    const nameSeparatorIndex = description.indexOf(':')

    if (nameSeparatorIndex > 0) {
      const name = description.slice(0, nameSeparatorIndex)
      return `Enum<${name}>`
    } else {
      const values = Object.values(instance._zod.def.entries)
      const name = values.join(',')
      return `Enum<${name}>`
    }
  }

  if (isZodInstance($ZodObject, instance)) {
    const description = getZodDescription(instance) ?? ''
    const nameSeparatorIndex = description.indexOf(':')

    if (nameSeparatorIndex > 0) {
      const name = description.slice(0, nameSeparatorIndex)
      return name
    } else {
      return `Object`
    }
  }

  if (isZodInstance($ZodRecord, instance)) {
    const keyName = getZodObjectNameInner(instance._zod.def.keyType, direction, visited, next)
    const valueName = getZodObjectNameInner(instance._zod.def.valueType, direction, visited, next)
    return `Record<${keyName}, ${valueName}>`
  }

  if (isZodInstance($ZodLiteral, instance)) {
    // `$ZodLiteralDef.values` is an array (multi-literal schemas like
    // `z.literal([a, b])` are possible); the library has historically treated
    // literals as single-valued, so read the first entry to preserve behavior.
    const value = instance._zod.def.values[0]
    if (typeof value === 'object') {
      if (value === null) return `Literal<Null>`
      let constructor: any
      if ('prototype' in value) {
        const prototype = (value as any)['prototype']
        if (typeof prototype === 'object' && prototype && 'constructor' in prototype) {
          constructor = prototype['constructor']
        }
      } else if ('constructor' in value) {
        constructor = (value as any)['constructor']
      }

      if (typeof constructor === 'function') {
        return `Literal<${constructor.name}>`
      }
    }

    return `Literal<${toTitleCase(typeof value)}>`
  }

  if (isZodInstance($ZodUnion, instance)) {
    return instance._zod.def.options
      .map((o) => getZodObjectNameInner(o, direction, visited, next))
      .join(' | ')
  }

  if (isZodInstance($ZodNullable, instance)) {
    const innerName = getZodObjectNameInner(instance._zod.def.innerType, direction, visited, next)
    return `Nullable<${innerName}>`
  }

  if (isZodInstance($ZodBoolean, instance)) return 'Boolean'
  if (isZodInstance($ZodString, instance)) return 'String'
  // Zod v4 string-format types (uuid, email, url, base64, cuid, cuid2,
  // ulid, nanoid, jwt, ipv4/v6, cidrv4/v6, iso.date/time/datetime/duration,
  // emoji, e164, ksuid, mac, xid, base64url, guid) all map to GraphQL String.
  if (isZodInstance($ZodStringFormat, instance)) return 'String'
  if (isZodInstance($ZodNumber, instance)) return 'Number'
  if (isZodInstance($ZodBigInt, instance)) return 'BigInt'
  if (isZodInstance($ZodDate, instance)) return 'Date'
  if (isZodInstance($ZodAny, instance)) return 'Any'
  if (isZodInstance($ZodNull, instance)) return 'Null'
  return 'Unknown'
}

/**
 * Picks the side of a `$ZodPipe` to inspect when mapping it to a GraphQL type.
 *
 * A `$ZodPipe` has an `in` and `out` schema; either side can be a `$ZodTransform` whose type is
 * opaque (just a function — at runtime the function's parameter and return types are erased, and
 * `$ZodTransform` carries no schema for them). Examples of pipe shapes: `z.string().transform(fn)`
 * => in=$ZodString, out=$ZodTransform `z.preprocess(fn, z.enum([...]))` => in=$ZodTransform,
 * out=$ZodEnum `.transform(fn).pipe(z.number())` => in=$ZodPipe(...), out=$ZodNumber
 *
 * `'input'` picks `in` (what the client sends); `'output'` picks `out` (what the schema produces).
 * If the preferred side is a `$ZodTransform`, the type is not expressible from the schema, so we
 * throw rather than silently guess — the developer should use `.pipe(z.X)` to declare the type
 * explicitly.
 */
export function resolvePipeTarget(pipe: $ZodPipe, direction: Direction, key?: string): $ZodType {
  const target = direction === 'input' ? pipe._zod.def.in : pipe._zod.def.out
  if (isZodInstance($ZodTransform, target)) {
    throw new Error(
      `Cannot determine GraphQL type${key ? ` for field '${key}'` : ''}: ` +
        `the ${direction} side of this ZodPipe is a ZodTransform, whose type is opaque at runtime. ` +
        `Use \`.pipe(z.X)\` to declare the type explicitly.`,
    )
  }
  return target
}
