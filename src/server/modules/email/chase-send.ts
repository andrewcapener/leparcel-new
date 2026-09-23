import { randomUUID } from 'crypto'
import { and, eq, gte } from 'drizzle-orm'
import { bookings, emailOutbox, spaceTypes, vendors } from '@/db/schema'
import type { db as Db } from '@/db'
import {
  chaseBatchBody, chasePlan, chaseIdempotencyKey, pacificDay,
  type ChaseBooking, type ChasePlan,
} from './fee-chase'

type DbHandle = typeof Db

export const CHASE_TEMPLATE = 'booth-fee-chase'
const DEFAULT_FROM = 'Mermade Market <hello@mermademarket.com>'
const REPLY_TO = 'hello@mermademarket.com'
/** Resend takes up to 100 in one call. Sixty two fit in one. */
const BATCH_MAX = 100
const TIMEOUT_MS = 20_000

/**
 * The booth fee chase, handed to Resend with a time on it.
 *
 * Resend holds a scheduled send itself, so nothing on our side has to be
 * awake at nine in the morning. That is the whole reason to do it this way
 * rather than a cron: a scheduler we own is a thing that can fail silently
 * overnight, and this one cannot, because once Resend has accepted the batch
 * the job is already done.
 *
 * Three guards, because this is the only thing in the codebase that mails
 * sixty people at once:
 *
 *   The list comes from chasePlan and nowhere else, so the rules about who is
 *   owed what on which day live in a tested pure function rather than here.
 *
 *   The batch carries an idempotency key scoped to the show and the Pacific
 *   day, so a double press is one delivery (CLAUDE.md rule 4).
 *
 *   Every message is written to the outbox whether or not Resend is reachable,
 *   so what was sent is answerable from our own database afterwards.
 */

