import type { DynamicZodModelClass, TypeOptionInputMethodDecoratorFactory } from './types'
import type { WrapWithZodOptions } from './zod-options-wrapper.interface'
import type { TypeProvider } from '../types/type-provider'
import type { EnumProvider } from '../types/enum-provider'

import { $ZodArray, type $ZodObject, type $ZodType } from 'zod/v4/core'
import type { BaseTypeOptions } from '@nestjs/graphql'

import { isZodInstance } from '../helpers/is-zod-instance'
import { IModelFromZodOptions, modelFromZod } from '../model-from-zod'
import { decorateWithZodInput } from './decorate-with-zod-input'
import { makeDecoratorFromFactory } from './make-decorator-from-factory'

export type ZodObjectOrArray = $ZodObject | $ZodArray<$ZodObject>
export type ElementOf<T extends ZodObjectOrArray> = T extends $ZodArray<infer E> ? E : T

type BaseOptions<T extends $ZodObject> = WrapWithZodOptions<BaseTypeOptions, T>

let DEFAULT_TYPE_PROVIDER: TypeProvider | undefined
let DEFAULT_ENUM_PROVIDER: EnumProvider | undefined

/**
 * Returns a method decorator that is built with `zod` validation object.
 *
 * @template T The type of the `zod` validation object.
 * @param {T} input The `zod` validation object.
 * @param {string | BaseOptions<T> | undefined} nameOrOptions The name or the options.
 * @param {TypeOptionInputMethodDecoratorFactory<BaseTypeOptions>} graphqlDecoratorFactory The
 *   actual decorator factory function.
 * @param {DynamicZodModelClass<T>} model The dynamically built model class from `zod` validation
 *   object.
 * @returns {MethodDecorator} A method decorator.
 * @export
 */
export function MethodWithZodModel<T extends $ZodObject>(
  validationSchema: $ZodType,
  nameOrOptions: string | BaseOptions<T> | undefined,
  graphqlDecoratorFactory: TypeOptionInputMethodDecoratorFactory<BaseTypeOptions>,
  model: DynamicZodModelClass<T>,
  isList = false,
): MethodDecorator {
  return function _ModelWithZod(
    target: Record<PropertyKey, any>,
    methodName: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    let newDescriptor = descriptor || {}

    const originalFunction = descriptor?.value ?? target[methodName]

    let decorationProps: typeof nameOrOptions
    if (typeof nameOrOptions === 'string') {
      decorationProps = {
        zod: { parseToInstance: true },
      }
    } else {
      decorationProps = nameOrOptions
    }

    const decoratedFunction = decorateWithZodInput(
      originalFunction,
      validationSchema,
      model,
      decorationProps,
    )

    newDescriptor.value = decoratedFunction

    if (!descriptor) {
      Object.defineProperty(target, methodName, newDescriptor)
    }

    const methodDecorator = makeDecoratorFromFactory(
      nameOrOptions,
      graphqlDecoratorFactory,
      model,
      isList,
    )

    methodDecorator(target, methodName, newDescriptor)
  }
}

/**
 * Returns a method decorator that is built with `zod` validation object.
 *
 * @template T The type of the `zod` validation object.
 * @param {T} input The `zod` validation object.
 * @param {string | BaseOptions<T> | undefined} nameOrOptions The name or the options.
 * @param {TypeOptionInputMethodDecoratorFactory<BaseTypeOptions>} graphqlDecoratorFactory The
 *   actual decorator factory function.
 * @returns {MethodDecorator} A method decorator.
 * @export
 */
export function MethodWithZod<T extends ZodObjectOrArray>(
  input: T,
  nameOrOptions: string | BaseOptions<ElementOf<T> & $ZodObject> | undefined,
  graphqlDecoratorFactory: TypeOptionInputMethodDecoratorFactory<BaseTypeOptions>,
) {
  const isList = isZodInstance($ZodArray, input)
  const element = (isList ? (input as $ZodArray)._zod.def.element : input) as ElementOf<T> &
    $ZodObject

  let zodOptions: IModelFromZodOptions<ElementOf<T> & $ZodObject> | undefined

  if (typeof nameOrOptions === 'object') {
    zodOptions = nameOrOptions.zod
  }

  return MethodWithZodModel(
    input,
    nameOrOptions,
    graphqlDecoratorFactory,
    modelFromZod(element, zodOptions) as DynamicZodModelClass<ElementOf<T> & $ZodObject>,
    isList,
  )
}

/**
 * Sets the default type provider for custom GraphQL Scalars.
 *
 * @param {TypeProvider} fn The type provider.
 * @export
 */
export function setDefaultTypeProvider(fn: TypeProvider) {
  DEFAULT_TYPE_PROVIDER = fn
}

/**
 * Gets the default type provided set previously via {@link setDefaultTypeProvider}.
 *
 * @returns {TypeProvider | undefined} The default type provider.
 * @export
 */
export function getDefaultTypeProvider(): TypeProvider | undefined {
  return DEFAULT_TYPE_PROVIDER
}

/**
 * Sets the default enum provider for custom GraphQL Scalars.
 *
 * @param {EnumProvider} fn The enum provider.
 * @export
 */
export function setDefaultEnumProvider(fn: EnumProvider) {
  DEFAULT_ENUM_PROVIDER = fn
}

/**
 * Gets the default enum provided set previously via {@link setDefaultEnumProvider}.
 *
 * @returns {EnumProvider | undefined} The default enum provider.
 * @export
 */
export function getDefaultEnumProvider(): EnumProvider | undefined {
  return DEFAULT_ENUM_PROVIDER
}
