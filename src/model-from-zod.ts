import type { Type } from '@nestjs/common'
import type { EnumProvider } from './types/enum-provider'
import type { TypeProvider } from './types/type-provider'

import type { ZodObject, ZodError, ZodType, output } from 'zod'

import { ObjectType, ObjectTypeOptions } from '@nestjs/graphql'

import { extractNameAndDescription, parseShape } from './helpers'
import { MAX_ZOD_DEPTH, ZodObjectKey } from './helpers/constants'
import { describeZodSchema } from './helpers/describe-zod-schema'
import { Direction } from './helpers/get-zod-object-name'

export interface IModelFromZodOptions<T extends ZodType> extends ObjectTypeOptions {
  /**
   * The name of the model class in GraphQL schema.
   *
   * @memberof IModelFromZodOptions
   * @type {string}
   */
  name?: string

  /**
   * Indicates whether or not the property should be parsed safely.
   *
   * If this property is set to `true`, then `safeParse` will be used and if parsing is failed, the
   * {@link onParseError} function will be called to provide a replace value.
   *
   * @memberof IModelFromZodOptions
   * @type {boolean}
   * @see {@link doNotThrow}
   */
  safe?: boolean

  /**
   * Indicates if the parsing should throw when no value could be set when there was an error during
   * parsing.
   *
   * If this property is set to `true`, then the value will be `undefined` if data could not be
   * parsed successfully.
   *
   * @memberof IModelFromZodOptions
   * @type {boolean}
   */
  doNotThrow?: boolean

  /**
   * Indicates whether or not the zod object should be kept inside the dynamically generated class.
   *
   * If this property is set to `true`, use {@link getZodObject} function to get the source object
   * from a target.
   *
   * @memberof IModelFromZodOptions
   * @type {boolean}
   */
  keepZodObject?: boolean

  /**
   * Indicates whether or not the successfully parsed objects should be converted to their
   * dynamically built class instances.
   *
   * @memberof IModelFromZodOptions
   * @default true
   * @type {boolean}
   */
  parseToInstance?: boolean

  /**
   * A function that can be used for providing a default value for a property that had an error
   * during parsing.
   *
   * @memberof IModelFromZodOptions
   * @template K The type of the key.
   * @param {K} key The key that could not be parsed.
   * @param {T[ K ]} newValue The new value that is tried to be parsed.
   * @param {T[K] | undefined} oldValue The previous value of the property.
   * @param {ZodError<T[ K ]>} error The error thrown during parsing.
   * @returns {any} {(T[ keyof T ] | void)} An alternative fallback value to replace and dismiss the
   *   error, or nothing.
   */
  onParseError?<K extends keyof output<T>>(
    key: K,
    newValue: output<T>[K],
    oldValue: output<T>[K] | undefined,
    error: ZodError,
  ): output<T>[keyof output<T>] | void

  /**
   * A function that can be used for providing parse options for a key during the parsing process
   * (on set).
   *
   * @memberof IModelFromZodOptions
   * @template K The type of the key.
   * @param {K} key The key that is being parsed.
   * @param {T[K] | undefined} previousValue The previously set value.
   * @returns {Record<string, unknown>} The parse options for the
   * current parsing stage.
   */
  onParsing?<K extends keyof output<T>>(
    key: K,
    previousValue: output<T>[K] | undefined,
  ): Record<string, unknown>

  /**
   * Gets the scalar type for given type name.
   *
   * @param {string} typeName The type name corresponding to the zod object.
   * @returns {GraphQLScalarType} The scalar type for the zod object.
   */
  getScalarTypeFor?: TypeProvider

  /**
   * Provides a name for nested classes when they are created dynamically from object properties of
   * zod types.
   *
   * @memberof IModelFromZodOptions
   * @param {string} parentName The parent class name.
   * @param {string} propertyKey The property key/name.
   * @returns {string | undefined} The name to set for the class. If any value returned other than a
   *   `string`, the class name will be generated automatically.
   */
  provideNameForNestedClass?(parentName: string, propertyKey: string): string | undefined

  /**
   * Gets an enum type for given information.
   *
   * Use this function to prevent creating different enums in GraphQL schema if you are going to use
   * same values in different places.
   *
   * @memberof IModelFromZodOptions
   * @param {string | undefined} name The parent name that contains the enum type.
   * @param {string} key The property name of the enum.
   * @param {Record<string, string | number>} enumObject The enum object that is extracted from the
   *   zod.
   * @returns {Record<string, string | number> | undefined} The enum that will be used instead of
   *   creating a new one. If `undefined` is returned, then a new enum will be created.
   */
  getEnumType?: EnumProvider
}

type Options<T extends ZodType> = IModelFromZodOptions<T> & {
  /**
   * Provides the decorator to decorate the dynamically generated class.
   *
   * @memberof IOptions
   * @param {T} zodInput The zod input.
   * @param {string} key The name of the currently processsed property.
   * @returns {ClassDecorator} The class decorator to decorate the class.
   */
  getDecorator?(zodInput: T, key: string): ClassDecorator
}

