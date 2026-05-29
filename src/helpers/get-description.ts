import type { $ZodType } from 'zod/v4/core'

import { iterateZodLayers } from './unwrap'
import { getZodDescription } from './zod-core-meta'

/**
 * Extracts the description from a given type.
 *
 * The given input may also be wrapped more than one time with the ones listed above. Therefore,
 * assuming there is a value which is `Nullable<Array<Number>>` and there is no description
 * associated to the nullable and the array wrappers, the description will still tried to be
 * extracted from the number instance.
 *
 * @template T The type of the zod object.
 * @param {T} [input] The zod object input.
 * @returns {string | undefined} The description of the input or `undefined`.
 */
export function getDescription<T extends $ZodType>(input?: T): string | undefined {
  if (!input) return

  const direct = getZodDescription(input)
  if (direct) return direct

  for (const layer of iterateZodLayers(input)) {
    const layerDescription = getZodDescription(layer)
    if (layerDescription) return layerDescription
  }
}
