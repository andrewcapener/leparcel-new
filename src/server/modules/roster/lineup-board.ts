/**
 * What one press of Save on the lineup board actually changes.
 *
 * The board posts two things: the order every card is in, and which cards are
 * ticked to show. Both arrive as strings from a form, from a screen where
 * somebody has been dragging things around, so neither can be trusted to be
 * complete, unique, or about this show at all.
 *
 * Kept pure and tested because the failure it prevents is quiet: a save that
 * silently drops a maker off the public lineup because her id did not survive
 * a round trip is not an error anybody sees until a maker asks why she is not
 * on the website.
 */

/**
 * The ids to write, in the order they were dragged into.
 *
 * Anything not on the board is ignored rather than trusted, duplicates keep
 * their first position, and anything on the board that never came back is
 * appended in its original order. That last rule is the important one: a
 * maker missing from the posted order keeps her place instead of vanishing.
 */
export function orderedIds(posted: string, known: readonly string[]): string[] {
  const valid = new Set(known)
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of posted.split(',')) {
    const id = raw.trim()
    if (!id || !valid.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  for (const id of known) if (!seen.has(id)) out.push(id)
  return out
}

/**
 * Which rows actually need writing, so a save that changed one card does not
 * rewrite eighty eight rows and eighty eight audit entries.
 */
export function orderChanges(
  ordered: readonly string[], current: ReadonlyMap<string, number | null>,
): Array<{ id: string; lineupOrder: number }> {
  const out: Array<{ id: string; lineupOrder: number }> = []
  ordered.forEach((id, i) => {
    if (current.get(id) !== i) out.push({ id, lineupOrder: i })
  })
  return out
}

/**
 * Who goes on and who comes off, from the ticked boxes.
 *
 * An unchecked box is not sent by a browser at all, so the board posts the
 * ticked ones and absence means hidden. That is only safe because the set of
 * cards on the board is known: `known` is what bounds it, and a maker who was
 * never on the board is never touched.
 */
export function visibilityChanges(
  shown: readonly string[], known: readonly string[],
  hiddenNow: ReadonlySet<string>,
): { hide: string[]; list: string[] } {
  const wantShown = new Set(shown.filter((id) => known.includes(id)))
  const hide: string[] = []
  const list: string[] = []
  for (const id of known) {
    const isHidden = hiddenNow.has(id)
    const wantHidden = !wantShown.has(id)
    if (wantHidden && !isHidden) hide.push(id)
    if (!wantHidden && isHidden) list.push(id)
  }
  return { hide, list }
}

/** What the screen says after a save. */
export function boardNotice(moved: number, hidden: number, listed: number): string {
  if (moved === 0 && hidden === 0 && listed === 0) return 'Nothing changed.'
  const bits: string[] = []
  if (moved > 0) bits.push(`${moved} ${moved === 1 ? 'maker' : 'makers'} moved`)
  if (hidden > 0) bits.push(`${hidden} taken off`)
  if (listed > 0) bits.push(`${listed} put back`)
  return `Saved: ${bits.join(', ')}. The public lineup is updated.`
}
