import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { buildEnumType } from '../../src/helpers/build-enum-type'

describe('buildEnumType', () => {
  it('should register a ZodEnum and return the enum object', () => {
    const schema = z.enum(['active', 'inactive'])
    const typeInfo = {
      type: schema,
      isOptional: false,
      isNullable: false,
      isEnum: true,
    }

    const result = buildEnumType('status', typeInfo, { name: 'User' })
    expect(result).toStrictEqual({ active: 'active', inactive: 'inactive' })
  })

  it('should register a nativeEnum (now ZodEnum in v4)', () => {
    enum Status { Active = 'active', Inactive = 'inactive' }
    const schema = z.nativeEnum(Status)
    const typeInfo = {
      type: schema,
      isOptional: false,
      isNullable: false,
      isEnum: true,
    }

    const result = buildEnumType('status', typeInfo, { name: 'Task' })
    expect(result).toStrictEqual({ Active: 'active', Inactive: 'inactive' })
  })

  it('should handle enum in array', () => {
    const schema = z.enum(['a', 'b'])
    const typeInfo = {
      type: [schema],
      isOptional: false,
      isNullable: false,
      isEnum: true,
      isOfArray: true,
      isItemNullable: false,
      isItemOptional: false,
    }

    const result = buildEnumType('tags', typeInfo, { name: 'Post' })
    expect(Array.isArray(result)).toBe(true)
  })

  it('should throw for non-enum type', () => {
    const typeInfo = {
      type: 'not-an-enum',
      isOptional: false,
      isNullable: false,
      isEnum: true,
    }

    expect(() => buildEnumType('foo', typeInfo, { name: 'Bar' })).toThrow()
  })

  it('should use getEnumType provider when available', () => {
    const customEnum = { x: 'x', y: 'y' }
    const schema = z.enum(['a', 'b'])
    const typeInfo = {
      type: schema,
      isOptional: false,
      isNullable: false,
      isEnum: true,
    }

    const result = buildEnumType('status', typeInfo, {
      name: 'Model',
      getEnumType: () => customEnum,
    })
    expect(result).toBe(customEnum)
  })
})
