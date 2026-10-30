import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import type { db as Db } from '@/db'
import {
  applications, bookings, emailOutbox, inventoryItems, spaceTypes, vendors,
} from '@/db/schema'
import { siteUrl } from '@/lib/site-url'
import { BATCH_LINK_TTL_MS, signLinkToken } from '@/lib/makerAuth'
import { connectState, owesPayoutSetup } from '@/server/modules/payments/connect'
import { paymentsConfigured } from '@/server/modules/payments/config'
import { payingAccount } from '@/server/modules/payments/share-payouts'
import type { PayoutColumns } from '@/server/modules/payments/share-payouts'
import { fmtDateTime } from '@/lib/dates'
import { mail } from './send'
import {
  invitePlan, inviteHtml, inviteText, inviteSubject,
  type InviteMaker, type InvitePlan,
} from './onboarding-invite'
import { listState } from '@/server/modules/inventory/lines'

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
  /** This show's window, so a previous season's invite does not suppress
   *  everybody. The outbox carries no show of its own. */
  showOpenedAt?: string | null,
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
      payoutsViaVendorId: vendors.payoutsViaVendorId,
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

  /* Who has already had one, for THIS show, that actually went.
     
     Two things this query used to get wrong, both of which hurt the person it
     was meant to protect. mail() writes the outbox row BEFORE the send and
     only then marks it sent or failed, so a bounce, a Resend 4xx or the 20s
     timeout left a row saying "already had one" for the one maker who
     demonstrably did not get it, and she was then unticked by default and
     reported to staff as skipped. And the outbox carries no show, so Spring's
     invite suppressed every returning maker in the autumn and the button read
     "Nobody ticked".
     
     So: delivered only, and only since this show's applications opened. */
  const since = showOpenedAt ?? new Date(0).toISOString()
  const already = new Set(
    (await db
      .select({ to: emailOutbox.toEmail })
      .from(emailOutbox)
      .where(and(
        eq(emailOutbox.template, INVITE_TEMPLATE),
        eq(emailOutbox.deliveryStatus, 'sent'),
        gte(emailOutbox.sentAt, since),
      )))
      .map((r) => r.to.toLowerCase()),
  )

  /* A maker paid through somebody else's account reads THAT account's state.
     Hers is empty and always will be, so without this she is asked, by email,
     to set up a payout account her mother has already set up for her. The
     owners are looked up rather than joined because the pointer is rare: no
     row to find means no query. */
  const ownerIds = [...new Set(rows.flatMap((r) => (r.payoutsViaVendorId ? [r.payoutsViaVendorId] : [])))]
  const owners = new Map<string, PayoutColumns>(
    (ownerIds.length
      ? await db
          .select({
            id: vendors.id,
            stripeAccountId: vendors.stripeAccountId,
            payoutsEnabled: vendors.payoutsEnabled,
            connectRequirements: vendors.connectRequirements,
            connectDisabledReason: vendors.connectDisabledReason,
          })
          .from(vendors)
          .where(inArray(vendors.id, ownerIds))
      : []
    ).map((o) => [o.id, o] as const),
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
      ? connectState(payingAccount(r, owners))
      : undefined,
    itemCount: countOf.get(r.bookingId) ?? 0,
    itemsSent: Boolean(r.inventorySubmittedAt),
    sentBefore: already.has(r.email.toLowerCase()),
  }))
}

export async function invitePlanFor(
  db: DbHandle, showId: string, showPayoutSetup: string, inventoryDueAt: string | null,
  showOpenedAt?: string | null,
): Promise<{ plan: InvitePlan; candidates: Candidate[] }> {
  const candidates = await inviteCandidates(db, showId, showPayoutSetup, showOpenedAt)
  /* Open means the date has not passed, not merely that somebody set one.
     Asking twelve makers for a list the page will then refuse to take is
     worse than not asking: it is a deadline we set, two days late, with a
     button that does nothing. */
  const itemsOpen = listState(inventoryDueAt, new Date().toISOString()) === 'open'
  return {
    plan: invitePlan(candidates, { itemsOpen }),
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
    showOpenedAt?: string | null
    again: boolean
    /** The bookings staff actually ticked. Undefined means everybody the
     *  plan chose, which is only ever used by a caller with no screen. */
    only?: Set<string>
  },
): Promise<SendResult> {
  const { plan, candidates } = await invitePlanFor(
    db, opts.showId, opts.showPayoutSetup, opts.inventoryDueAt, opts.showOpenedAt,
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
