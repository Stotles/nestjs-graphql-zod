import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { createZodPropertyDescriptor } from '../../src/helpers/create-zod-property-descriptor'

describe('createZodPropertyDescriptor', () => {
  it('should create a descriptor with get/set for string', () => {
    const descriptor = createZodPropertyDescriptor('name', z.string(), {})
    const obj = {} as Record<string, any>
    Object.defineProperty(obj, 'name', descriptor)

    obj.name = 'hello'
    expect(obj.name).toBe('hello')
  })

  it('should throw on invalid value by default', () => {
    const descriptor = createZodPropertyDescriptor('count', z.number(), {})
    const obj = {} as Record<string, any>
    Object.defineProperty(obj, 'count', descriptor)

    expect(() => {
      obj.count = 'not a number'
    }).toThrow()
  })

  it('should use safeParse when safe option is true', () => {
    const descriptor = createZodPropertyDescriptor('name', z.string(), { safe: true })
    const obj = {} as Record<string, any>
    Object.defineProperty(obj, 'name', descriptor)

    obj.name = 'hello'
    expect(obj.name).toBe('hello')
  })

  it('should call onParseError on safe parse failure', () => {
    let errorCalled = false
    const descriptor = createZodPropertyDescriptor('name', z.string(), {
      safe: true,
      onParseError() {
        errorCalled = true
        return 'fallback'
      },
    })
    const obj = {} as Record<string, any>
    Object.defineProperty(obj, 'name', descriptor)

    obj.name = 123
    expect(errorCalled).toBe(true)
    expect(obj.name).toBe('fallback')
  })

  it('should set undefined on error when doNotThrow is true', () => {
    const descriptor = createZodPropertyDescriptor('name', z.string(), { doNotThrow: true })
    const obj = {} as Record<string, any>
    Object.defineProperty(obj, 'name', descriptor)

    obj.name = 123
    expect(obj.name).toBeUndefined()
  })

  it('should handle default values from ZodDefault', () => {
    const schema = z.string().default('default_value')
    const descriptor = createZodPropertyDescriptor('name', schema, {})
    const obj = {} as Record<string, any>
    Object.defineProperty(obj, 'name', descriptor)

    expect(obj.name).toBe('default_value')
  })

  it.each([
    ['ZodReadonly wrapping ZodDefault', () => z.string().default('default_value').readonly()],
    ['ZodOptional wrapping ZodDefault', () => z.string().default('default_value').optional()],
    ['ZodNullable wrapping ZodDefault', () => z.string().default('default_value').nullable()],
    ['stacked wrappers', () => z.string().default('default_value').optional().readonly()],
    ['ZodPrefault directly', () => z.string().prefault('default_value')],
  ])('should extract default through %s', (_label, makeSchema) => {
    const descriptor = createZodPropertyDescriptor('name', makeSchema(), {})
    const obj = {} as Record<string, any>
    Object.defineProperty(obj, 'name', descriptor)

    expect(obj.name).toBe('default_value')
  })
})
