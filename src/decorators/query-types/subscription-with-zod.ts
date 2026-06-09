import { plainToInstance } from 'class-transformer'

import { BadRequestException } from '@nestjs/common'
import { Subscription, SubscriptionOptions as SO } from '@nestjs/graphql'

import { describeZodSchema } from '../../helpers/describe-zod-schema'
import { isZodInstance } from '../../helpers/is-zod-instance'
import { IModelFromZodOptions, modelFromZod } from '../../model-from-zod'
import type { ElementOf, ZodObjectOrArray } from '../common'

import { $ZodArray, $ZodObject, $ZodError, parseAsync, safeParse } from 'zod/v4/core'

/**
 * Options for {@link SubscriptionWithZod}, mirroring `@nestjs/graphql`'s {@link SO} (a discriminated
 * union over `nullable: true | false | NullableList`) plus the library-specific `zod` field for
 * model creation.
 *
 * Expressed as a type intersection so the union is preserved and TypeScript still narrows
 * `defaultValue` based on the `nullable` member.
 */
export type SubscriptionOptions<T extends $ZodObject> = SO & {
  /**
   * Options for model creation from `zod`.
   *
   * @memberof SubscriptionOptions
   * @type {IModelFromZodOptions<T>}
   */
  zod?: IModelFromZodOptions<T>
}

/**
 * Subscription handler (method) Decorator. Routes subscriptions to this method.
 *
 * Uses a `zod` object or a `zod` array of objects (for list return types).
 *
 * @template T The type of the zod object or array input.
 * @param {T} input The zod input object or array.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function SubscriptionWithZod<T extends ZodObjectOrArray>(input: T): MethodDecorator

/**
 * Subscription handler (method) Decorator. Routes subscriptions to this method.
 *
 * Uses a `zod` object or a `zod` array of objects (for list return types).
 *
 * @template T The type of the zod object or array input.
 * @param {T} input The zod input object or array.
 * @param {string} name The name of the method.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function SubscriptionWithZod<T extends ZodObjectOrArray>(
  input: T,
  name: string,
): MethodDecorator

/**
 * Subscription handler (method) Decorator. Routes subscriptions to this method.
 *
 * Uses a `zod` object or a `zod` array of objects (for list return types).
 *
 * @template T The type of the zod object or array input.
 * @param {T} input The zod input object or array.
 * @param {SubscriptionOptions<ElementOf<T> & $ZodObject>} options The options for subscription
 *   method.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function SubscriptionWithZod<T extends ZodObjectOrArray>(
  input: T,
  options: SubscriptionOptions<ElementOf<T> & $ZodObject>,
): MethodDecorator

/**
 * Subscription handler (method) Decorator. Routes subscriptions to this method.
 *
 * Uses a `zod` object or a `zod` array of objects (for list return types).
 *
 * @template T The type of the zod object or array input.
 * @param {T} input The zod input object or array.
 * @param {string} name The name of the method.
 * @param {Pick<SubscriptionOptions<ElementOf<T> & $ZodObject>, 'filter' | 'resolve' | 'zod'>} *
 *   Options The options for subscription method.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function SubscriptionWithZod<T extends ZodObjectOrArray>(
  input: T,
  name: string,
  options: Pick<SubscriptionOptions<ElementOf<T> & $ZodObject>, 'filter' | 'resolve' | 'zod'>,
): MethodDecorator

export function SubscriptionWithZod<T extends ZodObjectOrArray>(
  input: T,
  nameOrOptions?: string | SubscriptionOptions<ElementOf<T> & $ZodObject>,
  pickedOptions?: Pick<
    SubscriptionOptions<ElementOf<T> & $ZodObject>,
    'filter' | 'resolve' | 'zod'
  >,
) {
  const isList = isZodInstance($ZodArray, input)
  const element = (isList ? (input as $ZodArray)._zod.def.element : input) as ElementOf<T> &
    $ZodObject

  let zodOptions: IModelFromZodOptions<ElementOf<T> & $ZodObject> | undefined

  if (typeof nameOrOptions === 'object') {
    zodOptions = nameOrOptions.zod
  } else if (typeof pickedOptions === 'object') {
    zodOptions = pickedOptions.zod
  }

  let model: ReturnType<typeof modelFromZod>
  try {
    model = modelFromZod(element, zodOptions)
  } catch (err) {
    throw new Error(`SubscriptionWithZod failed${describeZodSchema(input, zodOptions?.name)}`, {
      cause: err,
    })
  }

  const typeFunc = isList ? () => [model] : () => model

  return function _SubscriptionWithZod(
    target: any,
    methodName: string,
    descriptor: PropertyDescriptor,
  ) {
    let newDescriptor = descriptor || {}

    const originalFunction = descriptor?.value ?? target[methodName]

    newDescriptor.value = function _subscriptionWithZod(...args: any[]) {
      const result = originalFunction.apply(this, args)
      if (result instanceof Promise) {
        return result
          .then((output) => parseAsync(input, output))
          .then((output) => plainToInstance(model, output))
          .catch((error: $ZodError) => {
            const messages = error.issues.reduce<Record<string, string>>((prev, curr) => {
              prev[curr.path.join('.')] = curr.message
              return prev
            }, {})

            throw new BadRequestException(messages)
          })
      } else {
        const parseResult = safeParse(input, result)
        if (parseResult.success) {
          return plainToInstance(model, parseResult.data)
        } else {
          const messages = parseResult.error.issues.reduce<Record<string, string>>((prev, curr) => {
            prev[curr.path.join('.')] = curr.message
            return prev
          }, {})

          throw new BadRequestException(messages)
        }
      }
    }

    if (!descriptor) {
      Object.defineProperty(target, methodName, newDescriptor)
    }

    let decorate: MethodDecorator

    if (typeof nameOrOptions === 'string') {
      if (typeof pickedOptions === 'object') {
        // Strip the library-specific `zod` field so it doesn't leak into
        // Nest's GraphQL metadata. Mirrors the object-overload branch below.
        const { zod: _zod, ...rest } = pickedOptions
        decorate = Subscription(typeFunc, { ...rest, name: nameOrOptions })
      } else {
        decorate = Subscription(typeFunc, { name: nameOrOptions })
      }
    } else if (typeof nameOrOptions === 'object') {
      const { zod: _zod, ...rest } = nameOrOptions
      decorate = Subscription(typeFunc, rest)
    } else {
      decorate = Subscription(typeFunc)
    }

    decorate(target, methodName, descriptor)
  }
}
