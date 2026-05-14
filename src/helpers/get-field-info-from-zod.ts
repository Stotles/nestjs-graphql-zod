import { GraphQLScalarType } from 'graphql/type/definition'
import {
  ZodArray,
  ZodBoolean,
  ZodDefault,
  ZodEnum,
  ZodLazy,
  ZodNonOptional,
  ZodNullable,
  ZodNumber,
  ZodObject,
  ZodOptional,
  ZodPipe,
  ZodPrefault,
  ZodReadonly,
  ZodString,
  ZodStringFormat,
  ZodType,
} from 'zod'

import { Int } from '@nestjs/graphql'

import { getDefaultTypeProvider } from '../decorators/common'
import {
  IModelFromZodOptions,
  modelFromZod,
  modelFromZodBase,
} from '../model-from-zod'
import { Direction, getZodObjectName, resolvePipeTarget } from './get-zod-object-name'
import { isZodInstance } from './is-zod-instance'
import { toTitleCase } from './to-title-case'

/**
 * Describes the properties of a zod type that can be used to apply to `Field`
 * decorator of NestJS.
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
   * @type {*}
   * @memberof ZodTypeInfo
   */
  type: any

  /**
   * Indicates whether or not the prperty is optional.
   *
   * @type {boolean}
   * @memberof ZodTypeInfo
   */
  isOptional: boolean

  /**
   * Indicates whether or not the property is nullable.
   *
   * @type {boolean}
   * @memberof ZodTypeInfo
   */
  isNullable: boolean

  /**
   * Indicates whether or not the property is an enum type.
   *
   * @type {boolean}
   * @memberof ZodTypeInfo
   */
  isEnum?: boolean

  /**
   * Indicates whether or not the property is an object (another type).
   *
   * @type {boolean}
   * @memberof ZodTypeInfo
   */
  isType?: boolean

  /**
   * Indicates whether or not the property is an array.
   *
   * @type {boolean}
   * @memberof ZodTypeInfo
   */
  isOfArray?: boolean

  /**
   * Indicates whether or not the item of the array of the property is
   * optional.
   *
   * @type {boolean}
   * @memberof ZodTypeInfo
   */
  isItemOptional?: boolean

  /**
   * Indicates whether or not the item of the array of the property is
   * nullable.
   *
   * @type {boolean}
   * @memberof ZodTypeInfo
   */
  isItemNullable?: boolean
}

/**
 * The options for {@link getFieldInfoFromZod} function.
 *
 * @template T The zod type.
 */
type Options<T extends ZodType> = IModelFromZodOptions<T> & {
  /**
   * Provides the decorator to decorate the dynamically generated class.
   *
   * @param {T} zodInput The zod input.
   * @param {string} key The name of the currently processsed property.
   * @return {ClassDecorator} The class decorator to decorate the class.
   * @memberof IOptions
   */
  getDecorator?(zodInput: T, key: string): ClassDecorator
}

/**
 * Converts a given `zod` object input for a key, into {@link ZodTypeInfo}.
 *
 * @export
 * @template T The type of the `zod` object input.
 * @param {string} key The key of the property of the `zod` object input,
 * that is being converted.
 *
 * @param {ZodType} prop The `zod` object property.
 * @param {Options<T>} options The options for conversion.
 * @param {Direction} direction Whether to resolve the input (client-sent) or output (server-produced) side of transforming schemas like `ZodPipe`.
 * @return {ZodTypeInfo} The {@link ZodTypeInfo} of the property.
 */
