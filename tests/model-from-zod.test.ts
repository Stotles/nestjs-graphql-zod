import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { modelFromZod } from '../src/model-from-zod'

describe('modelFromZod', () => {
  it('should create a class from a simple object schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    }).describe('Person: A person entity')

    const Model = modelFromZod(schema, { name: 'Person' })
    expect(Model).toBeDefined()
    expect(typeof Model).toBe('function')
  })

  it('should create an instance with property descriptors', () => {
    const schema = z.object({
      name: z.string(),
    }).describe('SimpleModel: test')

    const Model = modelFromZod(schema, { name: 'SimpleModel_Test' })
    const instance = new Model()
    instance.name = 'Alice'
    expect(instance.name).toBe('Alice')
  })

  it('should validate on set by default', () => {
    const schema = z.object({
      count: z.number(),
    }).describe('ValidatedModel: test')

    const Model = modelFromZod(schema, { name: 'ValidatedModel_Test' })
    const instance = new Model()

    expect(() => {
      ;instance.count = ('not a number' as unknown as number)
    }).toThrow()
  })

  it('should handle default values', () => {
    const schema = z.object({
      greeting: z.string().default('hello'),
    }).describe('DefaultModel: test')

    const Model = modelFromZod(schema, { name: 'DefaultModel_Test' })
    const instance = new Model()
    expect(instance.greeting).toBe('hello')
  })

  it('should handle optional fields', () => {
    const schema = z.object({
      name: z.string(),
      nickname: z.string().optional(),
    }).describe('OptionalModel: test')

    const Model = modelFromZod(schema, { name: 'OptionalModel_Test' })
    expect(Model).toBeDefined()
  })

  it('should handle nested objects', () => {
    const schema = z.object({
      address: z.object({
        city: z.string(),
        zip: z.string(),
      }),
    }).describe('NestedModel: test')

    const Model = modelFromZod(schema, { name: 'NestedModel_Test' })
    expect(Model).toBeDefined()
  })

  it('should handle arrays', () => {
    const schema = z.object({
      tags: z.array(z.string()),
    }).describe('ArrayModel: test')

    const Model = modelFromZod(schema, { name: 'ArrayModel_Test' })
    expect(Model).toBeDefined()
  })

  it('should handle enums', () => {
    const schema = z.object({
      status: z.enum(['active', 'inactive']),
    }).describe('EnumModel: test')

    const Model = modelFromZod(schema, { name: 'EnumModel_Test' })
    expect(Model).toBeDefined()
  })

  it('should handle int type', () => {
    const schema = z.object({
      count: z.number().int(),
    }).describe('IntModel: test')

    const Model = modelFromZod(schema, { name: 'IntModel_Test' })
    expect(Model).toBeDefined()
  })

  it('should cache generated classes for same schema', () => {
    const schema = z.object({
      id: z.string(),
    }).describe('CachedModel: test')

    const Model1 = modelFromZod(schema, { name: 'CachedModel_Test' })
    const Model2 = modelFromZod(schema, { name: 'CachedModel_Test' })
    expect(Model1).toBe(Model2)
  })

  it('should respect safe parse option', () => {
    const schema = z.object({
      name: z.string(),
    }).describe('SafeModel: test')

    const Model = modelFromZod(schema, {
      name: 'SafeModel_Test',
      safe: true,
      doNotThrow: true,
    })
    const instance = new Model()
    ;instance.name = (42 as unknown as string)
    expect(instance.name).toBeUndefined()
  })
})
