import { usd } from '@/lib/money'

/**
 * The booth fee chase: one email per maker who still owes, on the day it is due.
 *
 * Drew, 22 Sept, the night before the deadline: send it at 9am to everyone who
 * has not paid. The girls were going to mail merge it out of a spreadsheet,
 * which works right up until a column shifts and somebody is told they owe
 * another maker's fee. Every field in this email already lives in the
 * database, so there is nothing to merge: each message is rendered from the
 * booking it is about.
 *
 * This file decides and renders and sends nothing. That split matters here
 * more than usual, because the thing being tested is WHO gets an email, and a
 * wrong answer reaches sixty people at once.
 *
 * The deadline is the whole logic. A maker is chased on the day their own
 * booking is due and on no other day, which falls out of `paymentDueAt` being
 * snapshotted per booking rather than read off the Show. That is what keeps
 * the four makers accepted yesterday afternoon out of this morning's send:
 * they were given the full 48 hours the system promises, their clock runs to
 * tomorrow, and an email telling them the money is due today would be false.
 */

export type ChaseBooking = {
  bookingId: string
  vendorCode: string
  shopName: string
  contactName: string
  email: string
  track: string
  spaceLabel: string
  /** Fee plus add-ons, in cents. Never recomputed downstream. */
  totalCents: number
  status: string
  payToken: string | null
  /** This booking's own deadline, ISO. */
  paymentDueAt: string | null
}

export type Chase = {
  booking: ChaseBooking
  subject: string
  text: string
}

/** Somebody deliberately left out, and the sentence saying why. */
export type Held = { booking: ChaseBooking; because: string }

export type ChasePlan = { send: Chase[]; held: Held[] }

/* ──────────────────────────── the day ──────────────────────────── */

const TZ = 'America/Los_Angeles'

/**
 * The Pacific calendar date of an instant, as YYYY-MM-DD.
 *
 * Everything here compares days, not instants, and the day that matters is
 * the one in Dana Point. A booking due at 11:59pm Pacific on the 23rd is
 * stored as 06:59 UTC on the 24th, so any comparison that reaches for the UTC
 * date chases people a day late (CLAUDE.md rule 8).
 */