export function getFieldInfoFromZod<T extends ZodType>(
  key: string,
  prop: ZodType,
  options: Options<T>,
  direction: Direction
): ZodTypeInfo {
  // Honour an explicit GraphQL type hint attached via zod's `.meta()` system. This
  // is the escape hatch for schemas whose type the library cannot recover
  // from the schema shape alone (e.g. a `.transform(fn)` on the output side).
  // Checked before pattern-matching so the hint wins over normal inference.
  const graphqlTypeHint = direction === 'input' ? prop.meta()?.graphqlTypeInput : prop.meta()?.graphqlTypeOutput
  if (graphqlTypeHint) {
    if (typeof graphqlTypeHint === 'function') {
      return {
        type: graphqlTypeHint(),
        isOptional: isOptional(prop),
        isNullable: isNullable(prop),
      }   
    }
    throw new Error(`The "graphqlType${toTitleCase(direction)}" meta property for Key("${key}") is not a function.`)
  }

  // Fundamental types
  if (isZodInstance(ZodArray, prop)) {
    const data = getFieldInfoFromZod(key, prop.element as ZodType, options, direction)

    const {
      type,
      isEnum,
      isNullable: isItemNullable,
      isOptional: isItemOptional,
    } = data

    return {
      type: [ type ],
      isOptional: isOptional(prop),
      isNullable: isNullable(prop),
      isEnum,
      isOfArray: true,
      isItemNullable,
      isItemOptional,
    }
  }
  if (isZodInstance(ZodBoolean, prop)) {
    return {
      type: Boolean,
      isOptional: isOptional(prop),
      isNullable: isNullable(prop),
    }
  }
  if (isZodInstance(ZodString, prop) || isZodInstance(ZodStringFormat, prop)) {
    return {
      type: String,
      isOptional: isOptional(prop),
      isNullable: isNullable(prop),
    }
  }
  if (isZodInstance(ZodNumber, prop)) {
    const format = prop.format
    // Purposely not including `uint32` since GraphQL Int type is a signed 32-bit integer
    const isInt = format === 'safeint' || format === 'int32'

    return {
      type: isInt ? Int : Number,
      isOptional: isOptional(prop),
      isNullable: isNullable(prop),
    }
  }
  if (isZodInstance(ZodObject, prop)) {
    const {
      provideNameForNestedClass = defaultNestedClassNameProvider,
    } = options

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
      description: prop.description,
      isAbstract: isNullable(prop) || isOptional(prop),
    }

    let model: any
    if (typeof options.getDecorator === 'function') {
      model = modelFromZodBase(
        prop as any,
        nestedOptions,
        options.getDecorator(prop as any as T, nestedOptions.name),
        direction,
      )
    } else {
      // No decorator override means we fall back to `@ObjectType` via
      // `modelFromZod` — which is only meaningful on the output path. An
      // input-side caller must supply a `getDecorator` so nested ZodObjects
      // get wrapped with `@InputType` instead.
      if (direction !== 'output') {
        throw new Error(
          `Cannot build nested type for "${key}": direction is "${direction}" `
          + `but no \`getDecorator\` was provided to wrap nested ZodObjects. `
          + `Supply \`getDecorator\` in options (or use an input-side entry `
          + `point like \`InputTypeWithZod\`).`
        )
      }
      model = modelFromZod(prop as any, nestedOptions)
    }

    return {
      type: model,
      isType: true,
      isNullable: isNullable(prop),
      isOptional: isOptional(prop),
    }
  }
  if (isZodInstance(ZodEnum, prop)) {
    return {
      type: prop,
      isNullable: isNullable(prop),
      isOptional: isOptional(prop),
      isEnum: true,
    }
  }

  // Basic wrappers which don't change the type, nullability or optionality
  if (isZodInstance(ZodDefault, prop)) {
    return getFieldInfoFromZod(key, prop._def.innerType as ZodType, options, direction)
  }
  if (isZodInstance(ZodReadonly, prop)) {
    return getFieldInfoFromZod(key, prop._def.innerType as ZodType, options, direction)
  }
  if (isZodInstance(ZodPrefault, prop)) {
    return getFieldInfoFromZod(key, prop._def.innerType as ZodType, options, direction)
  }

  // Wrappers which may change the nullability or optionality, but not the type
  if (isZodInstance(ZodOptional, prop)) {
    const {
      type,
      isEnum,
      isOfArray,
      isItemNullable,
      isItemOptional,
    } = getFieldInfoFromZod(key, prop.unwrap() as ZodType, options, direction)

    return {
      type,
      isEnum,
      isOfArray,
      isItemNullable,
      isItemOptional,
      isOptional: true,
      isNullable: isNullable(prop),
    }
  }
  if (isZodInstance(ZodNonOptional, prop)) {
    const inner = getFieldInfoFromZod(key, prop._def.innerType as ZodType, options, direction)
    return { ...inner, isOptional: false }
  }
  if (isZodInstance(ZodNullable, prop)) {
    const inner = getFieldInfoFromZod(key, prop._def.innerType as ZodType, options, direction)
    return { ...inner, isNullable: true }
  }

  // Wrappers which can change the type, nullability and optionality
  if (isZodInstance(ZodPipe, prop)) {
    return getFieldInfoFromZod(key, resolvePipeTarget(prop, direction, key), options, direction)
  }
  if (isZodInstance(ZodLazy, prop)) {
    const getter = prop._def.getter
    if (typeof getter !== 'function') {
      throw new Error(`Invalid ZodLazy schema for Key("${key}"): getter is not a function.`)
    }

    const lazyType = getter()
    if (!isZodInstance(ZodType, lazyType)) {
      throw new Error(`Invalid ZodLazy schema for Key("${key}"): getter did not return a valid ZodType.`)
    }

    return getFieldInfoFromZod(key, lazyType as ZodType, options, direction)
  }

  // Fallback if type isn't directly supported
  const { getScalarTypeFor = getDefaultTypeProvider() } = options
  const typeName = getZodObjectName(prop, direction)

  if (typeof getScalarTypeFor === 'function') {
    const scalarType = getScalarTypeFor(typeName)
    let isScalarType = scalarType instanceof GraphQLScalarType

    if (!isScalarType && scalarType) {
      let constructor: Function = (scalarType as any)[ 'constructor' ]
      if (typeof constructor === 'function' && constructor.name === GraphQLScalarType.name) {
        isScalarType = true
      }
    }

    if (isScalarType) {
      return {
        isType: true,
        type: scalarType,
        isNullable: isNullable(prop),
        isOptional: isOptional(prop),
      }
    }
    else {
      throw new Error(`The Scalar(Value="${scalarType}", Type="${typeof scalarType}") as Key("${key}") of Type("${typeName}") was not an instance of GraphQLScalarType.`)
    }
  }

  throw new Error(`Unsupported type info of Key("${key}") of Type("${typeName}")`)

}

