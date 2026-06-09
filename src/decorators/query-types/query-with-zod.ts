import { Query, QueryOptions as QO } from '@nestjs/graphql'

import { describeZodSchema } from '../../helpers/describe-zod-schema'
import { type ElementOf, MethodWithZod, type ZodObjectOrArray } from '../common'

import type { $ZodObject } from 'zod/v4/core'
import type { IModelFromZodOptions } from '../../model-from-zod'

/**
 * Options for {@link QueryWithZod}, mirroring `@nestjs/graphql`'s {@link QO} (a discriminated union
 * over `nullable: true | false | NullableList`) plus the library-specific `zod` field for model
 * creation.
 *
 * Expressed as a type intersection so the union is preserved and TypeScript still narrows
 * `defaultValue` based on the `nullable` member.
 */
export type QueryOptions<T extends $ZodObject> = QO & {
  /**
   * Options for model creation from `zod`.
   *
   * @memberof QueryOptions
   * @type {IModelFromZodOptions<T>}
   */
  zod?: IModelFromZodOptions<T>
}

/**
 * Query handler (method) Decorator. Routes specified query to this method.
 *
 * Uses a `zod` object or a `zod` array of objects (for list return types).
 *
 * @template T The type of the zod object or array input.
 * @param {T} input The zod input object or array.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function QueryWithZod<T extends ZodObjectOrArray>(input: T): MethodDecorator

/**
 * Query handler (method) Decorator. Routes specified query to this method.
 *
 * Uses a `zod` object or a `zod` array of objects (for list return types).
 *
 * @template T The type of the zod object or array input.
 * @param {T} input The zod input object or array.
 * @param {string} name The name of the method.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function QueryWithZod<T extends ZodObjectOrArray>(input: T, name: string): MethodDecorator

/**
 * Query handler (method) Decorator. Routes specified query to this method.
 *
 * Uses a `zod` object or a `zod` array of objects (for list return types).
 *
 * @template T The type of the zod object or array input.
 * @param {T} input The zod input object or array.
 * @param {QueryOptions<ElementOf<T> & $ZodObject>} options The options for query.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function QueryWithZod<T extends ZodObjectOrArray>(
  input: T,
  options: QueryOptions<ElementOf<T> & $ZodObject>,
): MethodDecorator

export function QueryWithZod<T extends ZodObjectOrArray>(
  input: T,
  nameOrOptions?: string | QueryOptions<ElementOf<T> & $ZodObject>,
) {
  try {
    return MethodWithZod(input, nameOrOptions, Query)
  } catch (err) {
    const zodName = typeof nameOrOptions === 'object' ? nameOrOptions?.zod?.name : undefined
    throw new Error(`QueryWithZod failed${describeZodSchema(input, zodName)}`, { cause: err })
  }
}
