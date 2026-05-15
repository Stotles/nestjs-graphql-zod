import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { getZodObjectName } from '../../src/helpers/get-zod-object-name'

describe('getZodObjectName', () => {
  describe.each([
    'input',
    'output',
  ] as const)('direction independent tests, %s direction', (direction) => {
    it('should return "String" for ZodString', () => {
      expect(getZodObjectName(z.string(), direction)).toBe('String')
    })

    it('should return "Number" for ZodNumber', () => {
      expect(getZodObjectName(z.number(), direction)).toBe('Number')
    })

    it('should return "Boolean" for ZodBoolean', () => {
      expect(getZodObjectName(z.boolean(), direction)).toBe('Boolean')
    })

    it('should return "BigInt" for ZodBigInt', () => {
      expect(getZodObjectName(z.bigint(), direction)).toBe('BigInt')
    })

    it('should return "Date" for ZodDate', () => {
      expect(getZodObjectName(z.date(), direction)).toBe('Date')
    })

    it('should return "Any" for ZodAny', () => {
      expect(getZodObjectName(z.any(), direction)).toBe('Any')
    })

    it('should return "Null" for ZodNull', () => {
      expect(getZodObjectName(z.null(), direction)).toBe('Null')
    })

    it('should return "Array<String>" for array of strings', () => {
      expect(getZodObjectName(z.array(z.string()), direction)).toBe('Array<String>')
    })

    it('should return "Optional<String>" for optional string', () => {
      expect(getZodObjectName(z.string().optional(), direction)).toBe('Optional<String>')
    })

    it('should return "Nullable<String>" for nullable string', () => {
      expect(getZodObjectName(z.string().nullable(), direction)).toBe('Nullable<String>')
    })

    it('should return "Object" for object without description', () => {
      expect(getZodObjectName(z.object({ a: z.string() }), direction)).toBe('Object')
    })

    it('should extract name from object description', () => {
      const obj = z.object({ a: z.string() }).describe('MyType: a description')
      expect(getZodObjectName(obj, direction)).toBe('MyType')
    })

    it('should handle enum with values', () => {
      const name = getZodObjectName(z.enum(['foo', 'bar']), direction)
      expect(name).toBe('Enum<foo,bar>')
    })

    it('should handle enum with description name', () => {
      const name = getZodObjectName(z.enum(['foo', 'bar']).describe('Color: an enum'), direction)
      expect(name).toBe('Enum<Color>')
    })

    it('should unwrap default', () => {
      const name = getZodObjectName(z.string().default('hi'), direction)
      expect(name).toBe('String')
    })

    it('should handle record', () => {
      const name = getZodObjectName(z.record(z.string(), z.number()), direction)
      expect(name).toBe('Record<String, Number>')
    })

    it('should handle literal string', () => {
      const name = getZodObjectName(z.literal('hello'), direction)
      expect(name).toBe('Literal<String>')
    })

    it('should handle literal null', () => {
      const name = getZodObjectName(z.literal(null), direction)
      expect(name).toBe('Literal<Null>')
    })

    it('should handle union', () => {
      const name = getZodObjectName(z.union([z.string(), z.number()]), direction)
      expect(name).toBe('String | Number')
    })

    describe('zod v4 string-format types', () => {
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
        ['iso.datetime', () => z.iso.datetime()],
      ]

      for (const [name, build] of cases) {
        it(`should return "String" for z.${name}()`, () => {
          expect(getZodObjectName(build(), direction)).toBe('String')
        })
      }

      it('should return "Optional<String>" for an optional string-format type', () => {
        expect(getZodObjectName(z.email().optional(), direction)).toBe('Optional<String>')
      })

      it('should return "Array<String>" for an array of string-format types', () => {
        expect(getZodObjectName(z.array(z.uuid()), direction)).toBe('Array<String>')
      })
    })

    describe('zod v4 wrappers', () => {
      it('should resolve through ZodReadonly', () => {
        expect(getZodObjectName(z.string().readonly(), direction)).toBe('String')
      })

      it('should resolve through ZodPrefault', () => {
        expect(getZodObjectName(z.string().prefault('x'), direction)).toBe('String')
      })

      it('should resolve through ZodLazy', () => {
        expect(getZodObjectName(z.lazy(() => z.number()), direction)).toBe('Number')
      })

      it('should resolve through ZodNonOptional', () => {
        expect(getZodObjectName(z.string().nonoptional(), direction)).toBe('String')
      })

      it('should peel inner ZodOptional when wrapped by ZodNonOptional', () => {
        // z.string().optional().nonoptional() must not be reported as
        // Optional<String> — the outer .nonoptional() restores requiredness.
        expect(getZodObjectName(z.string().optional().nonoptional(), direction)).toBe('String')
      })

      it('should resolve nested wrappers (readonly + prefault)', () => {
        expect(getZodObjectName(z.string().prefault('x').readonly(), direction)).toBe('String')
      })
    })

    describe('cyclic ZodLazy', () => {
      it('should resolve a non-cyclic ZodLazy reused as siblings', () => {
        // Path-tracked, not history-tracked: a lazy appearing twice in
        // sibling positions is not a cycle and must resolve on both visits.
        const shared = z.lazy(() => z.string())
        expect(getZodObjectName(z.union([shared, shared]), direction)).toBe('String | String')
      })

      it('should return "Unknown" on a self-referential ZodLazy cycle', () => {
        let self: z.ZodType
        self = z.lazy(() => self)
        expect(getZodObjectName(self, direction)).toBe('Unknown')
      })

      it('should return "Unknown" on mutually recursive ZodLazy schemas', () => {
        let a: z.ZodType, b: z.ZodType
        a = z.lazy(() => b)
        b = z.lazy(() => a)
        expect(getZodObjectName(a, direction)).toBe('Unknown')
      })

      it('should handle a recursive ZodLazy without stack-overflow', () => {
        // Each getter() call produces a brand-new ZodLazy, so the visited Set
        // never trips — the depth cap is the only thing protecting us.
        function infiniteLoop(): z.ZodType {
          return z.lazy(() => infiniteLoop())
        }
        expect(() => getZodObjectName(infiniteLoop(), direction)).toThrow(/MAX_ZOD_DEPTH/)
      })
    })

    it('should return "Unknown" for unrecognized types', () => {
      expect(getZodObjectName(z.unknown(), direction)).toBe('Unknown')
    })

    // Doesn't need to be a test with .meta({ graphqlType<direction> }) since this function
    // shouldn't be called at all when that hint is present
    it('should throw in both directions due to preprocess & transform', () => {
      const schema = z.preprocess((val) => String(val), z.string()).transform((str) => str.toUpperCase())
      expect(() => getZodObjectName(schema, direction)).toThrow()
    })
  })

  describe('direction dependent tests', () => {
    describe('input direction', () => {
      it('should resolve a string→number pipe to String on input', () => {
        const schema = z.string().transform((s) => Number(s)).pipe(z.number())
        expect(getZodObjectName(schema, 'input')).toBe('String')
      })

      it('should handle pipe/transform by unwrapping to the input type', () => {
        const schema = z.string().transform(val => val.length)
        expect(getZodObjectName(schema, 'input')).toBe('String')
      })

      it('should throw on z.preprocess() (preprocess transform is on the input side)', () => {
        const schema = z.preprocess(
          (val) => (typeof val === 'number' ? String(val) : val),
          z.enum(['SUCCESS', 'FAILED']).describe('Result: a result enum'),
        )
        expect(() => getZodObjectName(schema, 'input'))
          .toThrow(/input side of this ZodPipe is a ZodTransform/)
      })

      it('should handle pipe/transform by unwrapping to the input type', () => {
        const schema = z.string().pipe(z.transform(val => val.length))
        expect(getZodObjectName(schema, 'input')).toBe('String')
      })
    })

    describe("output direction", () => {
      it('should resolve a string→number pipe to Number on output', () => {
        const schema = z.string().transform((s) => Number(s)).pipe(z.number())
        expect(getZodObjectName(schema, 'output')).toBe('Number')
      })

      it('should throw on a bare .transform(fn) in the output direction', () => {
        const schema = z.string().transform(val => val.length)
        expect(() => getZodObjectName(schema, 'output'))
          .toThrow(/output side of this ZodPipe is a ZodTransform/)
      })

      it('should resolve z.preprocess() to the wrapped schema on output', () => {
        const schema = z.preprocess(
          (val) => (typeof val === 'number' ? String(val) : val),
          z.enum(['SUCCESS', 'FAILED']).describe('Result: a result enum'),
        )
        expect(getZodObjectName(schema, 'output')).toBe('Enum<Result>')
      })

      it('should throw when output side is a ZodTransform', () => {
        const schema = z.string().pipe(z.transform(val => val.length))
        expect(() => getZodObjectName(schema, 'output'))
          .toThrow(/output side of this ZodPipe is a ZodTransform/)
      })
    })
  })
})
