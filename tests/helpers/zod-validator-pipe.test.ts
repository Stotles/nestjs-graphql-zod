import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { BadRequestException } from '@nestjs/common'
import { ZodValidatorPipe } from '../../src/helpers/zod-validator.pipe'

describe('ZodValidatorPipe', () => {
  const metadata = { type: 'body' as const }

  it('should pass valid data through', async () => {
    const pipe = new ZodValidatorPipe(z.string())
    const result = await pipe.transform('hello', metadata)
    expect(result).toBe('hello')
  })

  it('should pass valid object data through', async () => {
    const schema = z.object({ name: z.string(), age: z.number() })
    const pipe = new ZodValidatorPipe(schema)
    const input = { name: 'Alice', age: 30 }
    const result = await pipe.transform(input, metadata)
    expect(result).toStrictEqual(input)
  })

  it('should throw BadRequestException on invalid data', async () => {
    const pipe = new ZodValidatorPipe(z.string())
    await expect(pipe.transform(123, metadata)).rejects.toThrow(BadRequestException)
  })

  it('should throw BadRequestException with issues for object', async () => {
    const schema = z.object({ name: z.string() })
    const pipe = new ZodValidatorPipe(schema)

    try {
      await pipe.transform({ name: 123 }, metadata)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException)
    }
  })

  it('should walk array indices when reporting errors inside array elements', async () => {
    const schema = z.object({
      items: z.array(z.object({ name: z.string() })),
    })
    const pipe = new ZodValidatorPipe(schema)

    try {
      await pipe.transform({ items: [{ name: 'ok' }, { name: 123 }] }, metadata)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException)
      const response = (err as BadRequestException).getResponse() as { message: any[] }
      const [top] = response.message
      expect(top.property).toBe('items')
      expect(top.value).toBe(123)
      expect(top.children?.[0].property).toBe('1')
      expect(top.children?.[0].children?.[0].property).toBe('name')
      expect(top.children?.[0].children?.[0].value).toBe(123)
    }
  })

  it('should report the deepest value for deeply nested object paths', async () => {
    const schema = z.object({
      a: z.object({
        b: z.object({
          c: z.object({
            d: z.string(),
          }),
        }),
      }),
    })
    const pipe = new ZodValidatorPipe(schema)

    try {
      await pipe.transform({ a: { b: { c: { d: 42 } } } }, metadata)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException)
      const response = (err as BadRequestException).getResponse() as { message: any[] }
      const [top] = response.message
      expect(top.property).toBe('a')
      expect(top.value).toBe(42)

      let node = top.children?.[0]
      for (const property of ['b', 'c', 'd']) {
        expect(node?.property).toBe(property)
        node = node?.children?.[0]
      }
    }
  })

  it('should return undefined when the issue path walks through a non-traversable value', async () => {
    const schema = z.object({ name: z.string() }).superRefine((_data, ctx) => {
      ctx.addIssue({
        code: 'custom',
        path: ['name', 'nope'],
        message: 'custom failure past a primitive',
      })
    })
    const pipe = new ZodValidatorPipe(schema)

    try {
      await pipe.transform({ name: 'foo' }, metadata)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException)
      const response = (err as BadRequestException).getResponse() as { message: any[] }
      const [top] = response.message
      expect(top.property).toBe('name')
      expect(top.value).toBeUndefined()
      expect(top.children?.[0].property).toBe('nope')
      expect(top.children?.[0].value).toBeUndefined()
    }
  })

  it('should use an empty property when the issue has no path (primitive-root schema)', async () => {
    const pipe = new ZodValidatorPipe(z.string())

    try {
      await pipe.transform(123, metadata)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException)
      const response = (err as BadRequestException).getResponse() as { message: any[] }
      const [top] = response.message
      expect(top.property).toBe('')
      expect(top.children).toBeUndefined()
      expect(top.value).toBe(123)
    }
  })

  it('should coerce numeric top-level path segments to strings for array-root schemas', async () => {
    const schema = z.array(z.object({ name: z.string() }))
    const pipe = new ZodValidatorPipe(schema)

    try {
      await pipe.transform([{ name: 'ok' }, { name: 123 }], metadata)
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException)
      const response = (err as BadRequestException).getResponse() as { message: any[] }
      const [top] = response.message
      expect(top.property).toBe('1')
      expect(top.children?.[0].property).toBe('name')
      expect(top.children?.[0].value).toBe(123)
    }
  })
})
