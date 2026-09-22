/**
 * When a booth fee is due.
 *
 * Until now this was always "the moment you were accepted, plus the window",
 * which has a flaw that only shows up at scale: the clock starts when staff
 * click Accept, not when the maker is told. Accept seventy eight people on a
 * Monday night, send the emails on Tuesday morning, and a maker opens her link
 * with most of her window already spent on a deadline she never saw begin.
 *
 * So a Show can carry a fixed date instead, and Hillary's acceptance email
 * already quotes one ("due by 9/23/2026"). One date, one sentence in every
 * email, and the same deadline for everybody however long the accepting takes.
 *
 * The window hours stay on as a FLOOR. A maker pulled off the waitlist the day
 * before the fixed date would otherwise inherit a deadline that has already
 * passed, or nearly, which is not a deadline so much as a trap. Whoever is
 * accepted last still gets the full window.
 */

export type DeadlineInput = {
  /** The Show's fixed date, ISO, or null for the old rolling behaviour. */
  fixedAt: string | null | undefined
  /** The floor, in hours from acceptance. Never less than this. */
  windowHours: number
  /** When the booking is being made. */
  acceptedAtIso: string
}

/**
 * The later of the fixed date and the floor.
 *
 * An unparseable or missing fixed date falls back to the rolling window rather
 * than throwing: a bad value in one column must not stop somebody being
 * accepted, and the rolling window is what every show before this one used.
 */
export function paymentDueAt({ fixedAt, windowHours, acceptedAtIso }: DeadlineInput): string {
  const accepted = Date.parse(acceptedAtIso)
  const base = Number.isFinite(accepted) ? accepted : Date.now()
  /* Guard the hours too. A zero or negative window would hand somebody a
     deadline in the past, and a missing column reads as NaN. */
  const hours = Number.isFinite(windowHours) && windowHours > 0 ? windowHours : 48
  const floor = base + hours * 3600_000

  const fixed = fixedAt ? Date.parse(fixedAt) : NaN
  if (!Number.isFinite(fixed)) return new Date(floor).toISOString()
  return new Date(Math.max(fixed, floor)).toISOString()
}

/** True when the fixed date is doing the work, which is what staff want to see
 *  confirmed on the accept screen before they accept eighty people. */
export function usingFixedDate(i: DeadlineInput): boolean {
  return Boolean(i.fixedAt) && paymentDueAt(i) === new Date(Date.parse(i.fixedAt!)).toISOString()
}
