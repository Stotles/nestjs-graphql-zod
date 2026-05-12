import type { ZodObject } from 'zod'
import type {
  DynamicZodModelClass,
  TypeOptionInputMethodDecoratorFactory,
} from './types'
import type {
  SupportedOptionTypes,
  WrapWithZodOptions,
} from './zod-options-wrapper.interface'

/**
 * Builds a decorator from a decorator factory function.
 *
 * @export
 * @template T The type of the `zod` validation object.
 * @template O The type of the supported option type.
 * @param {(WrapWithZodOptions<O, T> | string | undefined)} nameOrOptions The
 * name or the options.
 * 
 * @param {TypeOptionInputMethodDecoratorFactory<O>} decoratorFactory The decorator
 * factory.
 *
 * @param {DynamicZodModelClass<T>} model The class that is dynamically built.
 *
 * @return {MethodDecorator} A decorator.
 */
export function makeDecoratorFromFactory<
  T extends ZodObject,
  O extends SupportedOptionTypes
>(
  nameOrOptions: WrapWithZodOptions<O, T> | string | undefined,
  decoratorFactory: TypeOptionInputMethodDecoratorFactory<O>,
  model: DynamicZodModelClass<T>,
) {
  let decorator: MethodDecorator
  if (typeof nameOrOptions === 'string') {
    decorator = decoratorFactory(() => model, { name: nameOrOptions } as O)
  }
  else if (typeof nameOrOptions === 'object') {
    const { zod, ...rest } = nameOrOptions
    decorator = decoratorFactory(() => model, rest as O)
  }
  else {
    decorator = decoratorFactory(() => model)
  }

  return decorator
}