// Cache of generated classes, partitioned by direction. The same Zod schema
// instance can legitimately back both a GraphQL output (`@ObjectType`) and
// input (`@InputType`) class, so the two must not share a slot — otherwise
// the second caller silently receives the first caller's decorated class
// and `@nestjs/graphql` rejects the schema at build time.
let _generatedClasses: { input: WeakMap<ZodType, Type>; output: WeakMap<ZodType, Type> } | undefined

// Tracks nested invocation depth of `modelFromZodBase`. The class cache catches
// recursive schemas where the same Zod instance is re-encountered, this counter
// catches the extreme cases where something produces a fresh Zod instance on
// each call, bypassing the cache and causing infinite recursion.
let _modelFromZodDepth = 0

/**
 * Exposes the current `modelFromZodBase` recursion depth for tests that need to assert the counter
 * is restored after both clean returns and error unwinds. Not part of the public API.
 *
 * @internal
 */
export function _getModelFromZodDepth(): number {
  return _modelFromZodDepth
}

/**
 * Exposes the cached generated class (if any) for a given schema and direction so tests can verify
 * the cache is populated on success and evicted on failure. Not part of the public API.
 *
 * @internal
 */
export function _getCachedClass(schema: ZodType, direction: Direction): Type | undefined {
  return _generatedClasses?.[direction].get(schema)
}

/**
 * Creates a dynamic class which will be compatible with GraphQL, from a `zod` model.
 *
 * @template T The type of the zod input.
 * @param {T} zodInput The zod object input.
 * @param {IModelFromZodOptions<T>} [options={}] The options for model creation. Default is `{}`
 * @param {ClassDecorator} decorator The decorator to apply to the generated class.
 * @param {Direction} direction Whether the GraphQL type being built represents an input (what the
 *   client sends) or an output (what the schema produces).
 * @returns {Type} A class that represents the `zod` object and also
 * compatible with `GraphQL`.
 * @export
 */
export function modelFromZodBase<T extends ZodObject, O extends Options<T>>(
  zodInput: T,
  options: O = {} as O,
  decorator: ClassDecorator,
  direction: Direction,
): Type<output<T>> {
  const cache = (_generatedClasses ??= {
    input: new WeakMap<ZodType, Type>(),
    output: new WeakMap<ZodType, Type>(),
  })
  const previousRecord = cache[direction].get(zodInput)

  if (previousRecord) return previousRecord

  if (_modelFromZodDepth >= MAX_ZOD_DEPTH) {
    throw new Error(
      `modelFromZodBase exceeded MAX_ZOD_DEPTH (${MAX_ZOD_DEPTH}). This usually ` +
        `indicates a ZodLazy getter that manufactures a fresh schema on each call, ` +
        `preventing the class cache from terminating the recursion.`,
    )
  }

  _modelFromZodDepth++
  try {
    const { name, description } = extractNameAndDescription(zodInput, options)
    let { keepZodObject = false } = options

    class DynamicZodModel {}
    const prototype = DynamicZodModel.prototype

    decorator(DynamicZodModel)

    if (keepZodObject) {
      Object.defineProperty(prototype, ZodObjectKey, {
        value: { ...zodInput },
        configurable: false,
        writable: false,
      })
    }

    // Register before recursing into fields so recursive references via
    // `z.lazy(() => self)` resolve to this class instead of re-entering
    // and stack-overflowing. Evict on error so we don't leave a half-built
    // class in the cache for subsequent callers.
    cache[direction].set(zodInput, DynamicZodModel)
    try {
      const parsed = parseShape(
        zodInput,
        {
          ...options,
          name,
          description,
          getDecorator: options.getDecorator,
        },
        direction,
      )

      for (const { descriptor, key, decorateFieldProperty } of parsed) {
        Object.defineProperty(prototype, key, descriptor)
        decorateFieldProperty(prototype, key)
      }
    } catch (err) {
      cache[direction].delete(zodInput)
      throw err
    }

    return DynamicZodModel as Type<output<T>>
  } finally {
    // Always decrement the depth counter, even if it errors out so if something
    // catches the error and continues, it won't be permanently stuck at max depth.
    _modelFromZodDepth--
  }
}

/**
 * Creates a dynamic class which will be compatible with GraphQL, from a `zod` model.
 *
 * @template T The type of the zod input.
 * @param {T} zodInput The zod object input.
 * @param {IModelFromZodOptions<T>} [options={}] The options for model creation. Default is `{}`
 * @returns {Type} A class that represents the `zod` object and also
 * compatible with `GraphQL`.
 * @export
 */
export function modelFromZod<T extends ZodObject, O extends IModelFromZodOptions<T>>(
  zodInput: T,
  options: O = {} as O,
): Type<output<T>> {
  const { name, description } = extractNameAndDescription(zodInput, options)

  const decorator = ObjectType(name, {
    description,
    isAbstract: zodInput.isNullable() || zodInput.isOptional(),
    ...options,
  })

  try {
    return modelFromZodBase(zodInput, options, decorator, 'output')
  } catch (err) {
    throw new Error(`Failed to create GraphQL type${describeZodSchema(zodInput, options.name)}`, {
      cause: err,
    })
  }
}
