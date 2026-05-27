import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { Int } from '@nestjs/graphql'
import { getFieldInfoFromZod } from '../../src/helpers/get-field-info-from-zod'

describe('canParse', () => {
  // `canParse` is a static predicate and does not depend on direction.
  it('should return true for supported types', () => {
    expect(getFieldInfoFromZod.canParse(z.string())).toBe(true)
    expect(getFieldInfoFromZod.canParse(z.number())).toBe(true)
    expect(getFieldInfoFromZod.canParse(z.boolean())).toBe(true)
    expect(getFieldInfoFromZod.canParse(z.object({}))).toBe(true)
    expect(getFieldInfoFromZod.canParse(z.array(z.string()))).toBe(true)
    expect(getFieldInfoFromZod.canParse(z.string().optional())).toBe(true)
    expect(getFieldInfoFromZod.canParse(z.string().nullable())).toBe(true)
    expect(getFieldInfoFromZod.canParse(z.string().default('x'))).toBe(true)
    expect(getFieldInfoFromZod.canParse(z.enum(['a', 'b']))).toBe(true)
    expect(getFieldInfoFromZod.canParse(z.uuid())).toBe(true)
    expect(getFieldInfoFromZod.canParse(z.email())).toBe(true)
    expect(getFieldInfoFromZod.canParse(z.url())).toBe(true)
    expect(getFieldInfoFromZod.canParse(z.iso.datetime())).toBe(true)
    expect(getFieldInfoFromZod.canParse(z.string().readonly())).toBe(true)
    expect(getFieldInfoFromZod.canParse(z.string().prefault('x'))).toBe(true)
    expect(getFieldInfoFromZod.canParse(z.lazy(() => z.string()))).toBe(true)
    expect(getFieldInfoFromZod.canParse(z.string().optional().nonoptional())).toBe(true)
  })

  it('should return false for unsupported types', () => {
    expect(getFieldInfoFromZod.canParse(z.unknown())).toBe(false)
    expect(getFieldInfoFromZod.canParse(z.any())).toBe(false)
    expect(getFieldInfoFromZod.canParse(z.void())).toBe(false)
    expect(getFieldInfoFromZod.canParse(z.never())).toBe(false)
  })
})

