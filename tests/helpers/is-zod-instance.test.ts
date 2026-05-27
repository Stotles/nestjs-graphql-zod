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

  it('should identify base classes like ZodType', () => {
    // ZodType is the abstract base — every schema instance should match.
    expect(isZodInstance(z.ZodType, z.string())).toBe(true)
    expect(isZodInstance(z.ZodType, z.object({ a: z.string() }))).toBe(true)
    expect(isZodInstance(z.ZodType, z.array(z.number()))).toBe(true)
  })

  it('should return false for unrelated objects', () => {
    class CompletelyUnrelated {}
    expect(isZodInstance(z.ZodString, new CompletelyUnrelated())).toBe(false)
  })

  it('should return false for objects which share a constructor name but are not actually instances', () => {
    class ZodString {}
    const fake = new ZodString()
    expect(fake instanceof z.ZodString).toBe(false)
    expect(isZodInstance(z.ZodString, fake)).toBe(false)
  })

  it('should not crash on bare objects', () => {
    expect(isZodInstance(z.ZodString, Object.create(null))).toBe(false)
  })

  describe('cross-copy zod', () => {
    // When a process ends up with two copies of zod (e.g. a CJS/ESM split,
    // or duplicate versions in the dep tree), the two copies export
    // distinct class identities. zod v4 sidesteps that by overriding
    // `Symbol.hasInstance` to check `_zod.traits` — a Set of class names
    // (concrete and abstract) the instance satisfies. Trait names are
    // plain strings, so `instanceof` works across the boundary.
    it('should identify schemas built from a separate zod copy', () => {
      // The top-of-file `import` goes through the ESM loader (./index.js),
      // while `require()` resolves to the CJS build (./index.cjs) — two
      // distinct files so the classes do not share identity.
      const zCopy = require('zod') as typeof z
      expect(zCopy.ZodString).not.toBe(z.ZodString)
      expect(zCopy.ZodType).not.toBe(z.ZodType)

      const stringFromOtherCopy = zCopy.string()
      expect(isZodInstance(z.ZodString, stringFromOtherCopy)).toBe(true)
      expect(isZodInstance(z.ZodType, stringFromOtherCopy)).toBe(true)
      expect(isZodInstance(z.ZodNumber, stringFromOtherCopy)).toBe(false)
    })
  })
})
