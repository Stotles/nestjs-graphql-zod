import { GraphQLScalarType } from 'graphql/type/definition'
import {
  $ZodArray,
  $ZodBoolean,
  $ZodDefault,
  $ZodEnum,
  $ZodLazy,
  $ZodNonOptional,
  $ZodNullable,
  $ZodNumber,
  $ZodObject,
  $ZodOptional,
  $ZodPipe,
  $ZodPrefault,
  $ZodReadonly,
  $ZodString,
  $ZodStringFormat,
  $ZodType,
} from 'zod/v4/core'

import type { Type } from '@nestjs/common'
import { Int } from '@nestjs/graphql'

import { getDefaultTypeProvider } from '../decorators/common'
import { IModelFromZodOptions, modelFromZod, modelFromZodBase } from '../model-from-zod'
import { MAX_ZOD_DEPTH } from './constants'
import { Direction, getZodObjectName, resolvePipeTarget } from './get-zod-object-name'
import { isZodInstance } from './is-zod-instance'
import { toTitleCase } from './to-title-case'
import { getZodDescription, getZodMeta, isNullableSchema, isOptionalSchema } from './zod-core-meta'

// Tracks nested invocation depth of `getFieldInfoFromZod`. Each recursive
// branch ($ZodArray element, $ZodOptional/Nullable/Readonly/Default/Prefault/
// NonOptional inner type, $ZodPipe direction target, $ZodLazy getter result)
// increments this counter. The hard cap protects against `$ZodLazy` chains
// that don't resolve through a `$ZodObject` — those bypass the class cache
// in `modelFromZodBase` and would otherwise recurse until the JS stack runs
// out (e.g. `let self; self = z.lazy(() => self)` at a field position).
let _getFieldInfoDepth = 0

/**
 * Describes the properties of a zod type that can be used to apply to `Field` decorator of NestJS.
 *
 * @export
 * @interface ZodTypeInfo
 */
export interface ZodTypeInfo {
  /**
   * The corresponing type of the `zod` property.
   *
   * This type will be used by the `Field` property of the NestJS decorators.
   *
   * @memberof ZodTypeInfo
   * @type {any}
   */
  type: any

  /**
   * Indicates whether or not the prperty is optional.
   *
   * @memberof ZodTypeInfo
   * @type {boolean}
   */
  isOptional: boolean

  /**
   * Indicates whether or not the property is nullable.
   *
   * @memberof ZodTypeInfo
   * @type {boolean}
   */
  isNullable: boolean

  /**
   * Indicates whether or not the property is an enum type.
   *
   * @memberof ZodTypeInfo
   * @type {boolean}
   */
  isEnum?: boolean

  /**
   * Indicates whether or not the property is an object (another type).
   *
   * @memberof ZodTypeInfo
   * @type {boolean}
   */
  isType?: boolean

  /**
   * Indicates whether or not the property is an array.
   *
   * @memberof ZodTypeInfo
   * @type {boolean}
   */
  isOfArray?: boolean

  /**
   * Indicates whether or not the item of the array of the property is optional.
   *
   * @memberof ZodTypeInfo
   * @type {boolean}
   */
  isItemOptional?: boolean

  /**
   * Indicates whether or not the item of the array of the property is nullable.
   *
   * @memberof ZodTypeInfo
   * @type {boolean}
   */
  isItemNullable?: boolean
}

/**
 * The options for {@link getFieldInfoFromZod} function.
 *
 * @template T The zod type.
 */
type Options<T extends $ZodType> = IModelFromZodOptions<T> & {
  /**
   * Provides the decorator to decorate the dynamically generated class.
   *
   * @memberof IOptions
   * @param {$ZodType} zodInput The zod input.
   * @param {string} key The name of the currently processsed property.
   * @returns {ClassDecorator} The class decorator to decorate the class.
   */
  getDecorator?: (zodInput: $ZodType, key: string) => ClassDecorator
}

/**
 * Converts a given `zod` object input for a key, into {@link ZodTypeInfo}.
 *
 * @template T The type of the `zod` object input.
 * @param {string} key The key of the property of the `zod` object input, that is being converted.
 * @param {$ZodType} prop The `zod` object property.
 * @param {Options<T>} options The options for conversion.
 * @param {Direction} direction Whether to resolve the input (client-sent) or output
 *   (server-produced) side of transforming schemas like `$ZodPipe`.
 * @returns {ZodTypeInfo} The {@link ZodTypeInfo} of the property.
 * @export
 */
export function getFieldInfoFromZod<T extends $ZodType>(
  key: string,
  prop: $ZodType,
  options: Options<T>,
  direction: Direction,
): ZodTypeInfo {
  if (_getFieldInfoDepth >= MAX_ZOD_DEPTH) {
    throw new Error(
      `getFieldInfoFromZod exceeded MAX_ZOD_DEPTH (${MAX_ZOD_DEPTH}) at Key("${key}"). ` +
        `This usually indicates a ZodLazy chain that doesn't resolve through a ` +
        `ZodObject (whose generated class would have terminated the recursion via ` +
        `the class cache).`,
    )
  }

  _getFieldInfoDepth++
  try {
    return getFieldInfoFromZodInner(key, prop, options, direction)
  } finally {
    // Always decrement the depth counter, even if it errors out so if something
    // catches the error and continues, it won't be permanently stuck at max depth.
    _getFieldInfoDepth--
  }
}

