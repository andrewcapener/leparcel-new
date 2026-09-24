/**
 * The next Mermade ID for a show.
 *
 * One function, because there are two places a booking is created: accepting
 * a maker on the jury screen, and the roster import. They drifted, and the
 * drift cost nine makers a wrong code.
 *
 * `count` arrives from `select count(*)`, and Postgres returns a bigint, which
 * the driver hands back as a STRING. `count + 1` on a string concatenates, so
 * the eighty fifth maker was minted MM841 instead of MM85. The types said
 * `number` and tsc was happy, which is exactly why this takes the union and
 * does the conversion itself rather than trusting a caller to remember.
 *
 * `taken` is every code already on the show. A count is not a free number: a
 * released booking drops the count while the code it used stays with that
 * maker, so without this two makers can be handed the same ID, and the ID is
 * what a Venmo note is matched by.
 *
 * Pure, so the thing that decides a maker's payment reference is tested
 * rather than discovered in a spreadsheet (CLAUDE.md rule 10).
 */
export function nextVendorCode(count: string | number, taken: Iterable<string>): string {
  const used = new Set<string>()
  for (const c of taken) used.add(String(c ?? '').trim().toUpperCase())

  /* Number(), not +. See above: this is the whole bug. A count that will not
     parse is treated as no bookings rather than as NaN, which would mint the
     literal string MMNaN. */
  const from = Number(count)
  let next = Number.isFinite(from) && from >= 0 ? Math.floor(from) + 1 : 1

  while (used.has(vendorCodeFor(next))) next++
  return vendorCodeFor(next)
}

/** MM plus the number, two digits minimum and more when a show grows past 99. */
export function vendorCodeFor(n: number): string {
  return `MM${String(n).padStart(2, '0')}`
}
