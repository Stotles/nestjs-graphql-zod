import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { Int } from '@nestjs/graphql'
import { getFieldInfoFromZod } from '../../src/helpers/get-field-info-from-zod'

describe('getFieldInfoFromZod', () => {
  const defaultOptions = { name: 'TestModel' }

  describe('primitive types', () => {
    it('should handle ZodString', () => {
      const info = getFieldInfoFromZod('name', z.string(), defaultOptions)
      expect(info.type).toBe(String)
      expect(info.isOptional).toBe(false)
      expect(info.isNullable).toBe(false)
    })

    it('should handle ZodNumber', () => {
      const info = getFieldInfoFromZod('count', z.number(), defaultOptions)
      expect(info.type).toBe(Number)
      expect(info.isOptional).toBe(false)
      expect(info.isNullable).toBe(false)
    })

    it('should detect int as Int type', () => {
      const info = getFieldInfoFromZod('count', z.number().int(), defaultOptions)
      expect(info.type).toBe(Int)
    })

    it('should handle ZodBoolean', () => {
      const info = getFieldInfoFromZod('active', z.boolean(), defaultOptions)
      expect(info.type).toBe(Boolean)
      expect(info.isOptional).toBe(false)
    })
  })

  describe('optional and nullable', () => {
    it('should detect optional', () => {
      const info = getFieldInfoFromZod('name', z.string().optional(), defaultOptions)
      expect(info.type).toBe(String)
      expect(info.isOptional).toBe(true)
    })

    it('should detect nullable', () => {
      const info = getFieldInfoFromZod('name', z.string().nullable(), defaultOptions)
      expect(info.type).toBe(String)
      expect(info.isOptional).toBe(false)
      expect(info.isNullable).toBe(true)
    })
  })

  describe('arrays', () => {
    it('should handle array of strings', () => {
      const info = getFieldInfoFromZod('tags', z.array(z.string()), defaultOptions)
      expect(info.isOfArray).toBe(true)
      expect(Array.isArray(info.type)).toBe(true)
      expect(info.type[0]).toBe(String)
    })

    it('should handle optional array', () => {
      const info = getFieldInfoFromZod('tags', z.array(z.string()).optional(), defaultOptions)
      expect(info.isOfArray).toBe(true)
      expect(info.isOptional).toBe(true)
    })

    it('should detect nullable items in array', () => {
      const info = getFieldInfoFromZod('tags', z.array(z.string().nullable()), defaultOptions)
      expect(info.isOfArray).toBe(true)
      expect(info.isItemNullable).toBe(true)
    })
  })

  describe('objects (nested)', () => {
    it('should handle nested ZodObject', () => {
      const inner = z.object({ city: z.string() })
      const info = getFieldInfoFromZod('address', inner, defaultOptions)
      expect(info.isType).toBe(true)
      expect(typeof info.type).toBe('function')
    })
  })

  describe('enums', () => {
    it('should handle ZodEnum', () => {
      const info = getFieldInfoFromZod('status', z.enum(['active', 'inactive']), defaultOptions)
      expect(info.isEnum).toBe(true)
    })
  })

  describe('defaults and transforms', () => {
    it('should unwrap ZodDefault', () => {
      const info = getFieldInfoFromZod('name', z.string().default('hello'), defaultOptions)
      expect(info.type).toBe(String)
    })

    it('should unwrap ZodPipe (transform)', () => {
      const schema = z.string().transform(val => val.toUpperCase())
      const info = getFieldInfoFromZod('name', schema, defaultOptions)
      expect(info.type).toBe(String)
    })
  })

  describe('zod v4 string formats', () => {
    // In Zod v4, z.uuid()/z.email()/etc. are no longer ZodString — they are
    // their own classes (ZodUUID, ZodEmail...) that share ZodStringFormat as
    // a common base. They should still map to GraphQL's String type.
    const cases: Array<[string, () => any]> = [
      ['uuid', () => z.uuid()],
      ['email', () => z.email()],
      ['url', () => z.url()],
      ['cuid', () => z.cuid()],
      ['cuid2', () => z.cuid2()],
      ['ulid', () => z.ulid()],
      ['nanoid', () => z.nanoid()],
      ['base64', () => z.base64()],
      ['ipv4', () => z.ipv4()],
      ['ipv6', () => z.ipv6()],
      ['jwt', () => z.jwt()],
      ['emoji', () => z.emoji()],
      ['iso.date', () => z.iso.date()],
      ['iso.datetime', () => z.iso.datetime()],
    ]

    for (const [name, build] of cases) {
      it(`should treat z.${name}() as String`, () => {
        const info = getFieldInfoFromZod('field', build(), defaultOptions)
        expect(info.type).toBe(String)
        expect(info.isOptional).toBe(false)
        expect(info.isNullable).toBe(false)
      })
    }

    it('should preserve optional through string-format types', () => {
      const info = getFieldInfoFromZod('field', z.email().optional(), defaultOptions)
      expect(info.type).toBe(String)
      expect(info.isOptional).toBe(true)
    })

    it('should preserve nullable through string-format types', () => {
      const info = getFieldInfoFromZod('field', z.uuid().nullable(), defaultOptions)
      expect(info.type).toBe(String)
      expect(info.isNullable).toBe(true)
    })

    it('should handle arrays of string-format types', () => {
      const info = getFieldInfoFromZod('ids', z.array(z.uuid()), defaultOptions)
      expect(info.isOfArray).toBe(true)
      expect(info.type[0]).toBe(String)
    })
  })

  describe('canParse', () => {
    it('should return true for supported types', () => {
      expect(getFieldInfoFromZod.canParse(z.string())).toBe(true)
      expect(getFieldInfoFromZod.canParse(z.number())).toBe(true)
      expect(getFieldInfoFromZod.canParse(z.boolean())).toBe(true)
      expect(getFieldInfoFromZod.canParse(z.object({}))).toBe(true)
      expect(getFieldInfoFromZod.canParse(z.array(z.string()))).toBe(true)
      expect(getFieldInfoFromZod.canParse(z.string().optional())).toBe(true)
      expect(getFieldInfoFromZod.canParse(z.string().nullable())).toBe(true)
      expect(getFieldInfoFromZod.canParse(z.string().default('x'))).toBe(true)
      expect(getFieldInfoFromZod.canParse(z.enum(['a', 'b']))).toBe(true)
      expect(getFieldInfoFromZod.canParse(z.uuid())).toBe(true)
      expect(getFieldInfoFromZod.canParse(z.email())).toBe(true)
      expect(getFieldInfoFromZod.canParse(z.url())).toBe(true)
      expect(getFieldInfoFromZod.canParse(z.iso.datetime())).toBe(true)
    })

    it('should return false for unsupported types', () => {
      expect(getFieldInfoFromZod.canParse(z.unknown())).toBe(false)
    })
  })
})
