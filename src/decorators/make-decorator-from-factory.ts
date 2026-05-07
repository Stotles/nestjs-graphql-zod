import type { ZodObject } from 'zod'
import type {
  DynamicZodModelClass,
  GraphQLCDF,
  GraphQLMDF,
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
 * @param {(GraphQLMDF<O> | GraphQLCDF<O>)} decoratorFactory The decorator
 * factory.
 * 
 * @param {DynamicZodModelClass<T>} model The class that is dynamically built.
 * 
 * @return {MethodDecorator | ClassDecorator | ParameterDecorator} A decorator. 
 */
export function makeDecoratorFromFactory<
  T extends ZodObject,
  O extends SupportedOptionTypes
>(
  nameOrOptions: WrapWithZodOptions<O, T> | string | undefined,
  decoratorFactory: GraphQLMDF<O> | GraphQLCDF<O>,
  model: DynamicZodModelClass<T>,
) {
  let decorator: MethodDecorator | ClassDecorator | ParameterDecorator
  if (typeof nameOrOptions === 'string') {
    // The string overload is shorthand for "rename the GraphQL field". The
    // upstream nestjs decorators have a `Query(name)` form, but it leaves
    // the return type unset, so the schema factory later fails with
    // "X was defined in resolvers, but not in schema". Instead delegate to
    // the type+options form using `name` as a partial option, which both
    // registers the model and renames the field.
    const factory = decoratorFactory as TypeOptionInputMethodDecoratorFactory<O>
    decorator = factory(() => model, { name: nameOrOptions } as O)
  }
  else if (typeof nameOrOptions === 'object') {
    const { zod, ...rest } = nameOrOptions
    const factory = decoratorFactory as TypeOptionInputMethodDecoratorFactory<O>
    decorator = factory(() => model, rest as O)
  }
  else {
    const factory = decoratorFactory as TypeOptionInputMethodDecoratorFactory<O>
    decorator = factory(() => model)
  }

  return decorator
}
