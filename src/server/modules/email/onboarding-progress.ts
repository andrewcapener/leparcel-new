import type { InviteMaker } from './onboarding-invite'

/**
 * How far the room has got, as a number rather than a scroll.
 *
 * Drew, 30 October, an hour after sending to thirty eight makers: "a way to
 * track what percentage of people have actually gone through with inventory
 * and Stripe payout. I guess I can hop in the admin and look at the roster,
 * but I just want to know when the first successful one hits so I feel a
 * little more comfortable."
 *
 * Counting rows on the roster is how that gets answered today, and it is the
 * sort of thing nobody does twice. Two fractions and the time the first one
 * landed is the whole of what he is asking for.
 *
 * Pure, so the numbers on the screen are tested rather than trusted.
 */

/** Spaces that no longer exist do not count against anybody. */
const GONE = new Set(['cancelled', 'forfeited'])

export type Progress = {
  /** Accepted indoor makers holding a live space: the people being asked. */
  total: number
  itemsDone: number
  payoutsDone: number
  /** Both, which is the number that means a maker is finished with us. */
  bothDone: number
  /** Nobody has done either yet. Worth saying out loud rather than showing
   *  two zeroes, because zero out of nothing reads as a broken page. */
  waiting: boolean
}

/** Who is actually being asked. Outdoor makers take their own money and are
 *  never asked for either, so counting them would flatter the numbers. */
export const asked = (makers: InviteMaker[]): InviteMaker[] =>
  makers.filter((m) => m.track !== 'outdoor'
    && m.applicationStatus === 'accepted'
    && !GONE.has(m.bookingStatus))

/* A list typed and never sent is not done: that is the distinction the
   checklist draws on the maker's own page, and the invite with it. */
const itemsIn = (m: InviteMaker) => m.itemsSent && m.itemCount > 0
/* Stripe's verdict, and nothing standing in for it. */
const payoutsIn = (m: InviteMaker) => m.payoutState === 'ready'

export function progressOf(makers: InviteMaker[]): Progress {
  const cohort = asked(makers)
  return {
    total: cohort.length,
    itemsDone: cohort.filter(itemsIn).length,
    payoutsDone: cohort.filter(payoutsIn).length,
    bothDone: cohort.filter((m) => itemsIn(m) && payoutsIn(m)).length,
    waiting: cohort.length > 0
      && !cohort.some((m) => itemsIn(m) || payoutsIn(m)),
  }
}

/** A percentage a person would say, never a decimal. 0 and 100 are exact:
 *  rounding 1 of 39 up to 3% is fine, rounding 38 of 39 up to 100% is a lie. */
export function pct(done: number, total: number): number {
  if (total === 0) return 0
  if (done === 0) return 0
  if (done >= total) return 100
  return Math.max(1, Math.min(99, Math.round((done / total) * 100)))
}

/** The line under the numbers. */
export function progressNotice(p: Progress): string {
  if (p.total === 0) return 'Nobody is being asked for either of these yet.'
  if (p.waiting) return 'Nobody has finished either one yet. The first will show here.'
  if (p.bothDone === p.total) return 'Everybody is done. Nothing left to chase.'
  return `${p.bothDone} of ${p.total} have done both.`
}
