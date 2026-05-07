import { plainToInstance } from 'class-transformer'

import { BadRequestException } from '@nestjs/common'
import { Subscription, SubscriptionOptions as SO } from '@nestjs/graphql'

import { IModelFromZodOptions, modelFromZod } from '../../model-from-zod'

import type { ZodObject, ZodError } from 'zod'

/**
 * Options for {@link SubscriptionWithZod}, mirroring `@nestjs/graphql`'s
 * {@link SO} (a discriminated union over `nullable: true | false |
 * NullableList`) plus the library-specific `zod` field for model creation.
 *
 * Expressed as a type intersection so the union is preserved and TypeScript
 * still narrows `defaultValue` based on the `nullable` member.
 */
export type SubscriptionOptions<T extends ZodObject> = SO & {
  /**
   * Options for model creation from `zod`.
   */
  zod?: IModelFromZodOptions<T>
}

/**
 * Subscription handler (method) Decorator.
 * Routes subscriptions to this method.
 *
 * Uses a `zod` object.
 *
 * @export
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @return {MethodDecorator} A {@link MethodDecorator}.
 */
export function SubscriptionWithZod<T extends ZodObject>(input: T): MethodDecorator

/**
 * Subscription handler (method) Decorator.
 * Routes subscriptions to this method.
 *
 * Uses a `zod` object.
 *
 * @export
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @param {string} name The name of the method.
 * @return {MethodDecorator} A {@link MethodDecorator}.
 */
export function SubscriptionWithZod<T extends ZodObject>(input: T, name: string): MethodDecorator

/**
 * Subscription handler (method) Decorator.
 * Routes subscriptions to this method.
 *
 * Uses a `zod` object.
 *
 * @export
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @param {SubscriptionOptions<T>} options The options for subscription method.
 *
 * @return {MethodDecorator} A {@link MethodDecorator}.
 */
export function SubscriptionWithZod<T extends ZodObject>(input: T, options: SubscriptionOptions<T>): MethodDecorator

/**
 * Subscription handler (method) Decorator.
 * Routes subscriptions to this method.
 *
 * Uses a `zod` object.
 *
 * @export
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @param {string} name The name of the method.
 * @param {Pick<SubscriptionOptions<T>, 'filter' | 'resolve' | 'zod'>} options
 * The options for subscription method.
 *
 * @return {MethodDecorator} A {@link MethodDecorator}.
 */
export function SubscriptionWithZod<T extends ZodObject>(
  input: T,
  name: string,
  options: Pick<SubscriptionOptions<T>, 'filter' | 'resolve' | 'zod'>
): MethodDecorator

export function SubscriptionWithZod<T extends ZodObject>(
  input: T,
  nameOrOptions?: string | SubscriptionOptions<T>,
  pickedOptions?: Pick<SubscriptionOptions<T>, 'filter' | 'resolve' | 'zod'>
) {
  let zodOptions: IModelFromZodOptions<T> | undefined

  if (typeof nameOrOptions === 'object') {
    zodOptions = nameOrOptions.zod
  }
  else if (typeof pickedOptions === 'object') {
    zodOptions = pickedOptions.zod
  }

  const model = modelFromZod(input, zodOptions)

  return function _SubscriptionWithZod(
    target: any,
    methodName: string,
    descriptor: PropertyDescriptor
  ) {
    let newDescriptor = descriptor || {}

    const originalFunction = descriptor?.value ?? target[ methodName ]

    newDescriptor.value = function _subscriptionWithZod(...args: any[]) {
      const result = originalFunction.apply(this, args)
      if (result instanceof Promise) {
        return result
          .then(output => input.parseAsync(output))
          .then(output => plainToInstance(model, output))
          .catch((error: ZodError) => {
            const messages = error.issues.reduce<Record<string, string>>((prev, curr) => {
              prev[ curr.path.join('.') ] = curr.message
              return prev
            }, {})

            return new BadRequestException(messages)
          })
      }
      else {
        const parseResult = input.safeParse(result)
        if (parseResult.success) {
          return plainToInstance(model, parseResult.data)
        }
        else {
          const messages = parseResult.error.issues.reduce<Record<string, string>>((prev, curr) => {
            prev[ curr.path.join('.') ] = curr.message
            return prev
          }, {})

          return new BadRequestException(messages)
        }
      }
    }

    if (!descriptor) {
      Object.defineProperty(target, methodName, newDescriptor)
    }

    let decorate: MethodDecorator

    if (typeof nameOrOptions === 'string') {
      if (typeof pickedOptions === 'object') {
        const { zod: _zod, ...subscriptionOptions } = pickedOptions
        decorate = Subscription(nameOrOptions, subscriptionOptions)
      }
      else {
        decorate = Subscription(nameOrOptions)
      }
    }
    else if (typeof nameOrOptions === 'object') {
      const { zod, ...rest } = nameOrOptions
      decorate = Subscription(() => model, rest)
    }
    else {
      decorate = Subscription(() => model)
    }

    decorate(target, methodName, descriptor)
  }
}