/** Everyone holding a space at this show, in the shape the planner wants. */
export async function chaseBookings(db: DbHandle, showId: string): Promise<ChaseBooking[]> {
  const rows = await db
    .select({
      id: bookings.id, vendorCode: bookings.vendorCode, status: bookings.status,
      priceCents: bookings.priceCents, addonsCents: bookings.addonsCents,
      payToken: bookings.payToken, paymentDueAt: bookings.paymentDueAt,
      shopName: vendors.shopName, contactName: vendors.contactName, email: vendors.email,
      track: spaceTypes.track, spaceLabel: spaceTypes.label,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
    .where(eq(bookings.showId, showId))

  return rows.map((r) => ({
    bookingId: r.id,
    vendorCode: r.vendorCode,
    shopName: r.shopName,
    contactName: r.contactName,
    email: r.email,
    track: r.track,
    spaceLabel: r.spaceLabel,
    totalCents: r.priceCents + r.addonsCents,
    status: r.status,
    payToken: r.payToken,
    paymentDueAt: r.paymentDueAt,
  }))
}

/**
 * What would go out, without anything going out.
 *
 * `forDay` is the Pacific day the email ARRIVES, not the day somebody is
 * looking at the screen. The email says "due today", so today means the
 * morning it lands: a batch built on Tuesday night for Wednesday at nine is
 * a list of everybody due on Wednesday. Computing it from the clock instead
 * is how pressing Schedule the night before sends to nobody, which is what
 * it did until this argument existed.
 */
export async function planChase(
  db: DbHandle, showId: string, siteUrl: string, forDay: string,
): Promise<{ plan: ChasePlan; today: string; alreadySent: Set<string> }> {
  const today = forDay
  const now = new Date()
  const all = await chaseBookings(db, showId)
  const plan = chasePlan(all, today, (t) => `${siteUrl}/pay/${t}`)

  /* Who already has one of these today. Resend's idempotency key stops a
     double press inside its own window; this is the answer that survives a
     redeploy, and it is what the screen shows so nobody wonders. */
  const startOfDayUtc = new Date(now)
  startOfDayUtc.setUTCHours(startOfDayUtc.getUTCHours() - 24)
  const recent = await db
    .select({ to: emailOutbox.toEmail })
    .from(emailOutbox)
    .where(and(
      eq(emailOutbox.template, CHASE_TEMPLATE),
      gte(emailOutbox.sentAt, startOfDayUtc.toISOString()),
    ))
  return { plan, today, alreadySent: new Set(recent.map((r) => r.to.toLowerCase())) }
}

export type SendResult =
  | { ok: true; queued: number; scheduledAt: string; resendId: string }
  | { ok: false; detail: string }

/**
 * Hand the batch to Resend.
 *
 * `only` is the set of booking ids a person ticked on the screen. Nothing is
 * sent to anybody outside it, so the list somebody read is exactly the list
 * that goes, and a maker who was on the screen and should not have been is
 * one untick away rather than a code change at nine at night.
 */
export async function sendChase(
  db: DbHandle,
  showId: string,
  siteUrl: string,
  only: Set<string>,
  scheduledAtIso: string,
): Promise<SendResult> {
  /* The day it lands, for the same reason planChase takes one. */
  const today = pacificDay(new Date(scheduledAtIso))
  const { plan } = await planChase(db, showId, siteUrl, today)
  const going = plan.send.filter((c) => only.has(c.booking.bookingId))

  if (going.length === 0) return { ok: false, detail: 'Nobody is selected, so nothing was sent.' }
  if (going.length > BATCH_MAX) {
    return { ok: false, detail: `Resend takes ${BATCH_MAX} at a time and this is ${going.length}.` }
  }

  const key = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM

  /* Logged first, always. If Resend is unreachable the outbox still says what
     we meant to send and to whom, which is the difference between a bad
     morning and an unanswerable one. */
  const logged: { id: string; to: string }[] = []
  for (const c of going) {
    const id = randomUUID()
    await db.insert(emailOutbox).values({
      id, toEmail: c.booking.email, subject: c.subject, body: c.text,
      template: CHASE_TEMPLATE,
      deliveryStatus: key ? 'logged' : 'failed',
      deliveryDetail: key ? '' : 'No Resend key on this deployment.',
    })
    logged.push({ id, to: c.booking.email })
  }

  if (!key) {
    return {
      ok: false,
      detail: `No Resend key on this deployment, so nothing left the building. `
        + `All ${going.length} are written to the outbox.`,
    }
  }

  let res: Response
  try {
    res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        /* Show and day, so pressing this twice this morning delivers once
           and a real chase tomorrow is a different key (rule 4). */
        'Idempotency-Key': chaseIdempotencyKey(showId, today),
      },
      body: JSON.stringify(chaseBatchBody(going, from, REPLY_TO, scheduledAtIso)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Resend could not be reached.'
    await markAll(db, logged, 'failed', detail)
    return { ok: false, detail }
  }

  const text = await res.text()
  if (!res.ok) {
    const detail = `Resend said HTTP ${res.status}: ${text.slice(0, 300)}`
    await markAll(db, logged, 'failed', detail)
    return { ok: false, detail }
  }

  await markAll(db, logged, 'sent', `scheduled for ${scheduledAtIso}`)
  return {
    ok: true,
    queued: going.length,
    scheduledAt: scheduledAtIso,
    resendId: firstId(text),
  }
}

async function markAll(
  db: DbHandle, rows: { id: string }[], status: string, detail: string,
) {
  for (const r of rows) {
    await db.update(emailOutbox)
      .set({ deliveryStatus: status, deliveryDetail: detail.slice(0, 500) })
      .where(eq(emailOutbox.id, r.id))
  }
}

/** Resend answers with one id per message. The first is enough to find a batch. */
function firstId(body: string): string {
  try {
    const j = JSON.parse(body) as { data?: { id?: string }[] }
    return j.data?.[0]?.id ?? ''
  } catch { return '' }
}