function getFieldInfoFromZodInner<T extends $ZodType>(
  key: string,
  prop: $ZodType,
  options: Options<T>,
  direction: Direction,
): ZodTypeInfo {
  // Honour an explicit GraphQL type hint attached via zod's metadata registry.
  // This is the escape hatch for schemas whose type the library cannot recover
  // from the schema shape alone (e.g. a `.transform(fn)` on the output side).
  // Checked before pattern-matching so the hint wins over normal inference.
  const meta = getZodMeta(prop)
  const graphqlTypeHint = direction === 'input' ? meta?.graphqlTypeInput : meta?.graphqlTypeOutput
  if (graphqlTypeHint) {
    if (typeof graphqlTypeHint === 'function') {
      return {
        type: graphqlTypeHint(),
        isOptional: isOptionalSchema(prop),
        isNullable: isNullableSchema(prop),
      }
    }
    throw new Error(
      `The "graphqlType${toTitleCase(direction)}" meta property for Key("${key}") is not a function.`,
    )
  }

  // Fundamental types
  if (isZodInstance($ZodArray, prop)) {
    const data = getFieldInfoFromZod(key, prop._zod.def.element, options, direction)

    const { type, isEnum, isNullable: isItemNullable, isOptional: isItemOptional } = data

    return {
      type: [type],
      isOptional: isOptionalSchema(prop),
      isNullable: isNullableSchema(prop),
      isEnum,
      isOfArray: true,
      isItemNullable,
      isItemOptional,
    }
  }
  if (isZodInstance($ZodBoolean, prop)) {
    return {
      type: Boolean,
      isOptional: isOptionalSchema(prop),
      isNullable: isNullableSchema(prop),
    }
  }
  if (isZodInstance($ZodString, prop) || isZodInstance($ZodStringFormat, prop)) {
    return {
      type: String,
      isOptional: isOptionalSchema(prop),
      isNullable: isNullableSchema(prop),
    }
  }
  if (isZodInstance($ZodNumber, prop)) {
    // The format produced by `.int()` / `.int32()` / `z.int()` / `z.int32()` is
    // tracked in the schema's `bag` (populated by the `number_format` check's
    // `onattach`). Reading `bag.format` here covers both `z.number().int()` —
    // which stays a plain `$ZodNumber` with a check attached — and `z.int()`
    // — which is a `$ZodNumberFormat` instance with the same bag entry.
    const format = prop._zod.bag.format
    // Purposely not including `uint32` since GraphQL Int type is a signed 32-bit integer
    const isInt = format === 'safeint' || format === 'int32'

    return {
      type: isInt ? Int : Number,
      isOptional: isOptionalSchema(prop),
      isNullable: isNullableSchema(prop),
    }
  }
  if (isZodInstance($ZodObject, prop)) {
    const { provideNameForNestedClass = defaultNestedClassNameProvider } = options

    let name = provideNameForNestedClass(options.name || '', key)
    if (typeof name !== 'string') {
      name = defaultNestedClassNameProvider(options.name || '', key)
    }

    name = name.trim()
    if (!name) {
      name = defaultNestedClassNameProvider(options.name || '', key)
    }

    const nestedOptions = {
      ...options,
      name,
      description: getZodDescription(prop),
      isAbstract: isNullableSchema(prop) || isOptionalSchema(prop),
    }

    let model: any
    if (typeof options.getDecorator === 'function') {
      model = modelFromZodBase(
        prop,
        nestedOptions,
        options.getDecorator(prop, nestedOptions.name),
        direction,
      )
    } else {
      // No decorator override means we fall back to `@ObjectType` via
      // `modelFromZod` — which is only meaningful on the output path. An
      // input-side caller must supply a `getDecorator` so nested ZodObjects
      // get wrapped with `@InputType` instead.
      if (direction !== 'output') {
        throw new Error(
          `Cannot build nested type for "${key}": direction is "${direction}" ` +
            `but no \`getDecorator\` was provided to wrap nested ZodObjects. ` +
            `Supply \`getDecorator\` in options (or use an input-side entry ` +
            `point like \`InputTypeWithZod\`).`,
        )
      }
      model = modelFromZod(prop, nestedOptions)
    }

    return {
      type: model,
      isType: true,
      isNullable: isNullableSchema(prop),
      isOptional: isOptionalSchema(prop),
    }
  }
  if (isZodInstance($ZodEnum, prop)) {
    return {
      type: prop,
      isNullable: isNullableSchema(prop),
      isOptional: isOptionalSchema(prop),
      isEnum: true,
    }
  }

  // Basic wrappers which don't change the type, nullability or optionality
  if (isZodInstance($ZodDefault, prop)) {
    return getFieldInfoFromZod(key, prop._zod.def.innerType, options, direction)
  }
  if (isZodInstance($ZodReadonly, prop)) {
    return getFieldInfoFromZod(key, prop._zod.def.innerType, options, direction)
  }
  if (isZodInstance($ZodPrefault, prop)) {
    return getFieldInfoFromZod(key, prop._zod.def.innerType, options, direction)
  }

  // Wrappers which may change the nullability or optionality, but not the type
  if (isZodInstance($ZodOptional, prop)) {
    const { type, isEnum, isOfArray, isItemNullable, isItemOptional } = getFieldInfoFromZod(
      key,
      prop._zod.def.innerType,
      options,
      direction,
    )

    return {
      type,
      isEnum,
      isOfArray,
      isItemNullable,
      isItemOptional,
      isOptional: true,
      isNullable: isNullableSchema(prop),
    }
  }
  if (isZodInstance($ZodNonOptional, prop)) {
    const inner = getFieldInfoFromZod(key, prop._zod.def.innerType, options, direction)
    return { ...inner, isOptional: false }
  }
  if (isZodInstance($ZodNullable, prop)) {
    const inner = getFieldInfoFromZod(key, prop._zod.def.innerType, options, direction)
    return { ...inner, isNullable: true }
  }

  // Wrappers which can change the type, nullability and optionality
  if (isZodInstance($ZodPipe, prop)) {
    return getFieldInfoFromZod(key, resolvePipeTarget(prop, direction, key), options, direction)
  }
  if (isZodInstance($ZodLazy, prop)) {
    const getter = prop._zod.def.getter
    if (typeof getter !== 'function') {
      throw new Error(`Invalid ZodLazy schema for Key("${key}"): getter is not a function.`)
    }

    const lazyType = getter()
    if (!isZodInstance($ZodType, lazyType)) {
      throw new Error(
        `Invalid ZodLazy schema for Key("${key}"): getter did not return a valid ZodType.`,
      )
    }

    return getFieldInfoFromZod(key, lazyType, options, direction)
  }

  // Fallback if type isn't directly supported
  const { getScalarTypeFor = getDefaultTypeProvider() } = options
  const typeName = getZodObjectName(prop, direction)

  if (typeof getScalarTypeFor === 'function') {
    const scalarType = getScalarTypeFor(typeName)
    let isScalarType = scalarType instanceof GraphQLScalarType

    if (!isScalarType && scalarType) {
      let constructor: Function = scalarType['constructor']
      if (typeof constructor === 'function' && constructor.name === GraphQLScalarType.name) {
        isScalarType = true
      }
    }

    if (isScalarType) {
      return {
        isType: true,
        type: scalarType,
        isNullable: isNullableSchema(prop),
        isOptional: isOptionalSchema(prop),
      }
    } else {
      throw new Error(
        `The Scalar(Value="${String(scalarType)}", Type="${typeof scalarType}") as Key("${key}") of Type("${typeName}") was not an instance of GraphQLScalarType.`,
      )
    }
  }

  throw new Error(`Unsupported type info of Key("${key}") of Type("${typeName}")`)
}