export function pacificDay(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

/* ──────────────────────────── the copy ──────────────────────────── */

/**
 * How to name the thing they are holding.
 *
 * Indoor labels are footprints (3x6, JR Space, Treats on a Shelf) and outdoor
 * labels are days (Outdoor Saturday). Neither reads as a sentence on its own,
 * and "Your JR Space space" is how a template betrays itself.
 */
export function spacePhrase(track: string, label: string): string {
  const l = (label ?? '').trim()
  if (track === 'outdoor') {
    const day = l.replace(/^outdoor\s+/i, '').trim()
    return day ? `Your outdoor booth (${day})` : 'Your outdoor booth'
  }
  return l ? `Your indoor space (${l})` : 'Your indoor space'
}

export const CHASE_SUBJECT = 'Due today: your Fall 26 booth fee'

/**
 * The email, in Drew's words, checked against docs/12-VOICE.md.
 *
 * Plain text and nothing else. A designed template with a header image reads
 * as a blast, and this one has to read as Elise and Hillary writing to one
 * person about one fee. No dashes anywhere, at Drew's instruction, including
 * the signature line the voice doc would otherwise allow.
 */
export function chaseText(b: ChaseBooking, payUrl: string): string {
  return `${b.contactName.trim()},

${spacePhrase(b.track, b.spaceLabel)} is held. The fee is ${usd(b.totalCents)}, due today by 11:59pm.

Pay here: ${payUrl}

After tonight, unpaid spaces go back into the pool and we start down the waiting list.

If you have already sent it by Venmo or Zelle, ignore this. We match those by hand and yours may still be in the pile.

If something has changed, tell us today and we will sort it out.

Elise, Hillary and the Mermade Team`
}

/* ──────────────────────────── who gets it ──────────────────────────── */

/**
 * Split the roster into who is chased this morning and who is deliberately not.
 *
 * Every exclusion is returned with its reason rather than silently dropped,
 * because the screen this feeds has one job: let a person read the list before
 * sixty emails leave. A maker who is missing and unexplained is the failure
 * mode; a maker who is listed as held with a sentence beside them is a
 * decision somebody can disagree with.
 *
 * `today` is a Pacific calendar day, YYYY-MM-DD.
 */
export function chasePlan(
  bookings: ChaseBooking[], today: string, payUrlFor: (token: string) => string,
): ChasePlan {
  const send: Chase[] = []
  const held: Held[] = []

  for (const b of bookings) {
    const hold = (because: string) => held.push({ booking: b, because })

    if (b.status === 'confirmed') { hold('Paid.'); continue }
    if (b.status === 'payment_processing') {
      hold('Bank transfer is clearing. The money is on its way.'); continue
    }
    if (b.status === 'forfeited' || b.status === 'cancelled') {
      hold('No longer holding a space.'); continue
    }
    if (b.status !== 'awaiting_payment') { hold(`Status is ${b.status}.`); continue }

    /* A full credit. Nothing is owed, so there is nothing to chase, and an
       email demanding $0.00 by tonight is the one that gets screenshotted. */
    if (b.totalCents <= 0) { hold('Owes nothing. Their fee is covered in full.'); continue }

    /* No link, no email. Sending "pay here" with nowhere to go is worse than
       silence, and it means something is wrong with the booking anyway. */
    if (!b.payToken) { hold('No pay link on this booking. Needs a look.'); continue }

    if (!b.paymentDueAt) { hold('No deadline on this booking. Needs a look.'); continue }

    const due = pacificDay(b.paymentDueAt)
    if (due > today) {
      hold(`Not due until ${due}. They were promised 48 hours and still have them.`)
      continue
    }
    if (due < today) {
      hold(`Was due ${due}, which has passed. This email would say today and be wrong.`)
      continue
    }

    send.push({
      booking: b,
      subject: CHASE_SUBJECT,
      text: chaseText(b, payUrlFor(b.payToken)),
    })
  }

  return { send, held }
}

/** What is still owed by everyone about to be emailed. */
export function owedCents(plan: ChasePlan): number {
  return plan.send.reduce((n, c) => n + c.booking.totalCents, 0)
}

/**
 * The key that makes a second press harmless (CLAUDE.md rule 4).
 *
 * Scoped to the show and the Pacific day, so pressing Send twice on the same
 * morning is the same call to Resend and delivers once, while a genuine chase
 * on a later day is a different key and goes.
 */
export function chaseIdempotencyKey(showId: string, today: string): string {
  return `fee-chase:${showId}:${today}`
}

/* ──────────────────────── when it arrives ──────────────────────── */

/**
 * The next 9am Pacific, as an instant.
 *
 * Written by walking Pacific wall clock rather than by adding hours, because
 * the offset is the thing that moves. Doing this arithmetic in UTC is how a
 * send lands at 8am after the clocks change, and the whole point of this
 * screen is that the time on it is the time it arrives.
 */
export function nextNineAmPacific(now = new Date()): Date {
  for (let addDays = 0; addDays < 3; addDays++) {
    const day = new Date(now.getTime() + addDays * 86_400_000)
    const candidate = pacificWallToUtc(pacificDay(day), 9, 0)
    if (candidate.getTime() > now.getTime()) return candidate
  }
  return new Date(now.getTime() + 3600_000)
}

/**
 * A Pacific wall clock time (YYYY-MM-DD plus hour and minute) as an instant.
 *
 * Guessed, then corrected by what the guess actually renders as in Pacific.
 * One correction is enough for every case except the hour that does not exist
 * on a spring-forward morning, which nine in the morning is not.
 */
export function pacificWallToUtc(day: string, hour: number, minute: number): Date {
  const [y, m, d] = day.split('-').map(Number)
  let guess = Date.UTC(y!, (m! - 1), d!, hour + 7, minute)
  for (let i = 0; i < 2; i++) {
    const shown = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', hour12: false,
      hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date(guess))
    const h = Number(shown.find((p) => p.type === 'hour')?.value ?? '0')
    const mi = Number(shown.find((p) => p.type === 'minute')?.value ?? '0')
    const driftMin = (hour * 60 + minute) - ((h % 24) * 60 + mi)
    if (driftMin === 0) break
    guess += driftMin * 60_000
  }
  return new Date(guess)
}

/* ──────────────────────── the wire ──────────────────────── */

/**
 * The body Resend's batch endpoint receives.
 *
 * Pure and exported so the exact shape is testable without a network, because
 * this is the part with no second chance: a `scheduled_at` Resend does not
 * understand is sixty emails arriving the instant the button is pressed
 * rather than at nine in the morning, and there is no unsend.
 *
 * Plain text only, deliberately. A designed template reads as a blast, and
 * this one has to read as two people writing to one maker about one fee.
 */
export function chaseBatchBody(
  going: Chase[], from: string, replyTo: string, scheduledAtIso: string,
): Array<Record<string, unknown>> {
  return going.map((c) => ({
    from,
    to: [c.booking.email],
    reply_to: replyTo,
    subject: c.subject,
    text: c.text,
    /* ISO 8601. Resend also takes "in 1 min", which is exactly the kind of
       convenience that turns a timezone bug into a delivery at the wrong
       hour, so the instant is computed here and sent as an instant. */
    scheduled_at: scheduledAtIso,
  }))
}
