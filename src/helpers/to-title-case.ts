/**
 * Creates another string where the initial letters of the words are capitalized.
 *
 * @param {string} value The input string.
 * @returns {string} A string which is title-cased.
 * @export
 */
export function toTitleCase(value: string) {
  return value.replace(/\b(\p{Alpha})(.*?)\b/u, (_string, match, rest) => {
    return match.toUpperCase() + rest
  })
}
