/** The enum provider data. */
export interface EnumProviderData {
  /**
   * The property name of the enum.
   *
   * @memberof EnumProviderData
   * @type {string}
   */
  name: string

  /**
   * The parent name that contains the enum type.
   *
   * @memberof EnumProviderData
   * @type {string}
   */
  parentName?: string

  /**
   * The description of the enum.
   *
   * @memberof EnumProviderData
   * @type {string}
   */
  description?: string

  /**
   * Indicates whether the enum is a numeric TypeScript enum (the v3 `z.nativeEnum` shape, where the
   * input object carries reverse mappings and the schema's values include numbers).
   *
   * Zod v4 unified `z.enum` and `z.nativeEnum`, so the field is no longer a 1:1 mirror of which
   * builder was used — it now reflects the runtime shape of the underlying enum object.
   * String-keyed enums (whether created from a plain object or a TypeScript string enum) report
   * `false`; only numeric TypeScript enums report `true`.
   *
   * @memberof EnumProviderData
   * @type {boolean}
   */
  isNative?: boolean
}

/**
 * Gets an enum type for given information.
 *
 * Use this function to prevent creating different enums in GraphQL schema if you are going to use
 * same values in different places.
 *
 * @memberof IModelFromZodOptions
 * @param {Record<string, string | number>} enumObject The enum object that is extracted from the
 *   zod.
 * @param {EnumProviderData} info The information of the enum property.
 * @returns {Record<string, string | number> | undefined} The enum that will be used instead of
 *   creating a new one. If `undefined` is returned, then a new enum will be created.
 */
export type EnumProvider = (enumObject: object, info: EnumProviderData) => object | undefined