export module getFieldInfoFromZod {
  /**
   * The types that are parseable by the {@link getFieldInfoFromZod} function.
   */
  export const PARSED_TYPES = [
    ZodArray,
    ZodBoolean,
    ZodDefault,
    ZodEnum,
    ZodLazy,
    ZodNonOptional,
    ZodNullable,
    ZodNumber,
    ZodObject,
    ZodOptional,
    ZodPipe,
    ZodPrefault,
    ZodReadonly,
    ZodString,
    ZodStringFormat,
  ] as const

  /**
   * Determines if the given zod type is parseable by the {@link getFieldInfoFromZod}
   * function.
   *
   * @export
   * @param {ZodType} input The zod type input.
   * @return {boolean} `true` if the given input is parseable.
   */
  export function canParse(input: ZodType): boolean {
    if (typeof input.meta()?.graphqlTypeInput === 'function') return true
    if (typeof input.meta()?.graphqlTypeOutput === 'function') return true
    return PARSED_TYPES.some(it => isZodInstance(it, input))
  }
}

// `safeParse` despite its name can throw if the schema contains `.transform()`
// or `.preprocess()` that throw on inputs they can't handle. In those cases, we
// just assume it can't handle `undefined`/`null` and return false since it will
// be a mistake to throw in that scenario. While there is a small risk of masking
// a real error from zod, this is something we accept since ZodError shouldn't be
// ever returned here.
function isOptional(prop: ZodType): boolean {
  try {
    return prop.safeParse(undefined).success
  } catch {
    return false
  }
}

function isNullable(prop: ZodType): boolean {
  try {
    return prop.safeParse(null).success
  } catch {
    return false
  }
}

/**
 * Provides a name for nested classes.
 *
 * @param {string} parentName The parent class name.
 * @param {string} propertyKey The property key.
 * @return {string} A new name for the new class.
 *
 * @__PURE__
 */
function defaultNestedClassNameProvider(parentName: string, propertyKey: string): string {
  return `${parentName}_${toTitleCase(propertyKey)}`
}
