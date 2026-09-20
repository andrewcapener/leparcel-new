import Link from 'next/link'
import { cookies } from 'next/headers'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { bookings, vendors } from '@/db/schema'
import { SiteShell } from '@/components/theme/SiteShell'
import { AccountHeader, Card, Facts } from '@/app/account/Shell'
import { SignInForm } from '@/app/account/SignInForm'
import { BoothInvoice } from '@/app/account/BoothInvoice'
import { boothInvoice } from '@/server/modules/payments/booth'
import { paymentsConfigured, isTestMode } from '@/server/modules/payments/config'
import { MAKER_COOKIE, readSession } from '@/lib/makerAuth'
import { fmtDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Pay your booth fee',
  robots: { index: false, follow: false },
}

/**
 * One link for everybody: mermademarket.com/account/payment
 *
 * Drew, 20 Sept 2026: the team want a single uniform url they can drop into
 * acceptance emails they are drafting NOW, before anybody has been accepted
 * and before any per booking link exists. A maker signs in with the address
 * they applied with and lands on their own invoice.
 *
 * It is the better link of the two for this job, and not only because it can
 * be drafted early. There is nothing to paste per maker, so there is no wrong
 * token to paste, and no link in an inbox that pays somebody else's fee.
 *
 * The per booking /pay/<token> link stays, for the maker whose sign-in email
 * will not arrive or who applied under an address they no longer read. This
 * one is the front door; that one is the key cut for a specific person.
 *
 * The sign-in link this sends is maker initiated, so it is outside the
 * decision-email setting: that gate covers what the DASHBOARD triggers.
 */
export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; paid?: string; pay?: string }>
}) {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')
  const sp = await searchParams

  const email = await readSession((await cookies()).get(MAKER_COOKIE)?.value)
  const vendor = email
    ? await db.query.vendors.findFirst({ where: eq(vendors.email, email) })
    : undefined

  const [booked] = vendor
    ? await db.select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.vendorId, vendor.id), eq(bookings.showId, show.id)))
        .limit(1)
    : []
  const billing = booked ? await boothInvoice(db, booked.id) : undefined

  const notice = sp.paid === '1'
    ? ('paid' as const)
    : sp.pay === 'unavailable' || sp.pay === 'missing' || sp.pay === 'failed'
      ? (sp.pay as 'unavailable' | 'missing' | 'failed')
      : undefined

  return (
    <SiteShell show={show} template="page template-suffix-account">
      <div className="mk-acct">
        <div className="container">
          <AccountHeader
            eyebrow="Booth fee"
            shopName={vendor?.shopName ?? 'Pay your booth fee'}
            vendorCode={billing?.booking.vendorCode}
            showName={show.name}
            signOut={Boolean(vendor)}
          />

          <div className="mk-grid">
            {/* ── not signed in ─────────────────────────────────────────── */}
            {!vendor && (
              <Card wide>
                <SignInForm
                  expired={sp.expired === '1'}
                  next="payment"
                  title="Pay your booth fee"
                  note="Enter the email you applied with. We will send you a link that opens your invoice, so nobody else can open it from a forwarded message."
                />
              </Card>
            )}

            {/* ── signed in, and there is a fee ─────────────────────────── */}
            {vendor && billing && (
              <BoothInvoice
                invoice={billing.invoice}
                status={billing.booking.status}
                dueAt={billing.booking.paymentDueAt}
                paidAt={billing.booking.paidAt}
                vendorCode={billing.booking.vendorCode}
                payable={paymentsConfigured()}
                testMode={isTestMode()}
                notice={notice}
                methods={show.paymentMethods}
              />
            )}

            {/* ── signed in, nothing to pay ─────────────────────────────── */}
            {vendor && !billing && (
              <Card title="Nothing to pay yet" wide>
                <Facts
                  rows={[
                    {
                      label: 'Where it stands',
                      /* Never "you were not accepted". A maker reaching this
                         page has usually been sent here before the roster was
                         finished, and a payment screen is the wrong place to
                         learn you were turned down. */
                      value: <>There is no booth fee on this account for {show.name}. If you have been told you are in, give us a few hours and check back.</>,
                    },
                    { label: 'Roster announced', value: fmtDate(show.rosterAnnouncedOn) },
                    { label: 'Your account', value: <>Everything else we need from you is on <Link href="/account">your account</Link>.</> },
                  ]}
                />
              </Card>
            )}

            <Card title="If this does not work" wide>
              <Facts
                rows={[
                  { label: 'No email arrived', value: 'Look in spam, then ask for another. Links last twenty minutes, and asking again always works.' },
                  { label: 'Different address', value: <>Sign in with the address you applied with, not the one you read most. If that address is gone, write to <a href="mailto:hello@mermademarket.com">hello@mermademarket.com</a> and we will send you a direct link.</> },
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
