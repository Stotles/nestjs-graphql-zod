import { Query, QueryOptions as QO } from '@nestjs/graphql'

import { describeZodSchema } from '../../helpers/describe-zod-schema'
import { MethodWithZod } from '../common'

import type { ZodObject } from 'zod'
import type { IModelFromZodOptions } from '../../model-from-zod'

export interface QueryOptions<T extends ZodObject> extends Omit<QO, never> {
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
  try {
    return MethodWithZod(input, nameOrOptions, Query)
  } catch (err) {
    const zodName = typeof nameOrOptions === 'object' ? nameOrOptions?.zod?.name : undefined
    throw new Error(`QueryWithZod failed${describeZodSchema(input, zodName)}`, { cause: err })
  }
}
