/**
 * Granting and removing the spaces a maker holds.
 *
 * Drew, 26 Sept: "treat each and every one of our days and inside spaces as
 * like an a la carte product, so I have full control over what this person
 * has access to this show regardless of whatever fees they paid, and then I
 * also have full flexibility on invoicing."
 *
 * Those are two decisions, so these are two fields. A space can be granted at
 * no charge, which is what JC Beans and Alohana need: three days each, and
 * what they were invoiced is a separate conversation.
 */

export type GrantRefusal =
  | 'missing'          // the booking or the space is gone
  | 'released'         // the booking no longer holds anything
  | 'already'          // she is already on that space
  | 'wrong_track'      // an indoor booking cannot take an outdoor day
  | 'bad_price'        // the typed amount is not a number of dollars

/** Why a space cannot be granted, or undefined when it can. */
export function grantProblem(f: {
  holdsSpace: boolean
  bookingTrack: string | undefined
  spaceTrack: string | undefined
  alreadyHas: boolean
  priceCents: number | null | 'bad'
}): GrantRefusal | undefined {
  if (!f.bookingTrack || !f.spaceTrack) return 'missing'
  if (!f.holdsSpace) return 'released'
  if (f.alreadyHas) return 'already'
  /* Indoor is consignment and outdoor is a booth licence: two different
     agreements, two different commissions. Mixing them on one booking would
     make "what does this maker owe us at the end" unanswerable. Moving a
     maker wholesale between tracks is its own control (move-track.ts). */
  if (f.bookingTrack !== f.spaceTrack) return 'wrong_track'
  if (f.priceCents === 'bad') return 'bad_price'
  return undefined
}

/**
 * Dollars a staff member typed, as integer cents, or null for no charge, or
 * 'bad' for anything else.
 *
 * Empty means no charge on purpose: the common case is granting a day to a
 * maker whose fee already covers it, and making somebody type 0 for that
 * invites typing something else by accident.
 *
 * Money is integer cents and never a float (rule 1), so the parse is done on
 * the text rather than by multiplying a Number by 100.
 */
export function priceFromDollars(raw: string): number | null | 'bad' {
  const t = (raw ?? '').trim().replace(/^\$/, '').replace(/,/g, '')
  if (t === '') return null
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return 'bad'
  const neg = t.startsWith('-')
  const [whole, frac = ''] = t.replace(/^-/, '').split('.')
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > 100_000_00) return 'bad'
  return neg ? -cents : cents
}

/** What the screen says about a space. */
export function spaceNotice(code: string): string | null {
  switch (code) {
    case 'granted':
      return 'Added. They are on that space now and it shows on the public lineup. '
        + 'If you gave it a price it is on their invoice as its own line, and you can '
        + 'send them the invoice again from here.'
    case 'free':
      return 'Added at no charge. They are on that space now and it shows on the public '
        + 'lineup. Nothing was added to their invoice.'
    case 'removed':
      return 'Taken off. It stays on the record with who removed it and why. If they '
        + 'paid for it, this does not refund them: send the money back and note it here.'
    case 'already':
      return 'They are already on that space, so nothing changed.'
    case 'wrong_track':
      return 'That space is on the other track. Indoor and outdoor are different '
        + 'agreements, so use Put them somewhere else to change track.'
    case 'released':
      return 'They are not holding a space, so there is nothing to add to.'
    case 'bad_price':
      return 'That price is not a number of dollars. Leave it empty to add the space '
        + 'at no charge.'
    case 'last_one':
      return 'That is the only space they hold. Remove them from the show instead, or '
        + 'move them somewhere else.'
    case 'missing':
      return 'That space is no longer there. Nothing was changed.'
    default:
      return null
  }
}
