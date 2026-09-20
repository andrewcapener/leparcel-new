import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { shows } from '@/db/schema'
import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { AccountHeader, Card, Facts } from '@/app/account/Shell'
import { BoothInvoice } from '@/app/account/BoothInvoice'
import { bookingByPayToken, boothInvoice } from '@/server/modules/payments/booth'
import { paymentsConfigured, isTestMode } from '@/server/modules/payments/config'
import { PayoutSetup } from '@/app/account/PayoutSetup'
import { payByToken, startConnectOnboardingByToken } from '@/app/actions'
import {
  connectState, owesPayoutSetup, requirementList, requirementsInPlainWords,
} from '@/server/modules/payments/connect'
import { isPaid } from '@/server/modules/payments/booking-status'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Your booth fee',
  /* Never indexed. A live invoice with a Pay button has no business in a
     search result, and these links are pasted into private email. */
  robots: { index: false, follow: false },
}

/**
 * One booking, one invoice, one Pay button.
 *
 * The page a staff-written acceptance email points at. It exists because the
 * team send their own emails now, so there is no message from us for a maker
 * to sign in through: the link has to work for whoever opens it.
 *
 * Deliberately NOT the account. No application, no address, no phone number,
 * no checklist, nothing about any other booking. If this link is forwarded,
 * the worst case is that somebody else pays a stranger's booth fee, and the
 * money still lands on the right booking. Forwarding a sign-in link would have
 * handed over the whole account, which is why this is a separate door.
 */
export default async function PayPage({
  params, searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ paid?: string; pay?: string; payouts?: string }>
}) {
  const { token } = await params
  const sp = await searchParams
  const show = await activeShow()

  const found = await bookingByPayToken(db, token)
  const billing = found ? await boothInvoice(db, found.id) : undefined

  /* One message for an unknown token and for a booking that is gone, so this
     page never confirms whether a guessed token was real. */
  if (!found || !billing || !show) {
    const dead = (
      <div className="mk-acct">
        <div className="container">
          <div className="mk-grid">
            <Card title="This link is not live" wide>
              <p style={{ margin: 0 }}>
                Check that you copied the whole link, including the long code at the end.
                If it still does not open, write to us and we will send you another.
              </p>
            </Card>
          </div>
        </div>
      </div>
    )
    return show
      ? <SiteShell show={show} template="page template-suffix-account">{dead}</SiteShell>
      : dead
  }

  /* The show this booking belongs to, not whichever one is active: a link
     pasted last season must price against the season it was made for. */
  const its = await db.query.shows.findFirst({ where: eq(shows.id, found.showId) })
  const methods = its?.paymentMethods ?? show.paymentMethods

  const notice = sp.paid === '1'
    ? ('paid' as const)
    : sp.pay === 'unavailable' || sp.pay === 'missing' || sp.pay === 'failed'
      ? (sp.pay as 'unavailable' | 'missing' | 'failed')
      : undefined

  /* ── one more thing, at the only moment it is free ──
     Drew, 21 Sept 2026: "I would hate to miss an opportunity here to set this
     up now." This is the opportunity. The maker has just paid, they are on
     this page because Stripe sent them back to it, and they have Stripe open
     in their head. Asked here it is two more minutes. Asked in November it is
     an email, a magic link, and somebody chasing forty people while running a
     show.

     Only once the fee is settled or in flight, because until then this page
     has exactly one job and a second ask would compete with it. Only for an
     indoor maker, because an outdoor maker takes their own money and is owed
     nothing. And only where Stripe is configured, because a button that
     cannot work is worse than no button. */
  const settled = isPaid(billing.booking.status) || billing.booking.status === 'payment_processing'
  const payouts = paymentsConfigured() && settled && owesPayoutSetup(found.track)
    ? connectState(found)
    : undefined

  return (
    <SiteShell show={show} template="page template-suffix-account">
      <div className="mk-acct">
        <div className="container">
          <AccountHeader
            eyebrow="Booth fee"
            shopName={billing.booking.vendorCode}
            status={`Due ${new Date(billing.booking.paymentDueAt).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' })}`}
            showName={its?.name ?? show.name}
            signOut={false}
          />
          <div className="mk-grid">
            <BoothInvoice
              invoice={billing.invoice}
              status={billing.booking.status}
              dueAt={billing.booking.paymentDueAt}
              paidAt={billing.booking.paidAt}
              vendorCode={billing.booking.vendorCode}
              payable={paymentsConfigured()}
              testMode={isTestMode()}
              notice={notice}
              methods={methods}
              action={payByToken}
              token={token}
            />
            {payouts && (
              <PayoutSetup
                state={payouts}
                needs={requirementsInPlainWords(requirementList(found.connectRequirements))}
                action={startConnectOnboardingByToken}
                token={token}
                notice={sp.payouts === 'unavailable' ? 'unavailable' : undefined}
                lede="That is your space paid for. One more thing, and it is the last money question: so we can send you your share after the show, Stripe needs to know who you are and where that money goes. About ten minutes, once, and it carries over to every show after this one."
              />
            )}

            <Card title="Questions" wide>
              <Facts
                rows={[
                  { label: 'What this is', value: 'Your space at the show, and any extras you asked for.' },
                  { label: 'Who to ask', value: <>Reply to the email this link came in, or write to <a href="mailto:hello@mermademarket.com">hello@mermademarket.com</a>.</> },
                  { label: 'What we never do', value: 'Ask you to send money by Zelle, Venmo, a wire, or any link that did not come from us.' },
                ]}
              />
            </Card>
          </div>
        </div>
      </div>
    </SiteShell>
  )
}
