import 'reflect-metadata'
import { describe, it, expect, expectTypeOf } from 'vitest'
import { z } from 'zod'
import {
  unwrapNestedZod,
  unwrapNestedZodRecursively,
  iterateZodLayers,
  type UnwrapNestedZod,
} from '../../src/helpers/unwrap'
import { isZodInstance } from '../../src/helpers/is-zod-instance'

describe('unwrapNestedZod', () => {
  it('should unwrap ZodOptional', () => {
    const inner = z.string()
    const wrapped = inner.optional()
    const unwrapped = unwrapNestedZod(wrapped)
    expect(isZodInstance(z.ZodString, unwrapped)).toBe(true)
  })

  it('should unwrap ZodNullable', () => {
    const inner = z.number()
    const wrapped = inner.nullable()
    const unwrapped = unwrapNestedZod(wrapped)
    expect(isZodInstance(z.ZodNumber, unwrapped)).toBe(true)
  })

  it('should unwrap ZodDefault', () => {
    const inner = z.string()
    const wrapped = inner.default('test')
    const unwrapped = unwrapNestedZod(wrapped)
    expect(isZodInstance(z.ZodString, unwrapped)).toBe(true)
  })

  it('should unwrap ZodArray to its element', () => {
    const inner = z.string()
    const wrapped = z.array(inner)
    const unwrapped = unwrapNestedZod(wrapped)
    expect(isZodInstance(z.ZodString, unwrapped)).toBe(true)
  })

  it('should unwrap ZodCatch', () => {
    const inner = z.string()
    const wrapped = inner.catch('fallback')
    const unwrapped = unwrapNestedZod(wrapped)
    expect(isZodInstance(z.ZodString, unwrapped)).toBe(true)
  })

  it('should unwrap ZodPipe to its input', () => {
    const wrapped = z.string().transform((val) => val.length)
    const unwrapped = unwrapNestedZod(wrapped)
    expect(isZodInstance(z.ZodString, unwrapped)).toBe(true)
  })

  it('should unwrap ZodPromise', () => {
    const inner = z.string()
    const wrapped = z.promise(inner)
    const unwrapped = unwrapNestedZod(wrapped)
    expect(isZodInstance(z.ZodString, unwrapped)).toBe(true)
  })

  it('should unwrap ZodSet to its value type', () => {
    const inner = z.string()
    const wrapped = z.set(inner)
    const unwrapped = unwrapNestedZod(wrapped)
    expect(isZodInstance(z.ZodString, unwrapped)).toBe(true)
  })

  it('should unwrap ZodReadonly', () => {
    const inner = z.string()
    const wrapped = inner.readonly()
    const unwrapped = unwrapNestedZod(wrapped)
    expect(isZodInstance(z.ZodString, unwrapped)).toBe(true)
  })

  it('should unwrap ZodPrefault', () => {
    const inner = z.string()
    const wrapped = inner.prefault('seed')
    const unwrapped = unwrapNestedZod(wrapped)
    expect(isZodInstance(z.ZodString, unwrapped)).toBe(true)
  })

  it('should return same value for non-wrapping types', () => {
    const str = z.string()
    expect(unwrapNestedZod(str)).toBe(str)
  })
})

describe('unwrapNestedZodRecursively', () => {
  it('should recursively unwrap multiple layers', () => {
    const wrapped = z.string().optional().nullable()
    const unwrapped = unwrapNestedZodRecursively(wrapped)
    expect(isZodInstance(z.ZodString, unwrapped)).toBe(true)
  })

  it('should recursively unwrap default + optional', () => {
    const wrapped = z.string().default('x').optional()
    const unwrapped = unwrapNestedZodRecursively(wrapped)
    expect(isZodInstance(z.ZodString, unwrapped)).toBe(true)
  })

  it('should recursively unwrap readonly + prefault + optional', () => {
    const wrapped = z.string().prefault('x').readonly().optional()
    const unwrapped = unwrapNestedZodRecursively(wrapped)
    expect(isZodInstance(z.ZodString, unwrapped)).toBe(true)
  })

  it('should handle already-unwrapped types', () => {
    const str = z.string()
    expect(unwrapNestedZodRecursively(str)).toBe(str)
  })

  it('should recursively unwrap ZodPipe to its input', () => {
    const wrapped = z
      .string()
      .transform((val) => val.length)
      .pipe(z.number())
    const unwrapped = unwrapNestedZodRecursively(wrapped)
    expect(isZodInstance(z.ZodString, unwrapped)).toBe(true)
  })

  describe('type safety', () => {
    it('should statically extract the input side of a ZodPipe', () => {
      // The `pipe` overload requires B's input to match A's output, so we use
      // string -> string here. UnwrapNestedZod<ZodPipe<A, B>> should be A.
      const pipe = z.string().pipe(z.string())
      type Unwrapped = UnwrapNestedZod<typeof pipe>
      expectTypeOf<Unwrapped>().toMatchTypeOf<z.ZodString>()
    })

    it('should statically extract the input side of a transform pipe', () => {
      const wrapped = z.string().pipe(z.transform((v) => v.length))
      type Unwrapped = UnwrapNestedZod<typeof wrapped>
      expectTypeOf<Unwrapped>().toMatchTypeOf<z.ZodString>()
    })
  })
})

describe('iterateZodLayers', () => {
  it('should yield all layers including the innermost', () => {
    const wrapped = z.string().optional().nullable()
    const layers = [...iterateZodLayers(wrapped)]
    expect(layers.length).toBeGreaterThanOrEqual(3)
    expect(isZodInstance(z.ZodNullable, layers[0])).toBe(true)
    expect(isZodInstance(z.ZodString, layers[layers.length - 1])).toBe(true)
  })

  it('should yield just the value for non-wrapping types', () => {
    const str = z.string()
    const layers = [...iterateZodLayers(str)]
    expect(layers).toHaveLength(1)
    expect(layers[0]).toBe(str)
  })
})
