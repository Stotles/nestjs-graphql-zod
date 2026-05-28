import { plainToInstance } from 'class-transformer'

import { BadRequestException } from '@nestjs/common'
import { Subscription, SubscriptionOptions as SO } from '@nestjs/graphql'

import { describeZodSchema } from '../../helpers/describe-zod-schema'
import { IModelFromZodOptions, modelFromZod } from '../../model-from-zod'

import type { ZodObject, ZodError } from 'zod'

/**
 * Options for {@link SubscriptionWithZod}, mirroring `@nestjs/graphql`'s {@link SO} (a discriminated
 * union over `nullable: true | false | NullableList`) plus the library-specific `zod` field for
 * model creation.
 *
 * Expressed as a type intersection so the union is preserved and TypeScript still narrows
 * `defaultValue` based on the `nullable` member.
 */
export type SubscriptionOptions<T extends ZodObject> = SO & {
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
 * Uses a `zod` object.
 *
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function SubscriptionWithZod<T extends ZodObject>(input: T): MethodDecorator

/**
 * Subscription handler (method) Decorator. Routes subscriptions to this method.
 *
 * Uses a `zod` object.
 *
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @param {string} name The name of the method.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function SubscriptionWithZod<T extends ZodObject>(input: T, name: string): MethodDecorator

/**
 * Subscription handler (method) Decorator. Routes subscriptions to this method.
 *
 * Uses a `zod` object.
 *
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @param {SubscriptionOptions<T>} options The options for subscription method.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function SubscriptionWithZod<T extends ZodObject>(
  input: T,
  options: SubscriptionOptions<T>,
): MethodDecorator

/**
 * Subscription handler (method) Decorator. Routes subscriptions to this method.
 *
 * Uses a `zod` object.
 *
 * @template T The type of the zod object input.
 * @param {T} input The zod input object.
 * @param {string} name The name of the method.
 * @param {Pick<SubscriptionOptions<T>, 'filter' | 'resolve' | 'zod'>} options The options for
 *   subscription method.
 * @returns {MethodDecorator} A {@link MethodDecorator}.
 * @export
 */
export function SubscriptionWithZod<T extends ZodObject>(
  input: T,
  name: string,
  options: Pick<SubscriptionOptions<T>, 'filter' | 'resolve' | 'zod'>,
): MethodDecorator

export function SubscriptionWithZod<T extends ZodObject>(
  input: T,
  nameOrOptions?: string | SubscriptionOptions<T>,
  pickedOptions?: Pick<SubscriptionOptions<T>, 'filter' | 'resolve' | 'zod'>,
) {
  let zodOptions: IModelFromZodOptions<T> | undefined

  if (typeof nameOrOptions === 'object') {
    zodOptions = nameOrOptions.zod
  } else if (typeof pickedOptions === 'object') {
    zodOptions = pickedOptions.zod
  }

  let model: ReturnType<typeof modelFromZod<T, IModelFromZodOptions<T>>>
  try {
    model = modelFromZod(input, zodOptions)
  } catch (err) {
    throw new Error(`SubscriptionWithZod failed${describeZodSchema(input, zodOptions?.name)}`, {
      cause: err,
    })
  }

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
          .then((output) => input.parseAsync(output))
          .then((output) => plainToInstance(model, output))
          .catch((error: ZodError) => {
            const messages = error.issues.reduce<Record<string, string>>((prev, curr) => {
              prev[curr.path.join('.')] = curr.message
              return prev
            }, {})

            return new BadRequestException(messages)
          })
      } else {
        const parseResult = input.safeParse(result)
        if (parseResult.success) {
          return plainToInstance(model, parseResult.data)
        } else {
          const messages = parseResult.error.issues.reduce<Record<string, string>>((prev, curr) => {
            prev[curr.path.join('.')] = curr.message
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
        // Strip the library-specific `zod` field so it doesn't leak into
        // Nest's GraphQL metadata. Mirrors the object-overload branch below.
        const { zod: _zod, ...rest } = pickedOptions
        decorate = Subscription(() => model, { ...rest, name: nameOrOptions })
      } else {
        decorate = Subscription(() => model, { name: nameOrOptions })
      }
    } else if (typeof nameOrOptions === 'object') {
      const { zod: _zod, ...rest } = nameOrOptions
      decorate = Subscription(() => model, rest)
    } else {
      decorate = Subscription(() => model)
    }

    decorate(target, methodName, descriptor)
  }
}
