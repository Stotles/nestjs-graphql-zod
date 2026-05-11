import {
  ZodAny,
  ZodArray,
  ZodBigInt,
  ZodBoolean,
  ZodDate,
  ZodDefault,
  ZodEnum,
  ZodLazy,
  ZodLiteral,
  ZodNonOptional,
  ZodNull,
  ZodNullable,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodPipe,
  ZodPrefault,
  ZodReadonly,
  ZodRecord,
  ZodString,
  ZodStringFormat,
  ZodTransform,
  ZodType,
  ZodUnion,
} from 'zod'

import { isZodInstance } from './is-zod-instance'
import { toTitleCase } from './to-title-case'

/**
 * Which side of a transforming zod schema to inspect when mapping to a GraphQL
 * type. `'input'` walks toward the value a client sends; `'output'` walks
 * toward the value the schema produces.
 */
export type Direction = 'input' | 'output'

/**
 * Builds the corresponding zod type name.
 *
 * @export
 * @param {ZodType} instance The zod type instance.
 * @param {Direction} direction Whether to resolve the input (client-sent) or output (server-produced) side of transforming schemas like `ZodPipe`.
 * @return {string} A built type name for the input.
 *
 * @__PURE__
 */
export function getZodObjectName(instance: ZodType, direction: Direction): string {
  if (isZodInstance(ZodArray, instance)) {
    const innerName = getZodObjectName(instance.element as ZodType, direction)
    return `Array<${innerName}>`
  }

  if (isZodInstance(ZodOptional, instance)) {
    const innerName = getZodObjectName(instance.unwrap() as ZodType, direction)
    return `Optional<${innerName}>`
  }

  if (isZodInstance(ZodNonOptional, instance)) {
    // `.nonoptional()` does not collapse a wrapped `ZodOptional`; peel both so
    // `z.string().optional().nonoptional()` resolves to `String` rather than `Optional<String>`.
    const inner = instance.unwrap() as ZodType
    const target = isZodInstance(ZodOptional, inner) ? inner.unwrap() as ZodType : inner
    return getZodObjectName(target, direction)
  }

  if (isZodInstance(ZodPipe, instance)) {
    return getZodObjectName(resolvePipeTarget(instance, direction), direction)
  }
  if (isZodInstance(ZodLazy, instance)) {
    return getZodObjectName(instance._def.getter() as ZodType, direction)
  }

  if (isZodInstance(ZodDefault, instance)) {
    return getZodObjectName(instance._def.innerType as ZodType, direction)
  }
  if (isZodInstance(ZodReadonly, instance)) {
    return getZodObjectName(instance._def.innerType as ZodType, direction)
  }
  if (isZodInstance(ZodPrefault, instance)) {
    return getZodObjectName(instance._def.innerType as ZodType, direction)
  }

  if (isZodInstance(ZodEnum, instance)) {
    const { description = '' } = instance
    const nameSeparatorIndex = description.indexOf(':')

    if (nameSeparatorIndex > 0) {
      const name = description.slice(0, nameSeparatorIndex)
      return `Enum<${name}>`
    }
    else {
      const values = Object.values(instance.enum)
      const name = values.join(',')
      return `Enum<${name}>`
    }
  }

  if (isZodInstance(ZodObject, instance)) {
    const { description = '' } = instance
    const nameSeparatorIndex = description.indexOf(':')

    if (nameSeparatorIndex > 0) {
      const name = description.slice(0, nameSeparatorIndex)
      return name
    }
    else {
      return `Object`
    }
  }

  if (isZodInstance(ZodRecord, instance)) {
    const keyName = getZodObjectName(instance._def.keyType as ZodType, direction)
    const valueName = getZodObjectName(instance._def.valueType as ZodType, direction)
    return `Record<${keyName}, ${valueName}>`
  }

  if (isZodInstance(ZodLiteral, instance)) {
    const { value } = instance
    if (typeof value === 'object') {
      if (value === null) return `Literal<Null>`
      let constructor: any
      if ('prototype' in value) {
        const prototype = value[ 'prototype' ]
        if (typeof prototype === 'object' && prototype && ('constructor' in prototype)) {
          constructor = prototype[ 'constructor' ]
        }
      }
      else if ('constructor' in value) {
        constructor = value[ 'constructor' ]
      }

      if (typeof constructor === 'function') {
        return `Literal<${constructor.name}>`
      }
    }

    return `Literal<${toTitleCase(typeof instance.value)}>`
  }

  if (isZodInstance(ZodUnion, instance)) {
    return (instance.options as ZodType[]).map(o => getZodObjectName(o, direction)).join(' | ')
  }

  if (isZodInstance(ZodNullable, instance)) {
    const innerName = getZodObjectName(instance._def.innerType as ZodType, direction)
    return `Nullable<${innerName}>`
  }

  if (isZodInstance(ZodBoolean, instance)) return 'Boolean'
  if (isZodInstance(ZodString, instance)) return 'String'
  // Zod v4 string-format types (uuid, email, url, base64, cuid, cuid2,
  // ulid, nanoid, jwt, ipv4/v6, cidrv4/v6, iso.date/time/datetime/duration,
  // emoji, e164, ksuid, mac, xid, base64url, guid) all map to GraphQL String.
  if (isZodInstance(ZodStringFormat, instance)) return 'String'
  if (isZodInstance(ZodNumber, instance)) return 'Number'
  if (isZodInstance(ZodBigInt, instance)) return 'BigInt'
  if (isZodInstance(ZodDate, instance)) return 'Date'
  if (isZodInstance(ZodAny, instance)) return 'Any'
  if (isZodInstance(ZodNull, instance)) return 'Null'
  return 'Unknown'
}

/**
 * Picks the side of a `ZodPipe` to inspect when mapping it to a GraphQL type.
 *
 * A `ZodPipe` has an `in` and `out` schema; either side can be a `ZodTransform`
 * whose type is opaque (just a function — at runtime the function's parameter
 * and return types are erased, and `ZodTransform` carries no schema for them).
 * Examples of pipe shapes:
 *   `z.string().transform(fn)`        => in=ZodString,    out=ZodTransform
 *   `z.preprocess(fn, z.enum([...]))` => in=ZodTransform, out=ZodEnum
 *   `.transform(fn).pipe(z.number())` => in=ZodPipe(...), out=ZodNumber
 *
 * `'input'` picks `in` (what the client sends); `'output'` picks `out` (what
 * the schema produces). If the preferred side is a `ZodTransform`, the type
 * is not expressible from the schema, so we throw rather than silently guess —
 * the developer should use `.pipe(z.X)` to declare the type explicitly.
 */
export function resolvePipeTarget(pipe: ZodPipe, direction: Direction, key?: string): ZodType {
  const target = (direction === 'input' ? pipe._def.in : pipe._def.out) as ZodType
  if (isZodInstance(ZodTransform, target)) {
    throw new Error(
      `Cannot determine GraphQL type${key ? ` for field '${key}'` : ''}: `
      + `the ${direction} side of this ZodPipe is a ZodTransform, whose type is opaque at runtime. `
      + `Use \`.pipe(z.X)\` to declare the type explicitly.`
    )
  }
  return target
}
