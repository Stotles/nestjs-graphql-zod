import { Query, QueryOptions as QO } from '@nestjs/graphql'

import { describeZodSchema } from '../../helpers/describe-zod-schema'
import { MethodWithZod } from '../common'

import type { ZodObject } from 'zod'
import type { IModelFromZodOptions } from '../../model-from-zod'

/**
 * Options for {@link QueryWithZod}, mirroring `@nestjs/graphql`'s {@link QO} (a discriminated union
 * over `nullable: true | false | NullableList`) plus the library-specific `zod` field for model
 * creation.
 *
 * Expressed as a type intersection so the union is preserved and TypeScript still narrows
 * `defaultValue` based on the `nullable` member.
 */
export type QueryOptions<T extends ZodObject> = QO & {
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
 * Uses a `zod` object.
 *
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function QueryWithZod<T extends ZodObject>(input: T): MethodDecorator

/**
 * Query handler (method) Decorator. Routes specified query to this method.
 *
 * Uses a `zod` object.
 *
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @param {string} name The name of the method.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function QueryWithZod<T extends ZodObject>(input: T, name: string): MethodDecorator

/**
 * Query handler (method) Decorator. Routes specified query to this method.
 *
 * Uses a `zod` object.
 *
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @param {QueryOptions<T>} options The options for query.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function QueryWithZod<T extends ZodObject>(
  input: T,
  options: QueryOptions<T>,
): MethodDecorator

export function QueryWithZod<T extends ZodObject>(
  input: T,
  nameOrOptions?: string | QueryOptions<T>,
) {
  try {
    return MethodWithZod(input, nameOrOptions, Query)
  } catch (err) {
    const zodName = typeof nameOrOptions === 'object' ? nameOrOptions?.zod?.name : undefined
    throw new Error(`QueryWithZod failed${describeZodSchema(input, zodName)}`, { cause: err })
  }
}
