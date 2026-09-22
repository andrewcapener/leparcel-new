import Link from 'next/link'
import { cookies } from 'next/headers'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { applications, spaceTypes, vendors } from '@/db/schema'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle, FactTable } from '@/components/theme/Sections'
import { AccountHeader, Card, Facts } from './Shell'
import { fmtDate } from '@/lib/dates'
import { POLICY } from '@/lib/agreement'
import { bpsLabel } from '@/lib/money'
import { MAKER_COOKIE, readSession } from '@/lib/makerAuth'
import { SignInForm } from './SignInForm'
import { BoothInvoice } from './BoothInvoice'
import { Checklist } from './Checklist'
import { WhatYouTold, YourDetails } from './YourApplication'
import { CallTimes } from './CallTimes'
import { PayoutSetup } from './PayoutSetup'
import { manualOptions, qrDataUri } from '@/server/modules/payments/manual'
import { checklistFor, clearForLoadIn, slotOptions } from '@/server/modules/compliance/checklist'
import { permitState, permitCleared } from '@/server/modules/compliance/permit'
import { settlesInsideWindow, offersCard } from '@/server/modules/payments/methods'
import { CONTACT_EMAIL } from '@/lib/agreement'
import { boothInvoice } from '@/server/modules/payments/booth'
import { paymentsConfigured, isTestMode } from '@/server/modules/payments/config'
import { connectState, owesPayoutSetup, requirementList, requirementsInPlainWords } from '@/server/modules/payments/connect'
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
    /** "back" when Stripe returned them from payout onboarding. */
    payouts?: string
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
  /* Where this maker will actually stand, which is not always what they
     applied for. An application can say `both`; a booked space is always one
     or the other, and spaceTypes.track carries it. It decides four things
     that were all keyed off the application until now: whether they are asked
     for an item list, which call times they see, whether the state requires us
     to hold their seller's permit, and whether they are ever owed a payout at
     all. A `both` applicant placed
     outdoors used to be asked for a catalogue they do not owe and shown no
     call times at all. Before a booking exists there is nothing better to go
     on, so the application's answer stands and `both` keeps owing a permit,
     which is the conservative way round. */
  const placed = billing
    ? (await db.query.spaceTypes.findFirst({
        where: eq(spaceTypes.id, billing.booking.spaceTypeId),
      }))?.track
    : undefined
  const track = placed ?? app?.track ?? ''

  /* Where this maker stands on getting PAID. Read from our own columns, which
     only the webhook and an explicit refresh write, and only from what Stripe
     said: `payouts_enabled` is Stripe's verdict and nothing here is allowed to
     stand in for it.

     Undefined unless the Show says to ask and Stripe is configured here. Both
     halves matter: the switch is off until Connect is live on the Stripe
     account, and a button that cannot work is worse than no button. */
  const payouts = show.payoutSetup === 'on' && paymentsConfigured() && owesPayoutSetup(track)
    ? connectState({
        stripeAccountId: vendor.stripeAccountId,
        payoutsEnabled: vendor.payoutsEnabled,
        connectRequirements: vendor.connectRequirements,
        connectDisabledReason: vendor.connectDisabledReason,
      })
    : undefined

  /* Venmo and Zelle, on the maker's own page. Only while something is owed:
     a second way to pay a settled invoice is how somebody pays twice. */
  const manualHere = billing && billing.booking.status === 'awaiting_payment' && billing.invoice.totalCents > 0
    ? manualOptions(
        { venmoHandle: show.venmoHandle, zelleContact: show.zelleContact, zelleName: show.zelleName },
        billing.invoice.totalCents, billing.booking.vendorCode, show.name,
      )
    : []
  /* One code per method that has a url to encode. Venmo's carries the amount
     and the MM note; Zelle's carries only who to pay, because that is all the
     format holds. */
  const codes = Object.fromEntries(await Promise.all(
    manualHere.map(async (o) => [o.kind, o.url ? await qrDataUri(o.url) : null] as const),
  )) as Record<string, string | null>

  const checklist = app
    ? checklistFor({
        applicationStatus: app.status,
        track,
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
        /* Per track, because the times are: the outdoor slots exist and the
           indoor ones may not yet. */
        onboardingSlots: track === 'outdoor'
          ? show.onboardingSlotsOutdoor
          : show.onboardingSlotsIndoor,
        onboardingSlot: billing?.booking.onboardingSlot,
        inventoryDueAt: show.inventoryDueAt,
        payoutState: payouts,
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

  /* One short phrase for the header band. The booking, not the application,
     knows whether an accepted maker has actually paid. */
  const headline = !app
    ? undefined
    : app.status === 'accepted' && billing?.booking.status === 'confirmed'
      ? 'Accepted and paid'
      : app.status === 'accepted'
        ? 'Accepted'
        : app.status === 'waitlist'
          ? 'On the waiting list'
          : app.status === 'declined'
            ? 'Not this show'
            : app.status === 'withdrawn'
              ? 'Withdrawn'
              : 'With the jury'

  return (
    <SiteShell show={show} template="page template-suffix-account">
      {/* The account has its own ground and its own furniture. It used to be
          a stack of the theme's full-bleed marketing sections, which is why
          a maker's own dashboard read like a webpage. */}
      <div className="mk-acct">
        <div className="container">
          <AccountHeader
            shopName={vendor.shopName}
            vendorCode={billing?.booking.vendorCode}
            status={headline}
            showName={show.name}
          />

          <div className="mk-grid">
            {/* The task list first, because it answers the question a maker
                actually arrived with: what does Mermade need from me, and
                when. The invoice below is one row of it. */}
            {checklist.length > 0 && (
              <Card title="What we need from you" id="checklist" wide>
                <Checklist
                  items={checklist}
                  clear={clearForLoadIn(checklist, permitOutstanding)}
                  feeDeadlineIsStart={!settlesInsideWindow(show.paymentMethods)}
                />
              </Card>
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
                manual={manualHere}
                codes={codes}
              />
            )}

            {/* Money the other way. Indoor only, because only an indoor maker
                is ever owed anything, and only once accepted: onboarding
                before there is a space to be paid for is an identity check
                asked of somebody who may yet be declined. */}
            {payouts && app?.status === 'accepted' && (
              <PayoutSetup
                state={payouts}
                needs={requirementsInPlainWords(requirementList(vendor.connectRequirements))}
                notice={sp.payouts === 'back' ? 'back' : sp.payouts === 'unavailable' ? 'unavailable' : undefined}
              />
            )}

            {/* Only for an accepted maker with times offered for their track.
                The checklist row anchors here. */}
            {billing && app && (() => {
              const opts = slotOptions(
                track === 'outdoor' ? show.onboardingSlotsOutdoor : show.onboardingSlotsIndoor,
              )
              return opts.length > 0
                ? <CallTimes options={opts} chosen={billing.booking.onboardingSlot} />
                : null
            })()}

            <Card title={`Your ${show.name}`}>
              <Facts
                rows={app
                  ? [
                      {
                        label: 'Where it stands',
                        /* An accepted maker who has paid must not still be told
                           their space is "held until you pay it". */
                        value: <strong>{
                          app.status === 'accepted' && billing?.booking.status === 'confirmed'
                            ? 'Accepted, and your space is paid for. See you in November.'
                            : STATUS[app.status] ?? app.status
                        }</strong>,
                      },
                      { label: 'Roster announced', value: fmtDate(show.rosterAnnouncedOn) },
                      { label: 'The show', value: `${fmtDate(show.startsOn)} to ${fmtDate(show.endsOn)}` },
                      { label: 'Where', value: show.venueName },
                      ...(billing ? [{ label: 'Your Mermade ID', value: billing.booking.vendorCode }] : []),
                    ]
                  : [
                      { label: 'Where it stands', value: <>No application to {show.name} yet from this address.</> },
                      { label: 'Applications close', value: `${fmtDate(show.applicationsCloseAt)}, 11:59pm PT` },
                    ]}
              />
              {!app && (
                <p className="mk-task__do">
                  <Link className="btn btn--primary" href="/apply">Apply to sell</Link>
                </p>
              )}
            </Card>

            {/* How the money moves, both directions, on the one page a maker
                is signed into. Drew's call, 6 Sep 2026: payouts move off the
                Zelle and Venmo handles the market used to keep on a
                spreadsheet and onto Stripe.

                Still deliberately no "set up payouts" button. Stripe now
                takes booth fees (money IN, above), but Connect onboarding for
                payouts (money OUT) is not built, and a button that goes
                nowhere is worse than a sentence that says when it will. */}
            {app && <YourDetails app={app} vendor={vendor} />}

            <Card title={app?.status === 'accepted' ? 'Getting paid' : 'How the money will work'} wide>
              <Facts
                rows={[
                  {
                    label: 'Your booth fee',
                    /* Never offer a method the Show is not accepting. This row
                       and the invoice above it are on the same page, and
                       disagreeing about how somebody may pay is exactly what a
                       maker writes in about. */
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
                    value: 'Send payment details by email. Every way to pay lives on your own page here, on our site. If a message asks you to send money somewhere else, it is not from us.',
                  },
                ]}
              />
            </Card>

            {/* Everything they wrote, given back to them. An application is
                the longest form this business asks anybody to fill in and it
                used to vanish the moment it was sent. */}
            {app && <WhatYouTold app={app} spacesAsked={asked} />}
          </div>
        </div>
      </div>
    </SiteShell>
  )
}
