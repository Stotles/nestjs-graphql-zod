import { Mutation, MutationOptions as MO } from '@nestjs/graphql'

import { describeZodSchema } from '../../helpers/describe-zod-schema'
import { MethodWithZod } from '../common'

import type { ZodObject } from 'zod'
import type { IModelFromZodOptions } from '../../model-from-zod'

export interface MutationOptions<T extends ZodObject> extends Omit<MO, never> {
  /**
   * Options for model creation from `zod`.
   *
   * @type {IModelFromZodOptions<T>}
   * @memberof QueryOptions
   */
  zod?: IModelFromZodOptions<T>
}

/**
 * Mutation handler (method) Decorator.
 * Routes specified mutation to this method.
 *
 * Uses a `zod` object.
 *
 * @export
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @return {MethodDecorator} A {@link MethodDecorator}.
 */
export function MutationWithZod<T extends ZodObject>(input: T): MethodDecorator

/**
 * Mutation handler (method) Decorator.
 * Routes specified mutation to this method.
 *
 * Uses a `zod` object.
 *
 * @export
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @param {string} name The name of the method.
 * @return {MethodDecorator} A {@link MethodDecorator}.
 */
export function MutationWithZod<T extends ZodObject>(input: T, name: string): MethodDecorator

/**
 * Mutation handler (method) Decorator.
 * Routes specified mutation to this method.
 *
 * Uses a `zod` object.
 *
 * @export
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @param {MutationOptions<T>} options The options for query method.
 * @return {MethodDecorator} A {@link MethodDecorator}.
 */
export function MutationWithZod<T extends ZodObject>(input: T, options: MutationOptions<T>): MethodDecorator

export function MutationWithZod<T extends ZodObject>(input: T, nameOrOptions?: string | MutationOptions<T>) {
  try {
    return MethodWithZod(input, nameOrOptions, Mutation)
  } catch (err) {
    const zodName = typeof nameOrOptions === 'object' ? nameOrOptions?.zod?.name : undefined
    throw new Error(`MutationWithZod failed${describeZodSchema(input, zodName)}`, { cause: err })
  }
}
