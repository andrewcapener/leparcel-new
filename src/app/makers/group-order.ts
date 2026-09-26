/**
 * The order the whole grid reads in when no section is chosen.
 *
 * Drew, 26 Sept: "the everyone filter organizes differently from the sorting
 * in the specific sections. Let's show organization based on the sections. So
 * when you first come to the page it's indoor first, showing indoor how
 * indoor was sorted."
 *
 * He is describing a real mismatch. Everyone used to be the raw order the
 * server returned, which sorts by the booked SPACE. Junior makers book a
 * space called "JR Space", which is an indoor space with its own place in
 * that order, so they landed scattered through the indoor makers on Everyone
 * and gathered together the moment somebody pressed Junior. Two different
 * answers to the same question.
 *
 * So Everyone is now the sections, in the order the tabs list them, each one
 * internally exactly as that tab shows it. The first thing a shopper sees is
 * the indoor grid, arranged the way staff arranged it.
 */

/** The sections, in the order they are offered and shown. */
export const GROUP_KEYS = ['indoor', 'junior', 'friday', 'saturday', 'sunday'] as const

const RANK = new Map(GROUP_KEYS.map((k, i) => [k as string, i]))

/**
 * Sorted by section, and by nothing else.
 *
 * Array.prototype.sort is stable, which is what carries the within-section
 * order through untouched: two makers in the same section compare equal and
 * keep the order they arrived in, which is the order staff put them in on
 * /admin/lineup. Sorting on anything more here would quietly overrule them.
 *
 * A group nobody recognises sorts to the end rather than to the front, so a
 * space type added later cannot silently take over the top of the page.
 */
export function bySection<T extends { group: string }>(makers: readonly T[]): T[] {
  return [...makers].sort(
    (a, b) => (RANK.get(a.group) ?? GROUP_KEYS.length) - (RANK.get(b.group) ?? GROUP_KEYS.length),
  )
}
