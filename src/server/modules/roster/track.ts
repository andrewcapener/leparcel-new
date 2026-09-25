/**
 * Moving a maker from one track to the other.
 *
 * Hillary, 25 Sept: "can you change an inside maker to outdoor for me? Sunsea
 * candles, she's already paid. $500 was right but she's categorized as an
 * indoor maker." There was no way to do it. setBoothSpace refuses a
 * cross-track move on purpose, because indoor and outdoor are two different
 * agreements rather than two sizes of the same thing, and it refuses any move
 * at all once money has arrived.
 *
 * Both refusals are right for a space change and wrong for a miscategorisation.
 * This is the second thing, so it gets its own door rather than a hole cut in
 * that one.
 *
 * The money does not move, and that is not luck: boothInvoice prices the space
 * line off `bookings.price_cents`, the fee snapshotted when the booking was
 * made, never off the space type's list price. So a maker who paid $500 still
 * owes $500 after the move, and the balance is untouched. That is what makes
 * this safe to allow on a paid booking when a space change is not.
 */
export type MoveRefusal = 'missing' | 'released' | 'same_space' | 'no_space'

/**
 * Why the move cannot happen, or undefined when it can.
 *
 * Deliberately NOT refused when the booking is paid. That is the case this
 * exists for.
 */
export function moveProblem(f: {
  holdsSpace: boolean
  fromTrack: string | undefined
  toTrack: string | undefined
  fromSpaceId?: string
  toSpaceId?: string
}): MoveRefusal | undefined {
  if (!f.fromTrack) return 'missing'
  if (!f.toTrack) return 'no_space'
  /* A released booking has no space to move. Put them back on the roster
     first, deliberately, rather than resurrecting one through a side door. */
  if (!f.holdsSpace) return 'released'
  /* Only a genuine no-op is refused. This used to refuse a same-track move,
     on the reasoning that the ordinary space control already did those. It
     does not do them for a maker who has paid, and that left Sunsea stranded:
     moved to outdoor, landed on Friday, and no door open to Saturday because
     one control refused the track and the other refused the payment. A
     correction is a correction whichever column was wrong. */
  if (f.fromSpaceId !== undefined && f.fromSpaceId === f.toSpaceId) return 'same_space'
  return undefined
}

/**
 * What a maker actually does at the show, which is where their BOOKED space
 * is, never what their application asked for.
 *
 * The distinction had no teeth while the two always agreed. It has teeth now:
 * an outdoor maker owes a seller's permit and runs their own register, an
 * indoor one is consignment and owes neither. Reading the application would
 * have left Sunsea reading as indoor consignment, with no permit asked for,
 * while standing at an outdoor booth.
 *
 * The application keeps saying what she applied as. That is history and it is
 * not ours to rewrite (rule 3).
 */
export function tradingTrack(spaceTrack: string | undefined, appTrack: string): string {
  return spaceTrack ?? appTrack
}

/** The notice after a move, or null for an unknown code. */
export function moveNotice(code: string): string | null {
  switch (code) {
    case 'moved':
      return 'Moved. Their fee is unchanged, because it was snapshotted when the '
        + 'booking was made and never came off the space price, so nothing is owed '
        + 'or refunded. Their day on the public lineup and what they owe us in '
        + 'paperwork both follow the new space.'
    case 'same_space':
      return 'That is the space they are already in, so nothing changed.'
    case 'released':
      return 'They are not holding a space, so there is nothing to move.'
    case 'no_space':
    case 'missing':
      return 'That space is no longer there. Nothing was changed.'
    default:
      return null
  }
}

/** The notice after showing or hiding a maker on the public lineup. */
export function lineupNotice(code: string): string | null {
  switch (code) {
    case 'hidden':
      return 'Taken off the public lineup. They keep their space and their pay link '
        + 'still works, so nothing about their booking changed and they can still pay.'
    case 'listed':
      return 'Back on the public lineup.'
    case 'missing':
      return 'That booking is no longer there. Nothing was changed.'
    default:
      return null
  }
}

