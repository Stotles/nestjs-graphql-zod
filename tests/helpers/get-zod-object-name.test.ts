import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { getZodObjectName } from '../../src/helpers/get-zod-object-name'

describe('getZodObjectName', () => {
  it('should return "String" for ZodString', () => {
    expect(getZodObjectName(z.string())).toBe('String')
  })

  it('should return "Number" for ZodNumber', () => {
    expect(getZodObjectName(z.number())).toBe('Number')
  })

  it('should return "Boolean" for ZodBoolean', () => {
    expect(getZodObjectName(z.boolean())).toBe('Boolean')
  })

  it('should return "BigInt" for ZodBigInt', () => {
    expect(getZodObjectName(z.bigint())).toBe('BigInt')
  })

  it('should return "Date" for ZodDate', () => {
    expect(getZodObjectName(z.date())).toBe('Date')
  })

  it('should return "Any" for ZodAny', () => {
    expect(getZodObjectName(z.any())).toBe('Any')
  })

  it('should return "Null" for ZodNull', () => {
    expect(getZodObjectName(z.null())).toBe('Null')
  })

  it('should return "Array<String>" for array of strings', () => {
    expect(getZodObjectName(z.array(z.string()))).toBe('Array<String>')
  })

  it('should return "Optional<String>" for optional string', () => {
    expect(getZodObjectName(z.string().optional())).toBe('Optional<String>')
  })

  it('should return "Nullable<String>" for nullable string', () => {
    expect(getZodObjectName(z.string().nullable())).toBe('Nullable<String>')
  })

  it('should return "Object" for object without description', () => {
    expect(getZodObjectName(z.object({ a: z.string() }))).toBe('Object')
  })

  it('should extract name from object description', () => {
    const obj = z.object({ a: z.string() }).describe('MyType: a description')
    expect(getZodObjectName(obj)).toBe('MyType')
  })

  it('should handle enum with values', () => {
    const name = getZodObjectName(z.enum(['foo', 'bar']))
    expect(name).toBe('Enum<foo,bar>')
  })

  it('should handle enum with description name', () => {
    const name = getZodObjectName(z.enum(['foo', 'bar']).describe('Color: an enum'))
    expect(name).toBe('Enum<Color>')
  })

  it('should unwrap default', () => {
    const name = getZodObjectName(z.string().default('hi'))
    expect(name).toBe('String')
  })

  it('should handle record', () => {
    const name = getZodObjectName(z.record(z.string(), z.number()))
    expect(name).toBe('Record<String, Number>')
  })

  it('should handle literal string', () => {
    const name = getZodObjectName(z.literal('hello'))
    expect(name).toBe('Literal<String>')
  })

  it('should handle literal null', () => {
    const name = getZodObjectName(z.literal(null))
    expect(name).toBe('Literal<Null>')
  })

  it('should handle union', () => {
    const name = getZodObjectName(z.union([z.string(), z.number()]))
    expect(name).toBe('String | Number')
  })

  it('should handle pipe/transform by unwrapping', () => {
    const name = getZodObjectName(z.string().transform(val => val.length))
    expect(name).toBe('String')
  })

  it('should follow non-transform pipes to their output', () => {
    // The pipe's `out` side here is a ZodNumber (not a ZodTransform), so the
    // resolved name should be the underlying scalar.
    const schema = z.string().transform((s) => Number(s)).pipe(z.number())
    expect(getZodObjectName(schema)).toBe('Number')
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
        expect(getZodObjectName(build())).toBe('String')
      })
    }

    it('should return "Optional<String>" for an optional string-format type', () => {
      expect(getZodObjectName(z.email().optional())).toBe('Optional<String>')
    })

    it('should return "Array<String>" for an array of string-format types', () => {
      expect(getZodObjectName(z.array(z.uuid()))).toBe('Array<String>')
    })
  })

  describe('zod v4 wrappers', () => {
    it('should resolve through ZodReadonly', () => {
      expect(getZodObjectName(z.string().readonly())).toBe('String')
    })

    it('should resolve through ZodCatch', () => {
      expect(getZodObjectName(z.string().catch('x'))).toBe('String')
    })

    it('should resolve through ZodPrefault', () => {
      expect(getZodObjectName(z.string().prefault('x'))).toBe('String')
    })

    it('should resolve through ZodLazy', () => {
      expect(getZodObjectName(z.lazy(() => z.number()))).toBe('Number')
    })

    it('should resolve through ZodNonOptional', () => {
      expect(getZodObjectName(z.string().optional().nonoptional())).toBe('String')
    })
  })

  it('should return "Unknown" for unrecognized types', () => {
    expect(getZodObjectName(z.unknown())).toBe('Unknown')
  })
})
