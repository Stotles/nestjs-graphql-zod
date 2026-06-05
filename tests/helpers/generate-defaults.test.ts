import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { generateDefaults } from '../../src/helpers/generate-defaults'

describe('generateDefaults', () => {
  it('should return default value for ZodDefault', () => {
    const schema = z.string().default('hello')
    expect(generateDefaults(schema)).toBe('hello')
  })

  it('should return default number value', () => {
    const schema = z.number().default(42)
    expect(generateDefaults(schema)).toBe(42)
  })

  it('should return object of defaults for ZodObject', () => {
    const schema = z.object({
      name: z.string().default('test'),
      age: z.number().default(0),
    })
    const defaults = generateDefaults(schema)
    expect(defaults).toStrictEqual({ name: 'test', age: 0 })
  })

  it('should skip non-default fields in object', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().default(0),
    })
    const defaults = generateDefaults(schema)
    expect(defaults).toStrictEqual({ age: 0 })
    expect(defaults).not.toHaveProperty('name')
  })

  it('should return undefined for types without defaults', () => {
    expect(generateDefaults(z.string())).toBeUndefined()
    expect(generateDefaults(z.number())).toBeUndefined()
  })

  it('should peel ZodReadonly to find the inner default', () => {
    expect(generateDefaults(z.string().default('hello').readonly())).toBe('hello')
  })

  it('should peel ZodOptional to find the inner default', () => {
    expect(generateDefaults(z.string().default('hello').optional())).toBe('hello')
  })

  it('should peel ZodNullable to find the inner default', () => {
    expect(generateDefaults(z.string().default('hello').nullable())).toBe('hello')
  })

  it('should peel through stacked wrappers', () => {
    expect(generateDefaults(z.string().default('hello').optional().readonly())).toBe('hello')
  })

  it('should peel ZodLazy to find the inner default', () => {
    expect(generateDefaults(z.lazy(() => z.string().default('hello')))).toBe('hello')
  })

  it('should return ZodPrefault default value', () => {
    expect(generateDefaults(z.string().prefault('hello'))).toBe('hello')
  })

  it('should peel wrappers to find a ZodPrefault default', () => {
    expect(generateDefaults(z.string().prefault('hello').readonly())).toBe('hello')
  })

  it('should not surface array element defaults as the array default', () => {
    expect(generateDefaults(z.array(z.string().default('hello')))).toBeUndefined()
  })

  it('should peel through deeply stacked wrappers', () => {
    let schema: z.ZodType = z.string().default('deep')
    for (let i = 0; i < 25; i++) {
      schema = schema.optional().readonly().nullable()
    }
    expect(generateDefaults(schema)).toBe('deep')
  })

  it('should terminate on a self-referential ZodLazy cycle', () => {
    let self: z.ZodType
    self = z.lazy(() => self)
    expect(generateDefaults(self)).toBeUndefined()
  })

  it('should handle a recursive ZodLazy without stack-overflow', () => {
    // Each getter() call produces a brand-new ZodLazy, so the visited Set
    // never trips — the depth cap is the only thing protecting us.
    function infiniteLoop(): z.ZodType {
      return z.lazy(() => infiniteLoop())
    }
    expect(() => generateDefaults(infiniteLoop())).toThrow(/MAX_ZOD_DEPTH/)
  })
})
