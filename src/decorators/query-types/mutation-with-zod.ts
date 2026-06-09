import { Mutation, MutationOptions as MO } from '@nestjs/graphql'

import { describeZodSchema } from '../../helpers/describe-zod-schema'
import { type ElementOf, MethodWithZod, type ZodObjectOrArray } from '../common'

import type { $ZodObject } from 'zod/v4/core'
import type { IModelFromZodOptions } from '../../model-from-zod'

/**
 * Options for {@link MutationWithZod}, mirroring `@nestjs/graphql`'s {@link MO} (a discriminated
 * union over `nullable: true | false | NullableList`) plus the library-specific `zod` field for
 * model creation.
 *
 * Expressed as a type intersection so the union is preserved and TypeScript still narrows
 * `defaultValue` based on the `nullable` member.
 */
export type MutationOptions<T extends $ZodObject> = MO & {
  /**
   * Options for model creation from `zod`.
   *
   * @memberof MutationOptions
   * @type {IModelFromZodOptions<T>}
   */
  zod?: IModelFromZodOptions<T>
}

/**
 * Mutation handler (method) Decorator. Routes specified mutation to this method.
 *
 * Uses a `zod` object or a `zod` array of objects (for list return types).
 *
 * @template T The type of the zod object or array input.
 * @param {T} input The zod input object or array.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function MutationWithZod<T extends ZodObjectOrArray>(input: T): MethodDecorator

/**
 * Mutation handler (method) Decorator. Routes specified mutation to this method.
 *
 * Uses a `zod` object or a `zod` array of objects (for list return types).
 *
 * @template T The type of the zod object or array input.
 * @param {T} input The zod input object or array.
 * @param {string} name The name of the method.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function MutationWithZod<T extends ZodObjectOrArray>(input: T, name: string): MethodDecorator

/**
 * Mutation handler (method) Decorator. Routes specified mutation to this method.
 *
 * Uses a `zod` object or a `zod` array of objects (for list return types).
 *
 * @template T The type of the zod object or array input.
 * @param {T} input The zod input object or array.
 * @param {MutationOptions<ElementOf<T> & $ZodObject>} options The options for mutation method.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function MutationWithZod<T extends ZodObjectOrArray>(
  input: T,
  options: MutationOptions<ElementOf<T> & $ZodObject>,
): MethodDecorator

export function MutationWithZod<T extends ZodObjectOrArray>(
  input: T,
  nameOrOptions?: string | MutationOptions<ElementOf<T> & $ZodObject>,
) {
  try {
    return MethodWithZod(input, nameOrOptions, Mutation)
  } catch (err) {
    const zodName = typeof nameOrOptions === 'object' ? nameOrOptions?.zod?.name : undefined
    throw new Error(`MutationWithZod failed${describeZodSchema(input, zodName)}`, { cause: err })
  }
}
