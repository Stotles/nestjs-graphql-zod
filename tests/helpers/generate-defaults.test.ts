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
    const defaults = generateDefaults(schema) as any
    expect(defaults).toEqual({ name: 'test', age: 0 })
  })

  it('should skip non-default fields in object', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().default(0),
    })
    const defaults = generateDefaults(schema) as any
    expect(defaults).toEqual({ age: 0 })
    expect(defaults.name).toBeUndefined()
  })

  it('should return undefined for types without defaults', () => {
    expect(generateDefaults(z.string())).toBeUndefined()
    expect(generateDefaults(z.number())).toBeUndefined()
  })

  it('should return prefault value for ZodPrefault', () => {
    const schema = z.string().prefault('hello')
    expect(generateDefaults(schema)).toBe('hello')
  })

  it('should pick up ZodPrefault inside an object shape', () => {
    const schema = z.object({
      label: z.string().prefault('untitled'),
    })
    const defaults = generateDefaults(schema) as any
    expect(defaults).toEqual({ label: 'untitled' })
  })
})
