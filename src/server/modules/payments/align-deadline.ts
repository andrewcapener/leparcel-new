/**
 * Put every unpaid booking on the show's deadline.
 *
 * Drew, 22 Sept: "everyone's fees are due tomorrow midnight regardless of
 * acceptance time."
 *
 * A booking snapshots its own `payment_due_at` when it is created, and
 * `paymentDueAt()` never hands anybody less than the window, so four makers
 * accepted on the afternoon of the 22nd carry the 24th while the other
 * seventy eight carry the 23rd. That floor is a good default and it is not
 * what the owner of the market wants for this show, so this is the deliberate
 * override: one date, everybody, written down.
 *
 * Pure, and it decides nothing about whether it should be done. It answers
 * what would change, so the screen can say "four bookings move from the 24th
 * to the 23rd" before anybody presses anything, and so the same list can be
 * audit logged afterwards (CLAUDE.md rule 3).
 *
 * Paid and released bookings are never touched. A deadline on money that has
 * already arrived is a field nobody reads, and rewriting it would only make
 * the audit trail harder to follow.
 */

export type DeadlineRow = {
  bookingId: string
  vendorCode: string
  shopName: string
  status: string
  paymentDueAt: string | null
}

export type DeadlineChange = {
  bookingId: string
  vendorCode: string
  shopName: string
  from: string | null
  to: string
  /** Later than they had, so nobody loses time they were promised. */
  gainsTime: boolean
}

/** The statuses whose deadline still means something. */
export function deadlineMatters(status: string): boolean {
  return status === 'awaiting_payment'
}

/**
 * Which bookings would move, and which way.
 *
 * A booking already on the target is not a change and is left out, so
 * pressing this twice reports nothing to do rather than rewriting eighty
 * rows and logging eighty non-events.
 */
export function deadlineChanges(rows: DeadlineRow[], targetIso: string): DeadlineChange[] {
  const target = new Date(targetIso).getTime()
  const out: DeadlineChange[] = []
  for (const r of rows) {
    if (!deadlineMatters(r.status)) continue
    const had = r.paymentDueAt ? new Date(r.paymentDueAt).getTime() : null
    if (had === target) continue
    out.push({
      bookingId: r.bookingId,
      vendorCode: r.vendorCode,
      shopName: r.shopName,
      from: r.paymentDueAt,
      to: targetIso,
      gainsTime: had === null || target > had,
    })
  }
  return out
}

/** How many of these take time away from a maker who was promised it. */
export function losesTime(changes: DeadlineChange[]): DeadlineChange[] {
  return changes.filter((c) => !c.gainsTime)
}
