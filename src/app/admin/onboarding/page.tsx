import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { fmtDateTime } from '@/lib/dates'
import { invitePlanFor } from '@/server/modules/email/onboarding-send'
import {
  inviteSubject, needLines, planNotice,
} from '@/server/modules/email/onboarding-invite'
import { paymentsConfigured } from '@/server/modules/payments/config'
import { progressOf, pct, progressNotice } from '@/server/modules/email/onboarding-progress'
import { asc, eq, isNotNull, and } from 'drizzle-orm'
import { bookings } from '@/db/schema'
import { PageHead, Stats, Stat } from '../ui'
import { InviteForm } from './InviteForm'

export const dynamic = 'force-dynamic'
/* Thirty four sequential sends, each its own message because each names only
   what that maker still owes. Seconds, not minutes. */
export const maxDuration = 60

/**
 * Ask the indoor makers for the two things we need before the register opens.
 *
 * Drew, 27 October: an email to every accepted indoor maker, "upload your
 * inventory here and set up your Stripe Connect account for automatic
 * payments after the show", linking straight to their own outstanding items.
 *
 * Built like /admin/chase and for the same reason: it is read before it is
 * pressed. Everybody who would get one is listed with the reason they are on
 * the list, everybody left out is listed with the reason they are not, and
 * the email is printed underneath exactly as it will arrive.
 *
 * Nothing here is automated. No switch arms it and no job runs it. Drew's
 * standing instruction since the roster import is that nothing reaches a
 * maker unasked, and a screen that mails thirty people is the last place to
 * start making exceptions.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; logged?: string; skipped?: string; failed?: string }>
}) {
  const sp = await searchParams
  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  const { plan, candidates } = await invitePlanFor(
    db, show.id, show.payoutSetup, show.inventoryDueAt, show.applicationsOpenAt,
  )
  const sentBefore = new Map(candidates.map((c) => [c.bookingId, c.sentBefore]))
  const due = show.inventoryDueAt ? fmtDateTime(show.inventoryDueAt) : null

  const payoutsLive = show.payoutSetup === 'on' && paymentsConfigured()
  const itemsLive = Boolean(show.inventoryDueAt)

  /* How far the room has got. Drew, an hour after the send: "I just want to
     know when the first successful one hits so I feel a little more
     comfortable." Counting rows on the roster is how that gets answered
     otherwise, and it is the sort of thing nobody does twice. */
  const progress = progressOf(candidates)

  /* When the first inventory landed, which is the moment he is waiting for.
     Only inventory carries a time of its own: a payout account becomes ready
     when Stripe says so, and we record that it is rather than when it
     became so. */
  const [firstIn] = await db
    .select({ at: bookings.inventorySubmittedAt })
    .from(bookings)
    .where(and(eq(bookings.showId, show.id), isNotNull(bookings.inventorySubmittedAt)))
    .orderBy(asc(bookings.inventorySubmittedAt))
    .limit(1)

  const askedBoth = plan.send.filter((s) => s.needs.length === 2).length
  const askedItems = plan.send.filter((s) => s.needs.includes('items')).length
  const askedPayouts = plan.send.filter((s) => s.needs.includes('payouts')).length
  const fresh = plan.send.filter((s) => !sentBefore.get(s.maker.bookingId)).length

  return (
    <>
      {sp.sent !== undefined && (
        <p className="adm-note" role="status">
          {`Sent ${sp.sent}.`}
          {Number(sp.logged) > 0 && ` ${sp.logged} recorded without a mail provider configured.`}
          {Number(sp.skipped) > 0 && ` ${sp.skipped} skipped, already had one.`}
          {Number(sp.failed) > 0 && ` ${sp.failed} failed.`}
        </p>
      )}

      <PageHead
        title="Before the register opens"
        sub={`${show.name} · ${planNotice(plan)}`}
      />

      {/* The two switches this screen depends on. A maker sent to a page with
          no payout card on it has been wasted, so the state of both is said
          here rather than discovered by a maker. */}
      {(!payoutsLive || !itemsLive) && (
        <p className="adm-note" role="status">
          {!payoutsLive && (
            <>Payout setup is not live: {show.payoutSetup !== 'on'
              ? 'the switch on /admin/show is off'
              : 'Stripe is not configured on this deployment'}. Nobody will be asked for it.{' '}</>
          )}
          {!itemsLive && (
            <>No inventory date is set on /admin/show, so it is not open and nobody will be asked for it.</>
          )}
        </p>
      )}

      <div className="adm-sec" style={{ marginTop: 28 }}><h2>Where everyone has got to</h2></div>
      <Stats>
        <Stat label="Inventory in" icon="queue"
          value={pct(progress.itemsDone, progress.total)} unit="%"
          note={`${progress.itemsDone} of ${progress.total} sent their list.${
            firstIn?.at ? ` First in ${fmtDateTime(firstIn.at)}.` : ''}`} />
        <Stat label="Payouts ready" icon="money"
          value={pct(progress.payoutsDone, progress.total)} unit="%"
          note={`${progress.payoutsDone} of ${progress.total} can be paid automatically.`} />
        <Stat label="Done with us" icon="roster"
          value={pct(progress.bothDone, progress.total)} unit="%"
          note={progressNotice(progress)} />
      </Stats>

      {/* The three cards that used to sit here said what the line under the
          page title already says: how many are getting one, how many are
          asked for both, how many are left out. Two of everything is not
          twice as clear. The one thing they carried that the heading does
          not is how many have never had one, which is what separates a first
          send from a chase. */}
      <div className="adm-sec"><h2>Who still needs the email</h2></div>
      <p className="adm-sub2">
        {fresh === plan.send.length
          ? 'None of them have had one of these yet.'
          : `${fresh} of the ${plan.send.length} have never had one of these.`}
      </p>

      <InviteForm
        rows={plan.send.map((s) => ({
          bookingId: s.maker.bookingId,
          code: s.maker.vendorCode,
          shop: s.maker.shopName,
          contact: s.maker.contactName,
          email: s.maker.email,
          needs: s.needs,
          items: s.maker.itemCount,
          payouts: s.maker.payoutState ?? null,
          already: Boolean(sentBefore.get(s.maker.bookingId)),
        }))}
        subjectBoth={inviteSubject(['items', 'payouts'], show.name)}
        lines={needLines(['items', 'payouts'], due)}
      />

      {plan.held.length > 0 && (
        <details className="adm-fold">
          <summary>Left out, and why ({plan.held.length})</summary>
          <table className="adm-tbl">
            <caption className="adm-sr">Makers who will not receive this email</caption>
            <thead>
              <tr><th scope="col">Maker</th><th scope="col">Why</th></tr>
            </thead>
            <tbody>
              {plan.held.map((h) => (
                <tr key={h.maker.bookingId}>
                  <td>
                    <strong>{h.maker.shopName}</strong>
                    <span className="adm-sub2"> {h.maker.email}</span>
                  </td>
                  <td>{h.because}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </>
  )
}
