import 'reflect-metadata'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { registerEnumType } from '@nestjs/graphql'
import { buildEnumType } from '../../src/helpers/build-enum-type'
import type { EnumProviderData } from '../../src/types/enum-provider'

vi.mock('@nestjs/graphql', async () => {
  const actual = await vi.importActual<typeof import('@nestjs/graphql')>('@nestjs/graphql')
  return { ...actual, registerEnumType: vi.fn() }
})

const enumTypeInfo = (type: unknown) => ({
  type,
  isOptional: false,
  isNullable: false,
  isEnum: true,
})

const enumArrayTypeInfo = (schema: unknown) => ({
  type: [schema],
  isOptional: false,
  isNullable: false,
  isEnum: true,
  isOfArray: true,
  isItemNullable: false,
  isItemOptional: false,
})

describe('buildEnumType', () => {
  beforeEach(() => {
    vi.mocked(registerEnumType).mockClear()
  })

  it('should register a ZodEnum and return the enum object', () => {
    const schema = z.enum(['active', 'inactive'])
    const result = buildEnumType('status', enumTypeInfo(schema), { name: 'User' })
    expect(result).toStrictEqual({ active: 'active', inactive: 'inactive' })
  })

  it('should register a TS enum via z.nativeEnum (v3 legacy syntax)', () => {
    enum Status {
      Active = 'active',
      Inactive = 'inactive',
    }
    const schema = z.nativeEnum(Status)
    const result = buildEnumType('status', enumTypeInfo(schema), { name: 'Task' })
    expect(result).toStrictEqual({ Active: 'active', Inactive: 'inactive' })
  })

  it('should register a TS enum via z.enum (v4 unified syntax)', () => {
    enum Status {
      Active = 'active',
      Inactive = 'inactive',
    }
    const schema = z.enum(Status)
    const result = buildEnumType('status', enumTypeInfo(schema), { name: 'Task' })
    expect(result).toStrictEqual({ Active: 'active', Inactive: 'inactive' })
  })

  it('should pass isNative/parentName/description to the provider', () => {
    const schema = z.enum(['a', 'b']).describe('status values')
    let observed: EnumProviderData | undefined

    buildEnumType('status', enumTypeInfo(schema), {
      name: 'Model',
      getEnumType: (_enum, data) => {
        observed = data
        return undefined
      },
    })
    expect(observed?.isNative).toBe(false)
    expect(observed?.parentName).toBe('Model')
    expect(observed?.description).toBe('status values')
  })

  it('should pass isNative=true to the provider for numeric TS enums (v3 legacy syntax)', () => {
    enum Color {
      Red,
      Green,
      Blue,
    }
    const schema = z.nativeEnum(Color)
    let observed: EnumProviderData | undefined

    buildEnumType('color', enumTypeInfo(schema), {
      name: 'Model',
      getEnumType: (_enum, data) => {
        observed = data
        return undefined
      },
    })
    expect(observed?.isNative).toBe(true)
  })

  it('should pass isNative=true to the provider for numeric TS enums (v4 unified syntax)', () => {
    enum Color {
      Red,
      Green,
      Blue,
    }
    const schema = z.enum(Color)
    let observed: EnumProviderData | undefined

    buildEnumType('color', enumTypeInfo(schema), {
      name: 'Model',
      getEnumType: (_enum, data) => {
        observed = data
        return undefined
      },
    })
    expect(observed?.isNative).toBe(true)
  })

  it('should pass isNative=false for plain numeric-valued objects without reverse mappings', () => {
    const schema = z.enum({ A: 1, B: 2 } as const)
    let observed: EnumProviderData | undefined

    buildEnumType('grade', enumTypeInfo(schema), {
      name: 'Model',
      getEnumType: (_enum, data) => {
        observed = data
        return undefined
      },
    })
    expect(observed?.isNative).toBe(false)
  })

  it('should handle enum in array', () => {
    const schema = z.enum(['a', 'b'])
    const result = buildEnumType('tags', enumArrayTypeInfo(schema), { name: 'Post' })
    expect(result).toStrictEqual([{ a: 'a', b: 'b' }])
  })

  it('should throw for non-enum type', () => {
    expect(() => buildEnumType('foo', enumTypeInfo('not-an-enum'), { name: 'Bar' })).toThrow()
  })

  it('should use getEnumType provider when available', () => {
    const customEnum = { x: 'x', y: 'y' }
    const schema = z.enum(['a', 'b'])

    const result = buildEnumType('status', enumTypeInfo(schema), {
      name: 'Model',
      getEnumType: () => customEnum,
    })
    expect(result).toBe(customEnum)
  })

  it('should fall through to registration when provider returns the same Enum', () => {
    const schema = z.enum(['a', 'b'])
    const result = buildEnumType('status', enumTypeInfo(schema), {
      name: 'Model',
      getEnumType: (Enum) => Enum,
    })
    expect(result).toStrictEqual({ a: 'a', b: 'b' })
  })

  it('should accept numeric TS enums via z.nativeEnum and preserve reverse mappings', () => {
    enum Color {
      Red,
      Green,
      Blue,
    }
    const schema = z.nativeEnum(Color)
    const result = buildEnumType('color', enumTypeInfo(schema), { name: 'Model' })
    expect(result).toStrictEqual({ 0: 'Red', 1: 'Green', 2: 'Blue', Red: 0, Green: 1, Blue: 2 })
  })

  it('should accept numeric TS enums via z.enum and preserve reverse mappings', () => {
    enum Color {
      Red,
      Green,
      Blue,
    }
    const schema = z.enum(Color)
    const result = buildEnumType('color', enumTypeInfo(schema), { name: 'Model' })
    expect(result).toStrictEqual({ 0: 'Red', 1: 'Green', 2: 'Blue', Red: 0, Green: 1, Blue: 2 })
  })

  it('should accept mixed numeric/string enums', () => {
    enum Mixed {
      A = 1,
      B = 'b',
    }
    const schema = z.nativeEnum(Mixed)
    const result = buildEnumType('mixed', enumTypeInfo(schema), { name: 'Model' })
    expect(result).toStrictEqual({ 1: 'A', A: 1, B: 'b' })
  })

  it('should accept arrays of numeric TS enums', () => {
    enum Color {
      Red,
      Green,
      Blue,
    }
    const schema = z.nativeEnum(Color)
    const result = buildEnumType('colors', enumArrayTypeInfo(schema), { name: 'Model' })
    expect(result).toStrictEqual([{ 0: 'Red', 1: 'Green', 2: 'Blue', Red: 0, Green: 1, Blue: 2 }])
  })

  it('should reject incompatible string enum keys', () => {
    const Bad = { good: 'good', bad: '0starts-with-digit' }
    const schema = z.enum(Bad)
    expect(() => buildEnumType('flag', enumTypeInfo(schema), { name: 'Model' })).toThrow()
  })

  describe('registerEnumType call', () => {
    it('should register with a title-cased composite name and fall back to a generated description', () => {
      const schema = z.enum(['a', 'b'])
      buildEnumType('status', enumTypeInfo(schema), { name: 'model' })

      expect(registerEnumType).toHaveBeenCalledOnce()
      const [enumArg, config] = vi.mocked(registerEnumType).mock.calls[0]
      expect(enumArg).toStrictEqual({ a: 'a', b: 'b' })
      expect(config?.name).toMatch(/^Model_StatusEnum_\d+$/)
      expect(config?.description).toBe('Enum values for model.status')
    })

    it('should use the schema description when present', () => {
      const schema = z.enum(['a', 'b']).describe('custom desc')
      buildEnumType('status', enumTypeInfo(schema), { name: 'Model' })

      const config = vi.mocked(registerEnumType).mock.calls[0][1]!
      expect(config.name).toMatch(/^Model_StatusEnum_\d+$/)
      expect(config.description).toBe('custom desc')
    })

    it('should not call registerEnumType when the provider returns a replacement', () => {
      const schema = z.enum(['a', 'b'])
      buildEnumType('status', enumTypeInfo(schema), {
        name: 'Model',
        getEnumType: () => ({ x: 'x' }),
      })
      expect(registerEnumType).not.toHaveBeenCalled()
    })
  })
})
