import type { InputTypeOptions } from '@nestjs/graphql'
import type { $ZodType } from 'zod/v4/core'

import type { WrapWithZodOptions } from '../zod-options-wrapper.interface'

/**
 * An option type for decorators.
 *
 * @template T The type of the validation object.
 * @extends {WrapWithZodOptions<InputTypeOptions, T>}
 * @export
 * @interface Options
 */
export interface Options<T extends $ZodType> extends WrapWithZodOptions<InputTypeOptions, T> {
  /**
   * The name of the {@link InputType}.
   *
   * @memberof Options
   * @type {string}
   */
  name?: string
}
