import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  _getCachedClass,
  _getModelFromZodDepth,
  modelFromZod,
  modelFromZodBase,
} from '../src/model-from-zod'

describe('modelFromZod', () => {
  it('should create a class from a simple object schema', () => {
    const schema = z
      .object({
        name: z.string(),
        age: z.number(),
      })
      .describe('Person: A person entity')

    const Model = modelFromZod(schema, { name: 'Person' })
    expect(Model).toBeDefined()
    expect(typeof Model).toBe('function')
  })

  it('should create an instance with property descriptors', () => {
    const schema = z
      .object({
        name: z.string(),
      })
      .describe('SimpleModel: test')

    const Model = modelFromZod(schema, { name: 'SimpleModel_Test' })
    const instance = new Model()
    instance.name = 'Alice'
    expect(instance.name).toBe('Alice')
  })

  it('should validate on set by default', () => {
    const schema = z
      .object({
        count: z.number(),
      })
      .describe('ValidatedModel: test')

    const Model = modelFromZod(schema, { name: 'ValidatedModel_Test' })
    const instance = new Model()

    expect(() => {
      instance.count = 'not a number' as unknown as number
    }).toThrow()
  })

  it('should handle default values', () => {
    const schema = z
      .object({
        greeting: z.string().default('hello'),
      })
      .describe('DefaultModel: test')

    const Model = modelFromZod(schema, { name: 'DefaultModel_Test' })
    const instance = new Model()
    expect(instance.greeting).toBe('hello')
  })

  it('should handle optional fields', () => {
    const schema = z
      .object({
        name: z.string(),
        nickname: z.string().optional(),
      })
      .describe('OptionalModel: test')

    const Model = modelFromZod(schema, { name: 'OptionalModel_Test' })
    expect(Model).toBeDefined()
  })

  it('should handle nested objects', () => {
    const schema = z
      .object({
        address: z.object({
          city: z.string(),
          zip: z.string(),
        }),
      })
      .describe('NestedModel: test')

    const Model = modelFromZod(schema, { name: 'NestedModel_Test' })
    expect(Model).toBeDefined()
  })

  it('should handle arrays', () => {
    const schema = z
      .object({
        tags: z.array(z.string()),
      })
      .describe('ArrayModel: test')

    const Model = modelFromZod(schema, { name: 'ArrayModel_Test' })
    expect(Model).toBeDefined()
  })

  it('should handle enums', () => {
    const schema = z
      .object({
        status: z.enum(['active', 'inactive']),
      })
      .describe('EnumModel: test')

    const Model = modelFromZod(schema, { name: 'EnumModel_Test' })
    expect(Model).toBeDefined()
  })

  it('should handle int type', () => {
    const schema = z
      .object({
        count: z.number().int(),
      })
      .describe('IntModel: test')

    const Model = modelFromZod(schema, { name: 'IntModel_Test' })
    expect(Model).toBeDefined()
  })

  it('should cache generated classes for same schema', () => {
    const schema = z
      .object({
        id: z.string(),
      })
      .describe('CachedModel: test')

    const Model1 = modelFromZod(schema, { name: 'CachedModel_Test' })
    const Model2 = modelFromZod(schema, { name: 'CachedModel_Test' })
    expect(Model1).toBe(Model2)
  })

  it('should not share cached classes across input and output directions', () => {
    const schema = z
      .object({
        id: z.string(),
      })
      .describe('CrossDirectionModel: test')

    const noop: ClassDecorator = () => {
      /* no-op */
    }

    // Verify these are empty to start with so we can verify the test worked.
    expect(_getCachedClass(schema, 'output')).toBeUndefined()
    expect(_getCachedClass(schema, 'input')).toBeUndefined()

    const OutputModel = modelFromZodBase(schema, { name: 'CrossDirection_Out' }, noop, 'output')
    const InputModel = modelFromZodBase(schema, { name: 'CrossDirection_In' }, noop, 'input')

    expect(OutputModel).not.toBe(InputModel)
    expect(_getCachedClass(schema, 'output')).toBe(OutputModel)
    expect(_getCachedClass(schema, 'input')).toBe(InputModel)

    // Re-issuing under the same direction still hits the cache.
    const OutputAgain = modelFromZodBase(schema, { name: 'CrossDirection_Out' }, noop, 'output')
    expect(OutputAgain).toBe(OutputModel)

    const InputAgain = modelFromZodBase(schema, { name: 'CrossDirection_In' }, noop, 'input')
    expect(InputAgain).toBe(InputModel)
  })

  it('should respect safe parse option', () => {
    const schema = z
      .object({
        name: z.string(),
      })
      .describe('SafeModel: test')

    const Model = modelFromZod(schema, {
      name: 'SafeModel_Test',
      safe: true,
      doNotThrow: true,
    })
    const instance = new Model()
    instance.name = 42 as unknown as string
    expect(instance.name).toBeUndefined()
  })

  it('should throw when modelFromZodBase recursion exceeds MAX_ZOD_DEPTH', () => {
    // Each invocation returns a freshly-constructed ZodObject, so the
    // identity-keyed class cache never hits — the depth counter is the
    // only thing protecting us from a stack overflow.
    function makeFreshObject(): any {
      return z.object({
        nested: z.lazy(() => makeFreshObject()),
      })
    }
    const infiniteLoop = makeFreshObject()
    const noop: ClassDecorator = () => {
      /* no-op */
    }

    // Verify these are empty to start with so we can verify the test worked.
    expect(_getModelFromZodDepth()).toBe(0)
    expect(_getCachedClass(infiniteLoop, 'output')).toBeUndefined()

    expect(() =>
      modelFromZodBase(
        infiniteLoop,
        { name: 'InfiniteLoop', getDecorator: () => noop },
        noop,
        'output',
      ),
    ).toThrow(/MAX_ZOD_DEPTH/)

    // Verify the `finally` block in every recursion frame has run, restoring
    // the counter to baseline. A leak here would silently push subsequent
    // calls to also fail for no good reason.
    expect(_getModelFromZodDepth()).toBe(0)

    // The inner try/catch around parseShape must have evicted the root
    // schema during the error unwind. Otherwise a retry would silently
    // pick up the half-built class instead of re-attempting.
    expect(_getCachedClass(infiniteLoop, 'output')).toBeUndefined()
  })

  it('should handle a recursive ZodObject via z.lazy without stack-overflow', () => {
    type SelfType = { id: string; children: SelfType[] }
    const Self: z.ZodType<SelfType> = z
      .object({
        id: z.string(),
        get children() {
          return z.array(z.lazy(() => Self))
        },
      })
      .describe('Self: a recursive node') as z.ZodType<SelfType>

    // Verify these are empty to start with so we can verify the test worked.
    expect(_getModelFromZodDepth()).toBe(0)
    expect(_getCachedClass(Self, 'output')).toBeUndefined()

    const Model = modelFromZod(Self as any, { name: 'Self' })
    expect(Model).toBeDefined()
    expect(typeof Model).toBe('function')

    // After a successful nested build, the counter must be fully restored
    // and the root schema must be in the cache (this is what allowed the
    // recursive `z.lazy(() => Self)` reference to terminate during the build).
    expect(_getModelFromZodDepth()).toBe(0)
    expect(_getCachedClass(Self, 'output')).toBe(Model)
  })
})
