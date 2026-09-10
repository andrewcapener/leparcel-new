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
import { BoothInvoice } from './BoothInvoice'
import { Checklist } from './Checklist'
import { YourApplication } from './YourApplication'
import { checklistFor, clearForLoadIn } from '@/server/modules/compliance/checklist'
import { permitState, permitCleared } from '@/server/modules/compliance/permit'
import { settlesInsideWindow, offersCard } from '@/server/modules/payments/methods'
import { CONTACT_EMAIL } from '@/lib/agreement'
import { boothInvoice } from '@/server/modules/payments/booth'
import { paymentsConfigured, isTestMode } from '@/server/modules/payments/config'
import { bookings } from '@/db/schema'

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
  accepted: 'Accepted. Your booth fee is below, and your space is held until you pay it.',
  waitlist: 'On the waiting list. Spaces do come back, and we will write if one does.',
  declined: 'Not this show. We are sorry, and applying again next season is welcome.',
  withdrawn: 'Withdrawn at your request.',
}

export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{
    expired?: string; signedout?: string
    /** Set by the return from Stripe and by every failure path in payBoothFee. */
    paid?: string; pay?: string
  }>
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
  /* The whole row. This page now shows a maker everything they submitted, so
     picking columns here would mean editing two places every time the form
     grows a field. Nothing here is secret from the person who wrote it. */
  const [app] = await db
    .select()
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

  /* The booking, if they have one. It only exists once a jury decision made
     one, so this is the difference between "we have your application" and
     "your space is held and here is what it costs". */
  const [booked] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.vendorId, vendor.id), eq(bookings.showId, show.id)))
    .limit(1)
  const billing = booked ? await boothInvoice(db, booked.id) : undefined

  const notice = sp.paid === '1'
    ? ('paid' as const)
    : sp.pay === 'unavailable' || sp.pay === 'missing' || sp.pay === 'failed'
      ? (sp.pay as 'unavailable' | 'missing' | 'failed')
      : undefined

  /* What we need from them, and where each thing stands. The rule for who
     owes what lives in compliance/checklist.ts and is shared with the admin,
     rather than being a condition written out twice and drifting. */
  const checklist = app
    ? checklistFor({
        applicationStatus: app.status,
        track: app.track,
        booking: billing
          ? { status: billing.booking.status, paymentDueAt: billing.booking.paymentDueAt }
          : undefined,
        sellerPermit: app.sellerPermit,
        occasionalSeller: app.occasionalSeller,
        permitStatus: app.permitStatus,
        hasCoi: app.hasCoi,
        /* Load-in is the day before the show opens. Not a date we invent to
           create urgency: it is the day the doors need everything in order. */
        loadInAt: show.startsOn,
        nowIso: new Date().toISOString(),
        contactEmail: CONTACT_EMAIL,
        startOnly: !settlesInsideWindow(show.paymentMethods),
      })
    : []

  /* The permit can block load-in without appearing on the list, because once
     a maker has answered it is our move, not theirs. So clearance is asked of
     the permit directly rather than inferred from the rows. */
  const permitOutstanding = app
    ? !permitCleared(permitState({
        track: app.track,
        permitStatus: app.permitStatus,
        sellerPermit: app.sellerPermit,
        occasionalSeller: app.occasionalSeller,
      }))
    : false

  return (
    <SiteShell show={show} template="page template-suffix-account">
      <PageTitle title={vendor.shopName} />

      {/* The checklist first, because it answers the question a maker
          actually arrived with: what does Mermade need from me, and when.
          The invoice below is one row of it. */}
      {checklist.length > 0 && (
        <Checklist
          items={checklist}
          clear={clearForLoadIn(checklist, permitOutstanding)}
          feeDeadlineIsStart={!settlesInsideWindow(show.paymentMethods)}
        />
      )}

      {billing && (
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

      <FactTable
        title={`Your ${show.name}`}
        rows={app
          ? [
              {
                label: 'Where it stands',
                /* An accepted maker who has paid must not still be told their
                   space is "held until you pay it". The booking, not the
                   application, is what knows the difference. */
                value: <strong>{
                  app.status === 'accepted' && billing?.booking.status === 'confirmed'
                    ? 'Accepted, and your space is paid for. See you in November.'
                    : STATUS[app.status] ?? app.status
                }</strong>,
              },
              { label: 'Roster announced', value: fmtDate(show.rosterAnnouncedOn) },
              { label: 'The show', value: `${fmtDate(show.startsOn)} to ${fmtDate(show.endsOn)}, ${show.venueName}` },
              ...(billing ? [{ label: 'Your Mermade ID', value: billing.booking.vendorCode }] : []),
            ]
          : [
              { label: 'Where it stands', value: <>No application to {show.name} yet from this address.</> },
              { label: 'Applications close', value: `${fmtDate(show.applicationsCloseAt)}, 11:59pm PT` },
            ]}
        cta={app ? undefined : { href: '/apply', label: 'Apply to sell' }}
      />

      {/* Everything they wrote, given back to them. An application is the
          longest form this business asks anybody to fill in and it used to
          vanish the moment it was sent. */}
      {app && (
        <YourApplication
          app={app}
          vendor={vendor}
          spacesAsked={asked}
        />
      )}

      {/* How the money moves, both directions, on the one page a maker is
          signed into. Drew's call, 6 Sep 2026: payouts move off the Zelle and
          Venmo handles the market used to keep on a spreadsheet and onto
          Stripe. The step that needs explaining is the ten minutes of setup, so
          it is explained here rather than arriving as a surprise in an
          acceptance email.

          Still deliberately no "set up payouts" button. Stripe now takes booth
          fees (money IN, above), but Connect onboarding for payouts (money
          OUT) is not built, and a button that goes nowhere is worse than a
          sentence that says when it will. */}
      <FactTable
        title={app?.status === 'accepted' ? 'Getting paid' : 'How the money will work'}
        rows={[
          {
            label: 'Your booth fee',
            /* Never offer a method the Show is not accepting. This row and
               the invoice above it are on the same page, and disagreeing
               about how somebody may pay is exactly what a maker writes in
               about. */
            value: offersCard(show.paymentMethods)
              ? billing
                ? <>Above, on this page. Card or bank transfer, whichever suits you, due within {show.paymentWindowHours} hours of being accepted.</>
                : <>If you are accepted, it appears on this page and is due within {show.paymentWindowHours} hours. Card or bank transfer, whichever suits you.</>
              : billing
                ? <>Above, on this page, by bank transfer. Start it within {show.paymentWindowHours} hours of being accepted and your space is held while it clears.</>
                : <>If you are accepted, it appears on this page. Bank transfer, started within {show.paymentWindowHours} hours of being accepted.</>,
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
