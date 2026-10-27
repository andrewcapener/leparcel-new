import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { fmtDateTime } from '@/lib/dates'
import { invitePlanFor } from '@/server/modules/email/onboarding-send'
import {
  inviteSubject, needLines, planNotice,
} from '@/server/modules/email/onboarding-invite'
import { paymentsConfigured } from '@/server/modules/payments/config'
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
    db, show.id, show.payoutSetup, show.inventoryDueAt,
  )
  const sentBefore = new Map(candidates.map((c) => [c.bookingId, c.sentBefore]))
  const due = show.inventoryDueAt ? fmtDateTime(show.inventoryDueAt) : null

  const payoutsLive = show.payoutSetup === 'on' && paymentsConfigured()
  const itemsLive = Boolean(show.inventoryDueAt)

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
            <>No item list date is set on /admin/show, so the list is not open and nobody will be asked for it.</>
          )}
        </p>
      )}

      <Stats>
        <Stat label="Getting an email" icon="clock" value={plan.send.length}
          note={`${fresh} who have never had one.`} />
        <Stat label="Asked for both" icon="roster" value={askedBoth}
          note={`${askedItems} for the item list, ${askedPayouts} for payouts.`} />
        <Stat label="Left out" icon="tent" value={plan.held.length}
          note="Outdoor makers, undecided applications, and anyone already done." />
      </Stats>

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
        <>
          <h2 className="adm-h2">Left out, and why</h2>
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
        </>
      )}
    </>
  )
}
