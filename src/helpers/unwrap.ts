import {
  ZodArray,
  ZodCatch,
  ZodDefault,
  ZodLazy,
  ZodNullable,
  ZodOptional,
  ZodPipe,
  ZodPrefault,
  ZodPromise,
  ZodReadonly,
  ZodSet,
  ZodTransform,
  ZodType,
} from 'zod'

import { Prev } from '../types/prev'
import { isZodInstance } from './is-zod-instance'

/**
 * Unwraps any given zod type by one level.
 *
 * The supported zod wrappers are:
 * - {@link ZodArray}
 * - {@link ZodCatch}
 * - {@link ZodDefault}
 * - {@link ZodLazy}
 * - {@link ZodNullable}
 * - {@link ZodOptional}
 * - {@link ZodPipe} (unwraps to the input side)
 * - {@link ZodPrefault}
 * - {@link ZodPromise}
 * - {@link ZodReadonly}
 * - {@link ZodSet}
 * - {@link ZodTransform} (no inner type — returns T)
 *
 * @template T The zod type.
 */
export type UnwrapNestedZod<T extends ZodType>
  = T extends ZodArray<infer I> ? I : (
    T extends ZodOptional<infer I> ? I : (
      T extends ZodDefault<infer I> ? I : (
        T extends ZodPrefault<infer I> ? I : (
          T extends ZodReadonly<infer I> ? I : (
            T extends ZodNullable<infer I> ? I : (
              T extends ZodCatch<infer I> ? I : (
                T extends ZodPromise<infer I> ? I : (
                  T extends ZodSet<infer I> ? I : (
                    T extends ZodLazy<infer I> ? I : (
                      T extends ZodPipe<infer I, any> ? I : T
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  )

/**
 * Unwraps any given zod type recursively.
 *
 * @template T The zod type.
 * @template Depth The maximum depth to unwrap, default `5`.
 */
export type UnwrapNestedZodRecursive<T extends ZodType, Depth extends number = 5>
  = [ Prev[ Depth ] ] extends [ never ] ? never : [ T ] extends [ UnwrapNestedZod<T> ] ? T : (
    UnwrapNestedZod<T> extends ZodType ? UnwrapNestedZodRecursive<UnwrapNestedZod<T>, Prev[ Depth ]> : UnwrapNestedZod<T>
  )

/**
 * Unwraps the zod object one level.
 *
 * @export
 * @template T The type of the input.
 * @param {T} input The zod input.
 * @return {UnwrapNestedZod<T>} The unwrapped zod instance.
 *
 * @__PURE__
 */
export function unwrapNestedZod<T extends ZodType>(input: T): UnwrapNestedZod<T> {
  if (isZodInstance(ZodArray, input)) return input.element as UnwrapNestedZod<T>
  if (isZodInstance(ZodCatch, input)) return input._def.innerType as UnwrapNestedZod<T>
  if (isZodInstance(ZodDefault, input)) return input._def.innerType as UnwrapNestedZod<T>
  if (isZodInstance(ZodPrefault, input)) return input._def.innerType as UnwrapNestedZod<T>
  if (isZodInstance(ZodReadonly, input)) return input._def.innerType as UnwrapNestedZod<T>
  if (isZodInstance(ZodPipe, input)) return input._def.in as UnwrapNestedZod<T>
  if (isZodInstance(ZodTransform, input)) return input as unknown as UnwrapNestedZod<T>
  if (isZodInstance(ZodLazy, input)) return input._def.getter() as UnwrapNestedZod<T>
  if (isZodInstance(ZodNullable, input)) return input.unwrap() as UnwrapNestedZod<T>
  if (isZodInstance(ZodOptional, input)) return input.unwrap() as UnwrapNestedZod<T>
  if (isZodInstance(ZodPromise, input)) return input.unwrap() as UnwrapNestedZod<T>
  if (isZodInstance(ZodSet, input)) return input._def.valueType as UnwrapNestedZod<T>
  return input as UnwrapNestedZod<T>
}

/**
 * Unwraps the zob object recursively.
 *
 * @export
 * @template T The type of the input.
 * @template Depth The maximum depth for the recursion, `5` by default.
 * @param {T} input The zod input.
 * @return {UnwrapNestedZodRecursive<T, Depth>} The unwrapped zod instance.
 *
 * @__PURE__
 */
export function unwrapNestedZodRecursively<
  T extends ZodType,
  Depth extends number = 5
>(input: T): UnwrapNestedZodRecursive<T, Depth> {
  let current = input as ZodType

  for (const layer of iterateZodLayers(input)) {
    current = layer
  }

  return current as UnwrapNestedZodRecursive<T, Depth> & ZodType
}

/**
 * Iterates the zod layers by unwrapping the values.
 *
 * @export
 * @template T The input zod type.
 * @param {T} input The zod input.
 */
export function* iterateZodLayers<T extends ZodType>(input: T) {
  let current = input as ZodType
  let unwrapped = unwrapNestedZod(input) as ZodType

  while (unwrapped !== current) {
    yield current
    current = unwrapped
    unwrapped = unwrapNestedZod(current) as ZodType
  }

  yield current
}

/**
 * Finds the innermost {@link ZodDefault} or {@link ZodPrefault} layer in a
 * wrapped schema, walking through {@link ZodOptional}, {@link ZodNullable},
 * {@link ZodReadonly}, {@link ZodCatch}, etc.
 *
 * @export
 * @param {ZodType} input The zod input.
 * @return {ZodDefault | ZodPrefault | undefined} The default-bearing layer,
 * or `undefined` if none is found.
 *
 * @__PURE__
 */
export function findInnerDefault(input: ZodType): ZodDefault | ZodPrefault | undefined {
  for (const layer of iterateZodLayers(input)) {
    if (isZodInstance(ZodDefault, layer)) return layer
    if (isZodInstance(ZodPrefault, layer)) return layer
  }
}
