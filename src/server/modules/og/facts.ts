/**
 * The two facts the share card's headline is built from.
 *
 * Both come off the Show record. The card used to say `Dana Point ${venueName}`
 * with the town typed in here, which is the thing CLAUDE.md rule 6 exists to
 * stop: this market has changed venue three times in three shows, and a town
 * in the source is a town somebody has to remember to edit.
 */

/**
 * The town, out of the venue's own address.
 *
 * "24642 San Juan Avenue, Dana Point, CA 92629" is the shape staff type at
 * /admin/show, and the town is the second field. Anything that is not that
 * shape returns undefined rather than a guess, and the caller leaves the town
 * off the card: a headline missing a town is a small loss, and a headline
 * naming the wrong one sends people to the wrong place.
 */
export function cityOf(address: string | null | undefined): string | undefined {
  const parts = (address ?? '').split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 3) return undefined
  const city = parts[1]
  /* A street number in the second field means the address is not in the shape
     above, e.g. a suite line was typed as its own field. */
  if (!city || /\d/.test(city)) return undefined
  return city
}

/**
 * "November 13-15", the dates with the year left off.
 *
 * Drew, 24 Sept 2026, and he is right: the year is the least useful thing on
 * a card somebody sees weeks before the show, and the market's own posters
 * for this season do not carry it either. The town goes in the space it
 * frees, which is what a person actually needs in order to decide.
 *
 * Pacific, like every date this application renders (rule 8).
 */
const TZ = 'America/Los_Angeles'

export function datesNoYear(startIso: string, endIso: string): string {
  const s = new Date(startIso), e = new Date(endIso)
  const month = s.toLocaleDateString('en-US', { timeZone: TZ, month: 'long' })
  const d1 = s.toLocaleDateString('en-US', { timeZone: TZ, day: 'numeric' })
  const d2 = e.toLocaleDateString('en-US', { timeZone: TZ, day: 'numeric' })
  /* A show inside one day says that day once rather than "13-13". */
  return d1 === d2 ? `${month} ${d1}` : `${month} ${d1}-${d2}`
}
