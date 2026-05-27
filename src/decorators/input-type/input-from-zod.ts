import { InputTypeWithZod } from './input-type-with-zod'

import type { ZodObject, output } from 'zod'
import type { Type } from '@nestjs/common'

import type { Options } from './options.inteface'

/**
 * Returns a {@link InputTypeWithZod} decorated class from given `zod` input.
 *
 * You can use this returned dynamic class to extend your classes.
 *
 * @template T The type of the `zod` object input.
 * @param {T} input The `zod` object input.
 * @returns {Type<output<T>>} A class that contains the properties from given `zod` input, decorated
 *   with {@link InputTypeWithZod}.
 * @export
 */
export function inputFromZod<T extends ZodObject>(input: T): Type<output<T>>

/**
 * Returns a {@link InputTypeWithZod} decorated class from given `zod` input.
 *
 * You can use this returned dynamic class to extend your classes.
 *
 * @template T The type of the `zod` object input.
 * @param {T} input The `zod` object input.
 * @param {Options<T>} options The options for the decorator.
 * @returns {Type<output<T>>} A class that contains the properties from given `zod` input, decorated
 *   with {@link InputTypeWithZod}.
 * @export
 */
export function inputFromZod<T extends ZodObject>(input: T, options: Options<T>): Type<output<T>>

/**
 * Returns a {@link InputTypeWithZod} decorated class from given `zod` input.
 *
 * You can use this returned dynamic class to extend your classes.
 *
 * @template T The type of the `zod` object input.
 * @param {T} input The `zod` object input.
 * @param {string} name The name of the {@link InputType}.
 * @param {Options<T>} options The options for the decorator.
 * @returns {Type<output<T>>} A class that contains the properties from given `zod` input, decorated
 *   with {@link InputTypeWithZod}.
 * @export
 */
export function inputFromZod<T extends ZodObject>(
  input: T,
  name: string,
  options?: Options<T>,
): Type<output<T>>

export function inputFromZod<T extends ZodObject>(
  input: T,
  nameOrOptions?: string | Options<T>,
  options?: Options<T>,
) {
  class DynamicZodModel {}

  InputTypeWithZod(input, nameOrOptions as string, options)(DynamicZodModel)
  return DynamicZodModel as Type<output<T>>
}
