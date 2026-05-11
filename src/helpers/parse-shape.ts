import type { IModelFromZodOptions } from '../model-from-zod'

import { ZodObject, ZodType } from 'zod'

import { Field, NullableList } from '@nestjs/graphql'

import { getDefaultTypeProvider } from '../decorators/common'
import { buildEnumType } from './build-enum-type'
import { createZodPropertyDescriptor } from './create-zod-property-descriptor'
import { generateDefaults } from './generate-defaults'
import { getDescription } from './get-description'
import { getFieldInfoFromZod, ZodTypeInfo } from './get-field-info-from-zod'
import { Direction, getZodObjectName } from './get-zod-object-name'
import { isZodInstance } from './is-zod-instance'

/**
 * An interface describing a parsed field.
 */
export interface ParsedField {
  /**
   * The key of the parsed property.
   *
   * @type {string}
   */
  key: string

  /**
   * The type of the field of the parsed property.
   *
   * Can be used for GraphQL @{@link Field} decorator.
   *
   * @type {*}
   */
  fieldType: any

  /**
   * The {@link PropertyDescriptor} of the parsed property.
   *
   * @type {PropertyDescriptor}
   */
  descriptor: PropertyDescriptor

  /**
   * A {@link PropertyDecorator} for decorating fields.
   *
   * @type {PropertyDecorator}
   */
  decorateFieldProperty: PropertyDecorator
}

type ParseOptions<T extends ZodType>
  = IModelFromZodOptions<T>
  & {
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
 * Parses a zod input object with given options.
 *
 * @export
 * @template T The type of the zod object.
 * @param {T} zodInput The zod object input.
 * @param {ParseOptions<T>} options The options for the parsing.
 * @param {Direction} direction Whether the GraphQL type being built represents an input (what the client sends) or an output (what the schema produces).
 * @return {ParsedField[]} An array of {@link ParsedField}.
 */
export function parseShape<T extends ZodType>(
  zodInput: T,
  options: ParseOptions<T>,
  direction: Direction,
): ParsedField[] {
  if (isZodInstance(ZodObject, zodInput)) {
    return Object
      .entries(zodInput.shape)
      .map(([ key, value ]) => parseSingleShape(key, value as ZodType, options, direction))
  }

  const parsedShape = parseSingleShape('', zodInput, options, direction)
  return [ parsedShape ]
}

/**
 * Gets the nullability of a field from type info.
 *
 * @export
 * @param {ZodTypeInfo} typeInfo The type info.
 * @return {(boolean | NullableList)} The nullability state.
 */
export function getNullability(typeInfo: ZodTypeInfo): boolean | NullableList {
  const {
    isNullable,
    isOptional,
    isOfArray,
    isItemOptional,
    isItemNullable,
  } = typeInfo

  let nullable: boolean | NullableList = isNullable || isOptional

  if (isOfArray) {
    if (isItemNullable || isItemOptional) {
      if (nullable) {
        nullable = 'itemsAndList'
      }
      else {
        nullable = 'items'
      }
    }
  }

  return nullable
}

/**
 * Parses a field from given parameters.
 *
 * @template T The zod type that will be parsed.
 * @param {string} key The proprety key of the zod type.
 * @param {T} input The zod type input.
 * @param {ParseOptions<T>} options The options for parsing.
 * @param {Direction} direction Input vs. output side of transforming schemas.
 * @return {ParsedField} The parsed field output.
 */
function parseSingleShape<T extends ZodType>(
  key: string,
  input: T,
  options: ParseOptions<T>,
  direction: Direction,
): ParsedField {
  const elementType = getFieldInfoFromZod(key, input, options, direction)

  const { isEnum } = elementType

  if (isEnum) {
    buildEnumType(key, elementType, options)
  }

  const { type: fieldType } = elementType

  let defaultValue = elementType.isType ? undefined : generateDefaults(input)
  const nullable = getNullability(elementType)

  if (nullable === 'items') {
    defaultValue = undefined
  }

  const description = getDescription(input)
  const descriptor = buildPropertyDescriptor(key, input, options, direction)

  return {
    key,
    fieldType,
    descriptor,
    decorateFieldProperty: Field(() => fieldType, {
      name: key,
      nullable: nullable as any,
      defaultValue,
      description,
    })
  }
}

/**
 * Creates a property descriptor for given parameters.
 *
 * @param {string} key The key of the input in its object.
 * @param {ZodType} input The zod type input.
 * @param {ParseOptions<ZodType>} options The parse options.
 * @param {Direction} direction Input vs. output side of transforming schemas.
 * @return {PropertyDescriptor} The property descriptor created for it,
 * if the operation was successful.
 *
 * @throws {Error} - The input was not processable and there was no
 * GraphQLScalar type provided for it.
 */
function buildPropertyDescriptor(
  key: string,
  input: ZodType,
  options: ParseOptions<ZodType>,
  direction: Direction,
): PropertyDescriptor {
  if (getFieldInfoFromZod.canParse(input)) {
    return createZodPropertyDescriptor(key, input, options)
  }

  const { getScalarTypeFor = getDefaultTypeProvider() } = options
  const name = getZodObjectName(input, direction)

  if (typeof getScalarTypeFor == 'function') {
    const scalarType = getScalarTypeFor(name)

    if (typeof scalarType === 'object') {
      return createZodPropertyDescriptor(key, input, options)
    }
  }

  let error = `"${key || name}" could not be processed, a corresponding GraphQL scalar type should be provided.`
  throw new Error(error)
}
