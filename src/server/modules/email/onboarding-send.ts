import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { db as Db } from '@/db'
import {
  applications, bookings, emailOutbox, inventoryItems, spaceTypes, vendors,
} from '@/db/schema'
import { siteUrl } from '@/lib/site-url'
import { BATCH_LINK_TTL_MS, signLinkToken } from '@/lib/makerAuth'
import { connectState, owesPayoutSetup } from '@/server/modules/payments/connect'
import { paymentsConfigured } from '@/server/modules/payments/config'
import { fmtDateTime } from '@/lib/dates'
import { mail } from './send'
import {
  invitePlan, inviteHtml, inviteText, inviteSubject,
  type InviteMaker, type InvitePlan,
} from './onboarding-invite'

type DbHandle = typeof Db

export const INVITE_TEMPLATE = 'onboarding-invite'
const REPLY_TO = 'hello@mermademarket.com'

/**
 * The database half of the onboarding invite: read who stands where, then send.
 *
 * Kept apart from onboarding-invite.ts so that deciding who gets an email is
 * pure and tested, and this file only gathers facts and moves messages. The
 * screen makes staff use them in order: look at who would get it, then send.
 */

export type Candidate = InviteMaker & {
  /** Whether this address has had one of these before, for this show. */
  sentBefore: boolean
}

/**
 * Everybody holding a space at this show, with the two facts the plan turns on.
 *
 * The item count is a grouped subquery rather than a join, because a join
 * would multiply a maker by her own lines and a maker with six prices would
 * appear six times in a list of who to email.
 */
export async function inviteCandidates(
  db: DbHandle, showId: string, showPayoutSetup: string,
): Promise<Candidate[]> {
  const rows = await db
    .select({
      bookingId: bookings.id,
      vendorCode: bookings.vendorCode,
      bookingStatus: bookings.status,
      inventorySubmittedAt: bookings.inventorySubmittedAt,
      shopName: vendors.shopName,
      contactName: vendors.contactName,
      email: vendors.email,
      stripeAccountId: vendors.stripeAccountId,
      payoutsEnabled: vendors.payoutsEnabled,
      connectRequirements: vendors.connectRequirements,
      connectDisabledReason: vendors.connectDisabledReason,
      track: spaceTypes.track,
      applicationStatus: applications.status,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(applications, eq(bookings.applicationId, applications.id))
    .innerJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
    .where(eq(bookings.showId, showId))

  const counts = rows.length
    ? await db
        .select({ bookingId: inventoryItems.bookingId, n: sql<number>`count(*)` })
        .from(inventoryItems)
        .where(and(
          inArray(inventoryItems.bookingId, rows.map((r) => r.bookingId)),
          isNull(inventoryItems.voidedAt),
        ))
        .groupBy(inventoryItems.bookingId)
    : []
  const countOf = new Map(counts.map((c) => [c.bookingId, Number(c.n)]))

  /* Who has already had one. The outbox is the record of what left, so it is
     also the honest answer to "did we already ask her". */
  const already = new Set(
    (await db
      .select({ to: emailOutbox.toEmail })
      .from(emailOutbox)
      .where(eq(emailOutbox.template, INVITE_TEMPLATE)))
      .map((r) => r.to.toLowerCase()),
  )

  /* Undefined unless the Show says to ask and Stripe is live here. A button
     that cannot work is worse than no button, and an email pointing at one
     is worse again. */
  const payoutsOn = showPayoutSetup === 'on' && paymentsConfigured()

  return rows.map((r) => ({
    bookingId: r.bookingId,
    vendorCode: r.vendorCode,
    shopName: r.shopName,
    contactName: r.contactName,
    email: r.email,
    track: r.track,
    bookingStatus: r.bookingStatus,
    applicationStatus: r.applicationStatus,
    payoutState: payoutsOn && owesPayoutSetup(r.track)
      ? connectState({
          stripeAccountId: r.stripeAccountId,
          payoutsEnabled: r.payoutsEnabled,
          connectRequirements: r.connectRequirements,
          connectDisabledReason: r.connectDisabledReason,
        })
      : undefined,
    itemCount: countOf.get(r.bookingId) ?? 0,
    itemsSent: Boolean(r.inventorySubmittedAt),
    sentBefore: already.has(r.email.toLowerCase()),
  }))
}

export async function invitePlanFor(
  db: DbHandle, showId: string, showPayoutSetup: string, inventoryDueAt: string | null,
): Promise<{ plan: InvitePlan; candidates: Candidate[] }> {
  const candidates = await inviteCandidates(db, showId, showPayoutSetup)
  return {
    plan: invitePlan(candidates, { itemsOpen: Boolean(inventoryDueAt) }),
    candidates,
  }
}

export type SendResult = {
  sent: number
  logged: number
  failed: { shop: string; detail: string }[]
  skipped: number
}

/**
 * Send it.
 *
 * One message per maker rather than a batch, because every message is
 * different: it names only what that maker still owes. Thirty four sequential
 * sends is a few seconds and buys a per maker outbox row.
 *
 * `again` is the deliberate override for a second round. Without it, anybody
 * who has already had one of these is skipped, so a second press a week later
 * reaches the people who did nothing and nobody else.
 */
export async function sendInvites(
  db: DbHandle,
  opts: {
    showId: string
    showName: string
    inventoryDueAt: string | null
    showPayoutSetup: string
    again: boolean
    /** The bookings staff actually ticked. Undefined means everybody the
     *  plan chose, which is only ever used by a caller with no screen. */
    only?: Set<string>
  },
): Promise<SendResult> {
  const { plan, candidates } = await invitePlanFor(
    db, opts.showId, opts.showPayoutSetup, opts.inventoryDueAt,
  )
  const sentBefore = new Map(candidates.map((c) => [c.bookingId, c.sentBefore]))

  const out: SendResult = { sent: 0, logged: 0, failed: [], skipped: 0 }
  const due = opts.inventoryDueAt ? fmtDateTime(opts.inventoryDueAt) : null

  for (const { maker, needs } of plan.send) {
    if (opts.only && !opts.only.has(maker.bookingId)) { out.skipped++; continue }
    if (!opts.again && sentBefore.get(maker.bookingId)) { out.skipped++; continue }
    try {
      /* A link that lasts the week. See BATCH_LINK_TTL_MS: twenty minutes is
         right for a link somebody just asked for and wrong for one sent to
         forty people at nine in the morning. */
      const token = await signLinkToken(maker.email, Date.now(), BATCH_LINK_TTL_MS)
      /* Straight to the card they are being asked about. `next` is read
         against a short fixed list in the route, never used as a path. */
      const land = needs.includes('items') ? 'items' : 'payouts'
      const url = `${siteUrl()}/account/enter?token=${token}&next=${land}`

      const subject = inviteSubject(needs, opts.showName)
      const res = await mail(
        maker.email,
        subject,
        inviteText({ url, showName: opts.showName, needs, itemsDue: due }),
        INVITE_TEMPLATE,
        REPLY_TO,
        inviteHtml({
          url, shopName: maker.shopName, showName: opts.showName,
          needs, itemsDue: due, vendorCode: maker.vendorCode,
        }),
      )
      if (res === 'sent') out.sent++
      else if (res === 'logged') out.logged++
      else out.failed.push({ shop: maker.shopName, detail: 'the mail provider refused it' })
    } catch (err) {
      out.failed.push({
        shop: maker.shopName,
        detail: err instanceof Error ? err.message.slice(0, 160) : 'unknown',
      })
    }
  }
  return out
}
