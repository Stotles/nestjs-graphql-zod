import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { isZodInstance } from '../../src/helpers/is-zod-instance'

describe('isZodInstance', () => {
  it('should identify ZodString', () => {
    expect(isZodInstance(z.ZodString, z.string())).toBe(true)
  })

  it('should identify ZodNumber', () => {
    expect(isZodInstance(z.ZodNumber, z.number())).toBe(true)
  })

  it('should identify ZodBoolean', () => {
    expect(isZodInstance(z.ZodBoolean, z.boolean())).toBe(true)
  })

  it('should identify ZodObject', () => {
    expect(isZodInstance(z.ZodObject, z.object({ a: z.string() }))).toBe(true)
  })

  it('should identify ZodArray', () => {
    expect(isZodInstance(z.ZodArray, z.array(z.string()))).toBe(true)
  })

  it('should identify ZodOptional', () => {
    expect(isZodInstance(z.ZodOptional, z.string().optional())).toBe(true)
  })

  it('should identify ZodNullable', () => {
    expect(isZodInstance(z.ZodNullable, z.string().nullable())).toBe(true)
  })

  it('should identify ZodDefault', () => {
    expect(isZodInstance(z.ZodDefault, z.string().default('hello'))).toBe(true)
  })

  it('should identify ZodEnum', () => {
    expect(isZodInstance(z.ZodEnum, z.enum(['a', 'b']))).toBe(true)
  })

  it('should identify ZodEnum from nativeEnum', () => {
    enum Color { Red = 'red', Blue = 'blue' }
    expect(isZodInstance(z.ZodEnum, z.nativeEnum(Color))).toBe(true)
  })

  it('should return false for mismatched types', () => {
    expect(isZodInstance(z.ZodString, z.number())).toBe(false)
    expect(isZodInstance(z.ZodNumber, z.string())).toBe(false)
    expect(isZodInstance(z.ZodObject, z.string())).toBe(false)
  })

  describe('multi-copy zod fallback', () => {
    // When a process loads two copies of zod (e.g. one CJS, one ESM), the
    // exported classes share names but have distinct prototype chains, so
    // an instance from copy A is not `instanceof` copy B's class. Simulate
    // that by handing the helper an object whose constructor name matches
    // a zod class but whose prototype chain is unrelated.
    it('should fall back to constructor-name comparison when prototypes do not match', () => {
      class ZodString {}
      const fake = new ZodString()
      expect(fake instanceof z.ZodString).toBe(false)
      expect(isZodInstance(z.ZodString, fake)).toBe(true)
    })

    it('should still return false when neither instanceof nor names match', () => {
      class CompletelyUnrelated {}
      const other = new CompletelyUnrelated()
      expect(isZodInstance(z.ZodString, other)).toBe(false)
    })

    it('should not crash on objects with a missing constructor', () => {
      const bare = Object.create(null) as object
      expect(isZodInstance(z.ZodString, bare)).toBe(false)
    })
  })
})
