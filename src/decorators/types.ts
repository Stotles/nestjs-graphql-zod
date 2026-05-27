import type { ReturnTypeFunc } from '@nestjs/graphql'
import type { SupportedOptionTypes } from './zod-options-wrapper.interface'
import type { ZodObject } from 'zod'
import type { Type } from '@nestjs/common'

/**
 * Describes a dynamically built class out of the given zod validation object.
 */
export type DynamicZodModelClass<T extends ZodObject> = Type<T>

type Decorators = MethodDecorator | ClassDecorator | ParameterDecorator

/**
 * Describes a factory that takes an option.
 */
export type OptionInputDecoratorFactory<
  O extends SupportedOptionTypes,
  T extends Decorators
  > = ((options?: O) => T)

/**
 * Describes a factory that takes a type function and an optional option.
 */
export type TypeOptionInputDecoratorFactory<
  O extends SupportedOptionTypes,
  T extends Decorators
  > = ((typeFunc: ReturnTypeFunc, options?: O) => T)

/**
 * Describes a factory that takes an option.
 */
export type OptionInputMethodDecoratorFactory<O extends SupportedOptionTypes>
  = OptionInputDecoratorFactory<O, MethodDecorator>

/**
 * Describes a factory that takes an option.
 */
export type TypeOptionInputMethodDecoratorFactory<
  O extends SupportedOptionTypes
  > = TypeOptionInputDecoratorFactory<O, MethodDecorator>
