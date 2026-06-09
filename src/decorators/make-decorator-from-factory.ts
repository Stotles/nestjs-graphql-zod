import type { $ZodObject } from 'zod/v4/core'
import type { DynamicZodModelClass, TypeOptionInputMethodDecoratorFactory } from './types'
import type { SupportedOptionTypes, WrapWithZodOptions } from './zod-options-wrapper.interface'

/**
 * Builds a decorator from a decorator factory function.
 *
 * @template T The type of the `zod` validation object.
 * @template O The type of the supported option type.
 * @param {WrapWithZodOptions<O, T> | string | undefined} nameOrOptions The name or the options.
 * @param {TypeOptionInputMethodDecoratorFactory<O>} decoratorFactory The decorator factory.
 * @param {DynamicZodModelClass<T>} model The class that is dynamically built.
 * @returns {MethodDecorator} A decorator.
 * @export
 */
export function makeDecoratorFromFactory<T extends $ZodObject, O extends SupportedOptionTypes>(
  nameOrOptions: WrapWithZodOptions<O, T> | string | undefined,
  decoratorFactory: TypeOptionInputMethodDecoratorFactory<O>,
  model: DynamicZodModelClass<T>,
  isList = false,
) {
  const typeFunc = isList ? () => [model] : () => model
  let decorator: MethodDecorator
  if (typeof nameOrOptions === 'string') {
    decorator = decoratorFactory(typeFunc, { name: nameOrOptions } as O)
  } else if (typeof nameOrOptions === 'object') {
    const { zod: _zod, ...rest } = nameOrOptions
    decorator = decoratorFactory(typeFunc, rest as O)
  } else {
    decorator = decoratorFactory(typeFunc)
  }

  return decorator
}
