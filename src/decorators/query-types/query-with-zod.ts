import { Query, QueryOptions as QO } from '@nestjs/graphql'

import { MethodWithZod } from '../common'

import type { ZodObject } from 'zod'
import type { IModelFromZodOptions } from '../../model-from-zod'

/**
 * Options for {@link QueryWithZod}, mirroring `@nestjs/graphql`'s
 * {@link QO} (a discriminated union over `nullable: true | false |
 * NullableList`) plus the library-specific `zod` field for model creation.
 *
 * Expressed as a type intersection so the union is preserved and TypeScript
 * still narrows `defaultValue` based on the `nullable` member.
 */
export type QueryOptions<T extends ZodObject> = QO & {
  /**
   * Options for model creation from `zod`.
   *
   * @type {IModelFromZodOptions<T>}
   * @memberof QueryOptions
   */
  zod?: IModelFromZodOptions<T>
}

/**
 * Query handler (method) Decorator.
 * Routes specified query to this method.
 *
 * Uses a `zod` object.
 *
 * @export
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @return {MethodDecorator} A {@link MethodDecorator}.
 */
export function QueryWithZod<T extends ZodObject>(input: T): MethodDecorator

/**
 * Query handler (method) Decorator.
 * Routes specified query to this method.
 *
 * Uses a `zod` object.
 *
 * @export
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @param {string} name The name of the method.
 * @return {MethodDecorator} A {@link MethodDecorator}.
 */
export function QueryWithZod<T extends ZodObject>(input: T, name: string): MethodDecorator

/**
 * Query handler (method) Decorator.
 * Routes specified query to this method.
 *
 * Uses a `zod` object.
 *
 * @export
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @param {QueryOptions<T>} options The options for query.
 * @return {MethodDecorator} A {@link MethodDecorator}.
 */
export function QueryWithZod<T extends ZodObject>(input: T, options: QueryOptions<T>): MethodDecorator

export function QueryWithZod<T extends ZodObject>(input: T, nameOrOptions?: string | QueryOptions<T>) {
  return MethodWithZod(input, nameOrOptions, Query)
}
