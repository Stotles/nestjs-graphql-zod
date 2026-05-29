import 'reflect-metadata'
import { describe, it, expect, expectTypeOf } from 'vitest'
import { z } from 'zod'

import type { QueryOptions } from '../../src/decorators/query-types/query-with-zod'
import type { MutationOptions } from '../../src/decorators/query-types/mutation-with-zod'
import type { SubscriptionOptions } from '../../src/decorators/query-types/subscription-with-zod'
import type { IModelFromZodOptions } from '../../src/model-from-zod'

const sampleSchema = z.object({ name: z.string() })
type SampleSchema = typeof sampleSchema

describe('QueryOptions / MutationOptions / SubscriptionOptions', () => {
  describe('shared BaseTypeOptions surface', () => {
    it('should accept nullable: false alongside the zod model options', () => {
      const opts: QueryOptions<SampleSchema> = {
        nullable: false,
        description: 'a query',
        zod: { name: 'Sample' },
      }
      expect(opts.nullable).toBe(false)
    })

    it('should accept nullable: true with defaultValue: null', () => {
      // BaseTypeOptions discriminates on `nullable: true` to allow null defaults.
      const opts: QueryOptions<SampleSchema> = {
        nullable: true,
        defaultValue: null,
      }
      expect(opts.nullable).toBe(true)
      expect(opts.defaultValue).toBeNull()
    })

    it('should accept the NullableList literals on nullable', () => {
      const items: MutationOptions<SampleSchema> = { nullable: 'items' }
      const both: MutationOptions<SampleSchema> = { nullable: 'itemsAndList' }
      expect(items.nullable).toBe('items')
      expect(both.nullable).toBe('itemsAndList')
    })

    it('should preserve the BaseTypeOptions discriminated union', () => {
      // Check the upstream `nullable: true | (false | NullableList)` union
      // survives this wrapper type without being flattened into a single type.
      type WithNullableTrue = Extract<QueryOptions<SampleSchema>, { nullable: true }>
      type WithoutNullable = Exclude<QueryOptions<SampleSchema>, { nullable: true }>

      expectTypeOf<WithNullableTrue['nullable']>().toEqualTypeOf<true>()
      expectTypeOf<WithoutNullable['nullable']>().toEqualTypeOf<
        false | 'items' | 'itemsAndList' | undefined
      >()
    })
  })

  describe('zod model-options field', () => {
    it('should type the zod field as IModelFromZodOptions<T>', () => {
      type ZodField = NonNullable<QueryOptions<SampleSchema>['zod']>
      expectTypeOf<ZodField>().toEqualTypeOf<IModelFromZodOptions<SampleSchema>>()
    })

    it('should type the zod field on MutationOptions identically to QueryOptions', () => {
      type Q = NonNullable<QueryOptions<SampleSchema>['zod']>
      type M = NonNullable<MutationOptions<SampleSchema>['zod']>
      expectTypeOf<M>().toEqualTypeOf<Q>()
    })

    it('should type the zod field on SubscriptionOptions identically to QueryOptions', () => {
      type Q = NonNullable<QueryOptions<SampleSchema>['zod']>
      type S = NonNullable<SubscriptionOptions<SampleSchema>['zod']>
      expectTypeOf<S>().toEqualTypeOf<Q>()
    })
  })

  describe('SubscriptionOptions extras', () => {
    it('should accept filter and resolve callbacks', () => {
      const opts: SubscriptionOptions<SampleSchema> = {
        filter: (payload, variables) => Boolean(payload && variables),
        resolve: (payload) => payload,
      }
      expect(typeof opts.filter).toBe('function')
      expect(typeof opts.resolve).toBe('function')
    })
  })
})
