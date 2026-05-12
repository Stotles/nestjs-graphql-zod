import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { describeZodSchema } from '../../src/helpers/describe-zod-schema'

describe('describeZodSchema', () => {
  it('returns an empty string when neither name nor description is available', () => {
    expect(describeZodSchema(z.string())).toBe('')
  })

  it('uses an explicit name when provided', () => {
    expect(describeZodSchema(z.string(), 'MyName')).toBe(" for zod schema 'MyName'")
  })

  it('falls back to the schema description when no explicit name is given', () => {
    const schema = z.string().describe('A user input')
    expect(describeZodSchema(schema)).toBe(" for zod schema 'A user input'")
  })

  it('prefers an explicit name over the schema description', () => {
    const schema = z.string().describe('A user input')
    expect(describeZodSchema(schema, 'Override')).toBe(" for zod schema 'Override'")
  })

  it('works for object schemas with descriptions', () => {
    const schema = z.object({ x: z.string() }).describe('Outer: an outer object')
    expect(describeZodSchema(schema)).toBe(" for zod schema 'Outer: an outer object'")
  })
})
