import 'reflect-metadata'
import { describe, it, expect, afterEach } from 'vitest'
import { z } from 'zod'
import { ZodArgs } from '../../src/decorators/input-type/zod-args'

describe('ZodArgs', () => {
  afterEach(() => {
    ZodArgs.free()
  })

  it('should create a parameter decorator for a string schema', () => {
    const decorator = ZodArgs(z.string(), 'name', {})
    expect(typeof decorator).toBe('function')
  })

  it('should create a parameter decorator for a number schema', () => {
    const decorator = ZodArgs(z.number(), 'count', {})
    expect(typeof decorator).toBe('function')
  })

  it('should create a parameter decorator for an object schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    }).describe('ArgsInput: test args')

    const decorator = ZodArgs(schema, 'input', {})
    expect(typeof decorator).toBe('function')
  })

  it('should handle decorator with just schema', () => {
    const decorator = ZodArgs(z.string())
    expect(typeof decorator).toBe('function')
  })

  it('should handle decorator with name parameter', () => {
    const decorator = ZodArgs(z.string(), 'myArg')
    expect(typeof decorator).toBe('function')
  })

  it('should free internal state', () => {
    const schema = z.object({ x: z.string() }).describe('FreeTest: test')
    ZodArgs(schema, 'input', {})
    ZodArgs.free()
    const decorator = ZodArgs(schema, 'input', {})
    expect(typeof decorator).toBe('function')
  })
})

describe('ZodArgs.Of', () => {
  it('should be a type-level utility (just verify it compiles)', () => {
    type Result = ZodArgs.Of<z.ZodString>
    const _check: Result = 'hello'
    expect(_check).toBe('hello')
  })
})
