import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { inputFromZod } from '../../src/decorators/input-type/input-from-zod'

describe('inputFromZod', () => {
  it('should create an InputType class from a schema', () => {
    const schema = z
      .object({
        username: z.string(),
        password: z.string(),
      })
      .describe('LoginInput: Login credentials')

    const InputClass = inputFromZod(schema, { name: 'LoginInput_Test' })
    expect(InputClass).toBeDefined()
    expect(typeof InputClass).toBe('function')
  })

  it('should create instances with validation', () => {
    const schema = z
      .object({
        email: z.string(),
      })
      .describe('EmailInput: test')

    const InputClass = inputFromZod(schema, { name: 'EmailInput_Test' })
    const instance = new InputClass()
    instance.email = 'test@example.com'
    expect(instance.email).toBe('test@example.com')
  })

  it('should handle named creation', () => {
    const schema = z
      .object({
        value: z.number(),
      })
      .describe('NamedInput: test')

    const InputClass = inputFromZod(schema, 'NamedInput_Test')
    expect(InputClass).toBeDefined()
  })

  it('should handle complex schemas', () => {
    const schema = z
      .object({
        name: z.string(),
        tags: z.array(z.string()),
        metadata: z.object({
          key: z.string(),
        }),
      })
      .describe('ComplexInput: test')

    const InputClass = inputFromZod(schema, { name: 'ComplexInput_Test' })
    expect(InputClass).toBeDefined()
  })

  it('should handle optional fields', () => {
    const schema = z
      .object({
        required: z.string(),
        optional: z.string().optional(),
      })
      .describe('OptInput: test')

    const InputClass = inputFromZod(schema, { name: 'OptInput_Test' })
    expect(InputClass).toBeDefined()
  })
})
