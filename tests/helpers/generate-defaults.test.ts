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
})
