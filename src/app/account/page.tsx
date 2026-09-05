import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle, FactTable, RichText } from '@/components/theme/Sections'
import { fmtDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Vendor account' }

/**
 * /account — the vendor portal's front door.
 *
 * The portal itself is the next piece of work and is designed, not built
 * (see README and docs/06-OPEN-QUESTIONS.md). Rather than a nav link that
 * goes nowhere, or a sign-in box that cannot sign anyone in, this says
 * plainly what the account is for, when it opens, and what a maker can do in
 * the meantime. Everything dated on it comes off the Show record.
 */
export default async function Account() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  return (
    <SiteShell show={show} template="page template-suffix-account">
      <PageTitle title="Vendor account" />

      <FactTable
        title="What the account is for"
        rows={[
          { label: 'Who it is for', value: 'Makers accepted into the show. There is nothing to sign in to before then.' },
          { label: 'Opens', value: <>With the {show.name} acceptances, on {fmtDate(show.rosterAnnouncedOn)}.</> },
          { label: 'Signing in', value: 'A link emailed to the address on your application. No password to remember or lose.' },
          { label: 'Paying your booth fee', value: <>Due within {show.paymentWindowHours} hours of being accepted. The invoice arrives with your acceptance.</> },
          { label: 'Your paperwork', value: 'Seller’s permit and, for food makers, your permit number. Required before load-in, not before you apply.' },
          { label: 'Your space', value: 'What you booked, any add-ons, and your load-in time once the floor plan is set.' },
        ]}
      />

      <RichText large={false} cta={{ href: '/apply', label: 'Apply to sell' }}>
        <p>
          Applications for {show.name} open {fmtDate(show.applicationsOpenAt)}. If
          you have already applied, watch the address you applied with. Everything
          from us goes there first.
        </p>
        <p>
          Something else? <Link href="/contact">Get in touch</Link>.
        </p>
      </RichText>
    </SiteShell>
  )
}
