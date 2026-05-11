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
  ZodType,
  ZodUnion,
} from 'zod'

import { isZodInstance } from './is-zod-instance'
import { toTitleCase } from './to-title-case'

/**
 * Builds the corresponding zod type name.
 *
 * @export
 * @param {ZodType} instance The zod type instance.
 * @return {string} A built type name for the input.
 *
 * @__PURE__
 */
export function getZodObjectName(instance: ZodType): string {
  if (isZodInstance(ZodArray, instance)) {
    const innerName = getZodObjectName(instance.element as ZodType)
    return `Array<${innerName}>`
  }

  if (isZodInstance(ZodOptional, instance)) {
    const innerName = getZodObjectName(instance.unwrap() as ZodType)
    return `Optional<${innerName}>`
  }

  if (isZodInstance(ZodNonOptional, instance)) {
    // `.nonoptional()` does not collapse a wrapped `ZodOptional`; peel both so
    // `z.string().optional().nonoptional()` resolves to `String` rather than `Optional<String>`.
    const inner = instance.unwrap() as ZodType
    const target = isZodInstance(ZodOptional, inner) ? inner.unwrap() as ZodType : inner
    return getZodObjectName(target)
  }

  if (isZodInstance(ZodPipe, instance)) {
    return getZodObjectName(instance._def.in as ZodType)
  }
  if (isZodInstance(ZodLazy, instance)) {
    return getZodObjectName(instance._def.getter() as ZodType)
  }

  if (isZodInstance(ZodDefault, instance)) {
    return getZodObjectName(instance._def.innerType as ZodType)
  }
  if (isZodInstance(ZodReadonly, instance)) {
    return getZodObjectName(instance._def.innerType as ZodType)
  }
  if (isZodInstance(ZodPrefault, instance)) {
    return getZodObjectName(instance._def.innerType as ZodType)
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
    const keyName = getZodObjectName(instance._def.keyType as ZodType)
    const valueName = getZodObjectName(instance._def.valueType as ZodType)
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
    return (instance.options as ZodType[]).map(o => getZodObjectName(o)).join(' | ')
  }

  if (isZodInstance(ZodNullable, instance)) {
    const innerName = getZodObjectName(instance._def.innerType as ZodType)
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
