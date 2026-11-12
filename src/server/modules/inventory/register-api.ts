/**
 * Naming one line out of a maker's list, from a sentence somebody said.
 *
 * The register desk screen does not need this: a person taps the row they are
 * looking at. The API does, because what arrives is "change her five dollar
 * one to six", and five dollars might be three different things on her table.
 *
 * So the rule is that an ambiguous instruction is refused rather than
 * guessed. Picking the first match would be right most of the time, and the
 * times it was wrong would be a price quietly changed on the wrong product,
 * found by a maker reading her statement in December.
 */

export type ApiLine = {
  id: string
  label: string
  priceCents: number
}

/** How a caller says which line they mean. */
export type LineSelector = {
  /** Exact, from a previous list. Wins over everything else. */
  itemId?: string
  /** Part of the item's name, case-insensitive. */
  match?: string
  /** What it costs now, as a guard and as a way to name it. */
  fromCents?: number
}

export type Found =
  | { line: ApiLine }
  | { bad: string; candidates?: ApiLine[] }

const money = (cents: number) => {
  const whole = Math.trunc(cents / 100)
  const rest = Math.abs(cents) % 100
  return rest === 0 ? `$${whole}` : `$${whole}.${String(rest).padStart(2, '0')}`
}

export function findLine(lines: ApiLine[], sel: LineSelector): Found {
  if (lines.length === 0) return { bad: 'that maker has no prices on her list' }

  if (sel.itemId) {
    const hit = lines.find((l) => l.id === sel.itemId)
    return hit ? { line: hit } : { bad: 'no line with that id is on her list' }
  }

  const hasMatch = typeof sel.match === 'string' && sel.match.trim() !== ''
  const hasPrice = typeof sel.fromCents === 'number'
  if (!hasMatch && !hasPrice) {
    return { bad: 'say which line, by name or by what it costs now' }
  }

  const needle = (sel.match ?? '').trim().toLowerCase()
  let pool = lines
  if (hasMatch) pool = pool.filter((l) => l.label.toLowerCase().includes(needle))
  if (hasPrice) pool = pool.filter((l) => l.priceCents === sel.fromCents)

  if (pool.length === 1) return { line: pool[0] }
  if (pool.length === 0) {
    return {
      bad: hasMatch && hasPrice
        ? `nothing on her list called "${sel.match}" at ${money(sel.fromCents!)}`
        : hasMatch
          ? `nothing on her list called "${sel.match}"`
          : `nothing on her list costs ${money(sel.fromCents!)}`,
      candidates: lines,
    }
  }
  /* Several. Refused on purpose: see the note at the top of this file. */
  return {
    bad: `${pool.length} of her lines match that, so say which one by id`,
    candidates: pool,
  }
}
