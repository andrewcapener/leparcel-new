import Link from 'next/link'
import { cookies } from 'next/headers'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { applications, spaceTypes, vendors } from '@/db/schema'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle, FactTable, RichText } from '@/components/theme/Sections'
import { fmtDate, fmtDateTime } from '@/lib/dates'
import { POLICY } from '@/lib/agreement'
import { bpsLabel } from '@/lib/money'
import { MAKER_COOKIE, readSession } from '@/lib/makerAuth'
import { SignInForm } from './SignInForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Maker account',
  robots: { index: false, follow: false },
}

/** What a maker is told their application is doing, in their words not ours.
 *  `under_review`, `shortlist` and `new` are all one thing from outside: we
 *  have it and we have not decided. Saying "shortlisted" would be a promise. */
const STATUS: Record<string, string> = {
  new: 'Received. We have it and the jury has not sat yet.',
  under_review: 'Received. We have it and the jury has not sat yet.',
  shortlist: 'Received. We have it and the jury has not sat yet.',
  accepted: 'Accepted. Watch your email for your booth fee and your space.',
  waitlist: 'On the waiting list. Spaces do come back, and we will write if one does.',
  declined: 'Not this show. We are sorry, and applying again next season is welcome.',
  withdrawn: 'Withdrawn at your request.',
}

export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; signedout?: string }>
}) {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')
  const sp = await searchParams

  const email = await readSession((await cookies()).get(MAKER_COOKIE)?.value)
  const vendor = email
    ? await db.query.vendors.findFirst({ where: eq(vendors.email, email) })
    : undefined

  /* ── signed out ──────────────────────────────────────────────────────── */
  if (!vendor) {
    return (
      <SiteShell show={show} template="page template-suffix-account">
        <PageTitle title="Maker account" />
        <div className="shopify-section section-rich-text">
          <div className="fully-spaced-row--medium">
            <div className="container container--reading-width">
              <SignInForm expired={sp.expired === '1'} />
            </div>
          </div>
        </div>
        <FactTable
          title="What the account is for"
          rows={[
            { label: 'Signing in', value: 'A link emailed to the address on your application. No password to remember or lose.' },
            { label: 'Your application', value: <>Where it stands, and what you asked for. The roster goes out {fmtDate(show.rosterAnnouncedOn)}.</> },
            { label: 'Your booth fee', value: <>Due within {show.paymentWindowHours} hours of being accepted. The invoice arrives with your acceptance.</> },
            { label: 'Your paperwork', value: 'Seller’s permit and, for food makers, your permit number. Required before load-in, not before you apply.' },
          ]}
        />
      </SiteShell>
    )
  }

  /* ── signed in ───────────────────────────────────────────────────────── */
  const [app] = await db
    .select({
      id: applications.id,
      status: applications.status,
      track: applications.track,
      category: applications.category,
      submittedAt: applications.submittedAt,
      requestedSpaceIds: applications.requestedSpaceIds,
    })
    .from(applications)
    .where(and(eq(applications.vendorId, vendor.id), eq(applications.showId, show.id)))
    .orderBy(desc(applications.submittedAt))
    .limit(1)

  const spaces = app ? await db.select({ id: spaceTypes.id, label: spaceTypes.label }).from(spaceTypes) : []
  const asked: string[] = app
    ? (JSON.parse(app.requestedSpaceIds || '[]') as string[])
        .map((id) => spaces.find((s) => s.id === id)?.label ?? null)
        .filter((x): x is string => Boolean(x))
    : []

  return (
    <SiteShell show={show} template="page template-suffix-account">
      <PageTitle title={vendor.shopName} />

      <FactTable
        title={`Your ${show.name}`}
        rows={app
          ? [
              { label: 'Where it stands', value: <strong>{STATUS[app.status] ?? app.status}</strong> },
              { label: 'Applied', value: fmtDateTime(String(app.submittedAt)) },
              { label: 'Track', value: app.track === 'indoor' ? 'Inside, consignment' : app.track === 'outdoor' ? 'Outside, your own tent day' : 'Either, whichever we can fit' },
              { label: 'Category', value: app.category },
              ...(asked.length > 0 ? [{ label: 'Spaces you asked for', value: asked.join(' · ') }] : []),
              { label: 'Roster announced', value: fmtDate(show.rosterAnnouncedOn) },
            ]
          : [
              { label: 'Where it stands', value: <>No application to {show.name} yet from this address.</> },
              { label: 'Applications close', value: `${fmtDate(show.applicationsCloseAt)}, 11:59pm PT` },
            ]}
        cta={app ? undefined : { href: '/apply', label: 'Apply to sell' }}
      />

      <FactTable
        title="Your details"
        rows={[
          { label: 'Shop', value: vendor.shopName },
          { label: 'You', value: vendor.contactName },
          { label: 'Email', value: vendor.email },
          { label: 'Instagram', value: vendor.instagram || 'Not given' },
          { label: 'Where you are', value: [vendor.city, vendor.state].filter(Boolean).join(', ') || 'Not given' },
        ]}
      />

      {/* How the money moves, both directions, on the one page a maker is
          signed into. Drew's call, 6 Sep 2026: payouts move off the Zelle and
          Venmo handles the market used to keep on a spreadsheet and onto
          Stripe. The step that needs explaining is the ten minutes of setup, so
          it is explained here rather than arriving as a surprise in an
          acceptance email.

          Deliberately no "set up payouts" button yet: Stripe is not connected,
          and a button that goes nowhere is worse than a sentence that says
          when it will. */}
      <FactTable
        title={app?.status === 'accepted' ? 'Getting paid' : 'How the money will work'}
        rows={[
          {
            label: 'Your booth fee',
            value: <>Your acceptance carries a payment link. Card or bank transfer, whichever suits you, due within {show.paymentWindowHours} hours.</>,
          },
          ...(app?.track === 'outdoor' ? [] : [{
            label: 'What you sell inside',
            value: <>We sell at the register, keep {bpsLabel(show.commissionBps)}, and pay you the rest {POLICY.payoutDaysMin} to {POLICY.payoutDays} days after the show closes.</>,
          }]),
          {
            label: 'Where it lands',
            value: 'Your own bank account, through Stripe. Setting that up asks who you are and where the money goes, takes about ten minutes, and you only do it once.',
          },
          {
            label: 'When you do it',
            value: app?.status === 'accepted'
              ? 'Now is a good time. We will email you the link, and your money waits for you if it is not ready by statement day.'
              : 'After you are accepted. Nothing to do yet.',
          },
          {
            label: 'What we never do',
            value: 'Ask you to send money by Zelle, Venmo, a wire, or any link that did not come from us. If someone does, it is not us.',
          },
        ]}
      />

      <RichText large={false}>
        <p>
          Anything here wrong? <Link href="/contact">Tell us</Link> and we will fix
          it. Your next application updates all of it too.
        </p>
        {/* A form, not a link: signing out changes state and a GET would let any
            page on the internet do it with an image tag. */}
        <form action="/account/signout" method="POST">
          <button className="ap-link-btn" type="submit">Sign out</button>
        </form>
      </RichText>
    </SiteShell>
  )
}
