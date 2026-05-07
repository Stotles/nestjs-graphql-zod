import { Mutation, MutationOptions as MO } from '@nestjs/graphql'

import { MethodWithZod } from '../common'

import type { ZodObject } from 'zod'
import type { IModelFromZodOptions } from '../../model-from-zod'

/**
 * Options for {@link MutationWithZod}, mirroring `@nestjs/graphql`'s
 * {@link MO} (a discriminated union over `nullable: true | false |
 * NullableList`) plus the library-specific `zod` field for model creation.
 *
 * Expressed as a type intersection so the union is preserved and TypeScript
 * still narrows `defaultValue` based on the `nullable` member.
 */
export type MutationOptions<T extends ZodObject> = MO & {
  /**
   * Options for model creation from `zod`.
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
  return MethodWithZod(input, nameOrOptions, Mutation)
}
