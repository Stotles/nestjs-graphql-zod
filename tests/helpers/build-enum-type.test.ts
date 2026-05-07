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
    expect(result).toEqual({ active: 'active', inactive: 'inactive' })
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
    expect(result).toEqual({ Active: 'active', Inactive: 'inactive' })
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

  describe('isNative detection (v4 unified ZodEnum)', () => {
    it('should report isNative=false for string-array enums', () => {
      const schema = z.enum(['a', 'b'])
      const typeInfo = { type: schema, isOptional: false, isNullable: false, isEnum: true }
      let observed: { isNative?: boolean } | undefined

      buildEnumType('status', typeInfo, {
        name: 'Model',
        getEnumType: (_enum, data) => {
          observed = data
          return undefined as any
        },
      })
      expect(observed?.isNative).toBe(false)
    })

    it('should report isNative=false for string TS enums', () => {
      enum Status { Active = 'active', Inactive = 'inactive' }
      const schema = z.nativeEnum(Status)
      const typeInfo = { type: schema, isOptional: false, isNullable: false, isEnum: true }
      let observed: { isNative?: boolean } | undefined

      buildEnumType('status', typeInfo, {
        name: 'Model',
        getEnumType: (_enum, data) => {
          observed = data
          return undefined as any
        },
      })
      expect(observed?.isNative).toBe(false)
    })

    it('should report isNative=true for numeric TS enums', () => {
      enum Color { Red, Green, Blue }
      const schema = z.nativeEnum(Color)
      const typeInfo = { type: schema, isOptional: false, isNullable: false, isEnum: true }
      let observed: { isNative?: boolean } | undefined

      buildEnumType('color', typeInfo, {
        name: 'Model',
        getEnumType: (_enum, data) => {
          observed = data
          return undefined as any
        },
      })
      expect(observed?.isNative).toBe(true)
    })

    it('should accept numeric TS enums without throwing on digit-string keys', () => {
      enum Color { Red, Green, Blue }
      const schema = z.nativeEnum(Color)
      const typeInfo = { type: schema, isOptional: false, isNullable: false, isEnum: true }

      expect(() =>
        buildEnumType('color', typeInfo, { name: 'Model' })
      ).not.toThrow()
    })

    it('should still reject incompatible string enum keys', () => {
      const Bad = { 'good': 'good', 'bad': '0starts-with-digit' }
      const schema = z.enum(Bad)
      const typeInfo = { type: schema, isOptional: false, isNullable: false, isEnum: true }
      expect(() => buildEnumType('flag', typeInfo, { name: 'Model' })).toThrow()
    })
  })
})