describe('getFieldInfoFromZod', () => {
  const defaultOptions = { name: 'TestModel' }

  describe.each(['input', 'output'] as const)(
    'direction independent tests, %s direction',
    (direction) => {
      describe('primitive types', () => {
        it('should handle ZodString', () => {
          const info = getFieldInfoFromZod('name', z.string(), defaultOptions, direction)
          expect(info.type).toBe(String)
          expect(info.isOptional).toBe(false)
          expect(info.isNullable).toBe(false)
        })

        it('should handle ZodNumber', () => {
          const info = getFieldInfoFromZod('count', z.number(), defaultOptions, direction)
          expect(info.type).toBe(Number)
          expect(info.isOptional).toBe(false)
          expect(info.isNullable).toBe(false)
        })

        it('should detect int as Int type', () => {
          const info = getFieldInfoFromZod('count', z.number().int(), defaultOptions, direction)
          expect(info.type).toBe(Int)
        })

        it('should handle ZodBoolean', () => {
          const info = getFieldInfoFromZod('active', z.boolean(), defaultOptions, direction)
          expect(info.type).toBe(Boolean)
          expect(info.isOptional).toBe(false)
        })
      })

      describe('optional and nullable', () => {
        it('should detect optional', () => {
          const info = getFieldInfoFromZod('name', z.string().optional(), defaultOptions, direction)
          expect(info.type).toBe(String)
          expect(info.isOptional).toBe(true)
        })

        it('should detect nullable', () => {
          const info = getFieldInfoFromZod('name', z.string().nullable(), defaultOptions, direction)
          expect(info.type).toBe(String)
          expect(info.isOptional).toBe(false)
          expect(info.isNullable).toBe(true)
        })
      })

      describe('arrays', () => {
        it('should handle array of strings', () => {
          const info = getFieldInfoFromZod('tags', z.array(z.string()), defaultOptions, direction)
          expect(info.isOfArray).toBe(true)
          expect(Array.isArray(info.type)).toBe(true)
          expect(info.type[0]).toBe(String)
        })

        it('should handle optional array', () => {
          const info = getFieldInfoFromZod(
            'tags',
            z.array(z.string()).optional(),
            defaultOptions,
            direction,
          )
          expect(info.isOfArray).toBe(true)
          expect(info.isOptional).toBe(true)
        })

        it('should detect nullable items in array', () => {
          const info = getFieldInfoFromZod(
            'tags',
            z.array(z.string().nullable()),
            defaultOptions,
            direction,
          )
          expect(info.isOfArray).toBe(true)
          expect(info.isItemNullable).toBe(true)
        })
      })

      describe('enums', () => {
        it('should handle ZodEnum', () => {
          const info = getFieldInfoFromZod(
            'status',
            z.enum(['active', 'inactive']),
            defaultOptions,
            direction,
          )
          expect(info.isEnum).toBe(true)
        })
      })

      describe('defaults', () => {
        it('should unwrap ZodDefault', () => {
          const info = getFieldInfoFromZod(
            'name',
            z.string().default('hello'),
            defaultOptions,
            direction,
          )
          expect(info.type).toBe(String)
        })
      })

      describe('zod v4 string formats', () => {
        // In Zod v4, z.uuid()/z.email()/etc. are no longer ZodString — they are
        // their own classes (ZodUUID, ZodEmail...) that share ZodStringFormat as
        // a common base. They should still map to GraphQL's String type.
        const cases: Array<[string, () => any]> = [
          ['uuid', () => z.uuid()],
          ['email', () => z.email()],
          ['url', () => z.url()],
          ['cuid', () => z.cuid()],
          ['cuid2', () => z.cuid2()],
          ['ulid', () => z.ulid()],
          ['nanoid', () => z.nanoid()],
          ['base64', () => z.base64()],
          ['ipv4', () => z.ipv4()],
          ['ipv6', () => z.ipv6()],
          ['jwt', () => z.jwt()],
          ['emoji', () => z.emoji()],
          ['iso.date', () => z.iso.date()],
          ['iso.datetime', () => z.iso.datetime()],
        ]

        for (const [name, build] of cases) {
          it(`should treat z.${name}() as String`, () => {
            const info = getFieldInfoFromZod('field', build(), defaultOptions, direction)
            expect(info.type).toBe(String)
            expect(info.isOptional).toBe(false)
            expect(info.isNullable).toBe(false)
          })
        }

        it('should preserve optional through string-format types', () => {
          const info = getFieldInfoFromZod('field', z.email().optional(), defaultOptions, direction)
          expect(info.type).toBe(String)
          expect(info.isOptional).toBe(true)
        })

        it('should preserve nullable through string-format types', () => {
          const info = getFieldInfoFromZod('field', z.uuid().nullable(), defaultOptions, direction)
          expect(info.type).toBe(String)
          expect(info.isNullable).toBe(true)
        })

        it('should handle arrays of string-format types', () => {
          const info = getFieldInfoFromZod('ids', z.array(z.uuid()), defaultOptions, direction)
          expect(info.isOfArray).toBe(true)
          expect(info.type[0]).toBe(String)
        })
      })

      describe('zod v4 number formats', () => {
        const cases: Array<[string, () => any, any]> = [
          ['int', () => z.int(), Int],
          ['int32', () => z.int32(), Int],
          ['uint32', () => z.uint32(), Number], // GraphQL Int is signed, so should not use Int here
          ['float32', () => z.float32(), Number],
          ['float64', () => z.float64(), Number],
        ]

        for (const [name, build, expected] of cases) {
          it(`should map z.${name}() to ${expected === Int ? 'Int' : 'Number'}`, () => {
            const info = getFieldInfoFromZod('field', build(), defaultOptions, direction)
            expect(info.type).toBe(expected)
          })
        }
      })

      describe('zod v4 wrappers', () => {
        it('should unwrap ZodReadonly', () => {
          const info = getFieldInfoFromZod('name', z.string().readonly(), defaultOptions, direction)
          expect(info.type).toBe(String)
          expect(info.isOptional).toBe(false)
          expect(info.isNullable).toBe(false)
        })

        it('should unwrap ZodPrefault', () => {
          const info = getFieldInfoFromZod(
            'name',
            z.string().prefault('hi'),
            defaultOptions,
            direction,
          )
          expect(info.type).toBe(String)
          expect(info.isOptional).toBe(false)
        })

        it('should unwrap ZodLazy', () => {
          const info = getFieldInfoFromZod(
            'name',
            z.lazy(() => z.string()),
            defaultOptions,
            direction,
          )
          expect(info.type).toBe(String)
        })

        it('should resolve ZodLazy that returns a number', () => {
          const info = getFieldInfoFromZod(
            'count',
            z.lazy(() => z.number()),
            defaultOptions,
            direction,
          )
          expect(info.type).toBe(Number)
        })

        it('should throw when ZodLazy getter is not a function', () => {
          const broken = z.lazy(() => z.string())
          ;(broken as any)._def.getter = null
          expect(() => getFieldInfoFromZod('name', broken, defaultOptions, direction)).toThrow(
            /ZodLazy.*getter is not a function/,
          )
        })

        it('should throw when ZodLazy getter does not return a ZodType', () => {
          const broken = z.lazy(() => z.string())
          ;(broken as any)._def.getter = () => 'not-a-zod-type'
          expect(() => getFieldInfoFromZod('name', broken, defaultOptions, direction)).toThrow(
            /ZodLazy.*did not return a valid ZodType/,
          )
        })

        it('should handle a recursive ZodLazy without stack-overflow', () => {
          // Self-referential lazy at a field position (not wrapped in a
          // ZodObject) — modelFromZodBase's class cache never sees it, so the
          // depth cap here is the only safeguard against stack overflow.
          let self: z.ZodType
          self = z.lazy(() => self)
          expect(() => getFieldInfoFromZod('cycle', self, defaultOptions, direction)).toThrow(
            /MAX_ZOD_DEPTH/,
          )
        })

        it('should unwrap ZodNonOptional and clear isOptional', () => {
          const info = getFieldInfoFromZod(
            'name',
            z.string().optional().nonoptional(),
            defaultOptions,
            direction,
          )
          expect(info.type).toBe(String)
          expect(info.isOptional).toBe(false)
        })

        it('should follow Optional through ZodReadonly', () => {
          const info = getFieldInfoFromZod(
            'name',
            z.string().readonly().optional(),
            defaultOptions,
            direction,
          )
          expect(info.type).toBe(String)
          expect(info.isOptional).toBe(true)
        })

        it('should follow Nullable through ZodPrefault', () => {
          const info = getFieldInfoFromZod(
            'name',
            z.string().prefault('hi').nullable(),
            defaultOptions,
            direction,
          )
          expect(info.type).toBe(String)
          expect(info.isNullable).toBe(true)
        })

        it('should detect Int through ZodReadonly', () => {
          const info = getFieldInfoFromZod('count', z.int().readonly(), defaultOptions, direction)
          expect(info.type).toBe(Int)
        })
      })

      describe('forced graphql type', () => {
        it('should let the override pick a different type than the schema implies', () => {
          // The schema is a string, but the meta says treat it as Int — the meta wins.
          const schema = z
            .string()
            .meta({ graphqlTypeInput: () => Int, graphqlTypeOutput: () => Int })
          const info = getFieldInfoFromZod('count', schema, defaultOptions, direction)
          expect(info.type).toBe(Int)
        })

        it('should allow a transform to work with graphql', () => {
          // A bare `.transform()` is otherwise opaque on output; the meta tells
          // the library exactly what GraphQL type to use without needing `.pipe()`.
          // Not setting graphqlTypeInput on purpose since that should be automatically inferred
          const schema = z
            .string()
            .transform((val) => val.toUpperCase())
            .meta({ graphqlTypeOutput: () => String })
          const info = getFieldInfoFromZod('name', schema, defaultOptions, direction)
          expect(info.type).toBe(String)
        })

        it('should ensure nullable is respected with graphqlType override', () => {
          const schema = z.coerce
            .string()
            .transform((date) => (date ? new Date(date).toISOString() : null))
            .nullable()
            .meta({ graphqlTypeOutput: () => String })
          const info = getFieldInfoFromZod('createdAt', schema, defaultOptions, direction)
          expect(info.type).toBe(String)
          expect(info.isNullable).toBe(true)
        })

        it('should mark canParse=true for schemas with a graphqlType meta', () => {
          const schema = z
            .unknown()
            .meta({ graphqlTypeInput: () => String, graphqlTypeOutput: () => String })
          const info = getFieldInfoFromZod('field', schema, defaultOptions, direction)
          expect(info.type).toBe(String)
          expect(getFieldInfoFromZod.canParse(schema)).toBe(true)
        })

        it('should work with preprocess + transform when the meta is present', () => {
          const schema = z
            .preprocess((val) => String(val), z.string())
            .transform((str) => str.toUpperCase())
            .meta({ graphqlTypeInput: () => String, graphqlTypeOutput: () => String })
          const info = getFieldInfoFromZod('field', schema, defaultOptions, direction)
          expect(info.type).toBe(String)
        })

        it('should handle an async transform with a graphqlType meta', () => {
          // zod's `safeParse` throws `$ZodAsyncError` when the schema produces a
          // Promise (an async transform/refine).
          // `isOptional`/`isNullable` probes the schema with `undefined`/`null`,
          // which would throw but we need to ensure is being handled gracefully
          // as otherwise the graphql schema will not be generated.
          const schema = z
            .any()
            .transform(async (val) => val)
            .meta({ graphqlTypeInput: () => String, graphqlTypeOutput: () => String })
          const info = getFieldInfoFromZod('field', schema, defaultOptions, direction)
          expect(info.type).toBe(String)
          expect(info.isOptional).toBe(false)
          expect(info.isNullable).toBe(false)
        })
      })
    },
  )

  describe('direction dependent tests', () => {
    describe('input direction', () => {
      describe('nested objects', () => {
        it('should throw a nested ZodObject without a getDecorator', () => {
          const inner = z.object({ city: z.string() })
          expect(() => getFieldInfoFromZod('address', inner, defaultOptions, 'input')).toThrow(
            /no `getDecorator` was provided/,
          )
        })
      })

      describe('pipes and transforms', () => {
        it('should handle a bare .transform()', () => {
          const schema = z.string().transform((val) => val.toUpperCase())
          const info = getFieldInfoFromZod('name', schema, defaultOptions, 'input')
          expect(info.type).toBe(String)
        })

        it('should handle a string→number coercion pipe', () => {
          // The schema produces a number, but the client sends a string —
          // the GraphQL field type must match what the client sends.
          const schema = z
            .string()
            .transform((s) => Number(s))
            .pipe(z.number())
          const info = getFieldInfoFromZod('count', schema, defaultOptions, 'input')
          expect(info.type).toBe(String)
        })

        it('should handle a string piped into a z.transform()', () => {
          const schema = z.string().pipe(z.transform((val) => val.length))
          const info = getFieldInfoFromZod('length', schema, defaultOptions, 'input')
          expect(info.type).toBe(String)
        })

        it('should throw z.preprocess() with an inner schema', () => {
          // z.preprocess(fn, schema) is a ZodPipe whose `_def.in` is the
          // preprocess ZodTransform and `_def.out` is the real schema. The
          // input side has no expressible type at runtime — force the user to
          // declare it with `.pipe(z.X)` rather than guessing.
          const schema = z.preprocess(
            (val) => (typeof val === 'number' ? String(val) : val),
            z.enum(['SUCCESS', 'FAILED']),
          )
          expect(() => getFieldInfoFromZod('status', schema, defaultOptions, 'input')).toThrow(
            /input side of this ZodPipe is a ZodTransform/,
          )
        })
      })
    })

    describe('output direction', () => {
      describe('nested objects', () => {
        it('should handle a nested ZodObject without a getDecorator', () => {
          // The output direction's no-getDecorator path falls back to
          // `@ObjectType` via `modelFromZod`. Input-side nested objects must
          // supply a `getDecorator`; that is exercised via `InputTypeWithZod`.
          const inner = z.object({ city: z.string() })
          const info = getFieldInfoFromZod('address', inner, defaultOptions, 'output')
          expect(info.isType).toBe(true)
          expect(typeof info.type).toBe('function')
        })
      })

      describe('pipes and transforms', () => {
        it('should throw a bare .transform()', () => {
          // The transform's output type is opaque at runtime; force the user
          // to declare it with `.pipe(z.X)` rather than guessing.
          const schema = z.string().transform((val) => val.toUpperCase())
          expect(() => getFieldInfoFromZod('name', schema, defaultOptions, 'output')).toThrow(
            /output side of this ZodPipe is a ZodTransform/,
          )
        })

        it('should handle a string→number coercion pipe', () => {
          // The schema produces a number; for response types the GraphQL field
          // must match the value the resolver returns, not what the client sends.
          const schema = z
            .string()
            .transform((s) => Number(s))
            .pipe(z.number())
          const info = getFieldInfoFromZod('count', schema, defaultOptions, 'output')
          expect(info.type).toBe(Number)
        })

        it('should throw an error when a string is piped into a z.transform()', () => {
          const schema = z.string().pipe(z.transform((val) => val.length))
          expect(() => getFieldInfoFromZod('length', schema, defaultOptions, 'output')).toThrow(
            /output side of this ZodPipe is a ZodTransform/,
          )
        })

        it('should handle z.preprocess() with an inner schema', () => {
          const schema = z.preprocess(
            (val) => (typeof val === 'number' ? String(val) : val),
            z.enum(['SUCCESS', 'FAILED']),
          )
          const info = getFieldInfoFromZod('status', schema, defaultOptions, 'output')
          expect(info.isEnum).toBe(true)
        })
      })
    })
  })
})