export namespace getFieldInfoFromZod {
  // Explicit annotation (rather than `as const`) so the emitted declaration
  // doesn't reference zod's internal `EnumValue` util type pulled in via
  // `ZodEnum`'s constructor signature — TS 6 can't name that portably.

  /** The types that are parseable by the {@link getFieldInfoFromZod} function. */
  export const PARSED_TYPES: readonly Type<$ZodType>[] = [
    $ZodArray,
    $ZodBoolean,
    $ZodDefault,
    $ZodEnum,
    $ZodLazy,
    $ZodNonOptional,
    $ZodNullable,
    $ZodNumber,
    $ZodObject,
    $ZodOptional,
    $ZodPipe,
    $ZodPrefault,
    $ZodReadonly,
    $ZodString,
    $ZodStringFormat,
  ]

  /**
   * Determines if the given zod type is parseable by the {@link getFieldInfoFromZod} function.
   *
   * @param {$ZodType} input The zod type input.
   * @returns {boolean} `true` if the given input is parseable.
   * @export
   */
  export function canParse(input: $ZodType): boolean {
    const meta = getZodMeta(input)
    if (typeof meta?.graphqlTypeInput === 'function') return true
    if (typeof meta?.graphqlTypeOutput === 'function') return true
    return PARSED_TYPES.some((it) => isZodInstance(it, input))
  }
}

/**
 * Provides a name for nested classes.
 *
 * @param {string} parentName The parent class name.
 * @param {string} propertyKey The property key.
 * @returns {string} A new name for the new class.
 * @__PURE__
 */
function defaultNestedClassNameProvider(parentName: string, propertyKey: string): string {
  return `${parentName}_${toTitleCase(propertyKey)}`
}
