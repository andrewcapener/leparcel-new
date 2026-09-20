import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { vendors } from '@/db/schema'
import { SiteShell } from '@/components/theme/SiteShell'
import { AccountHeader, Card } from '@/app/account/Shell'
import { SignInForm } from '@/app/account/SignInForm'
import { MAKER_COOKIE, readSession } from '@/lib/makerAuth'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Pay your booth fee',
  robots: { index: false, follow: false },
}

/**
 * mermademarket.com/pay
 *
 * The one link the team hand to every accepted maker. Drew, 20 Sept 2026:
 * "essentially we send everyone the same link but if they login using their
 * email, that's what we'll pull up their unique page."
 *
 * So this is a door, not a destination. Signed out it asks for the address
 * they applied with, framed around the booth fee because that is why they
 * were written to. Signed in it sends them to their own account, where
 * payment is the headline and the call times, paperwork and item list sit
 * underneath it. One page to maintain, and the maker sees everything rather
 * than an invoice with the rest of their to-do list hidden somewhere else.
 *
 * Short on purpose. This gets pasted into emails written by hand and read off
 * a phone, and /account/payment is a mouthful that invites a typo.
 */
export default async function PayDoor({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>
}) {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')
  const sp = await searchParams

  const email = await readSession((await cookies()).get(MAKER_COOKIE)?.value)
  if (email) {
    const vendor = await db.query.vendors.findFirst({ where: eq(vendors.email, email) })
    /* Already signed in: straight through. Their page carries the invoice at
       the top, so there is nothing this one could add. */
    if (vendor) redirect('/account')
  }

  return (
    <SiteShell show={show} template="page template-suffix-account">
      <div className="mk-acct">
        <div className="container">
          <AccountHeader
            eyebrow="Booth fee"
            shopName="Pay your booth fee"
            showName={show.name}
            signOut={false}
          />
          <div className="mk-grid">
            <Card wide>
              <SignInForm
                expired={sp.expired === '1'}
                next="payment"
                title="Pay your booth fee"
                note="Enter the email you applied with. We will send you a link that opens your own page, with your fee and everything else we need from you."
              />
            </Card>
          </div>
        </div>
      </div>
    </SiteShell>
  )
}
