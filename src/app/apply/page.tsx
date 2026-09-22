import Link from 'next/link'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow, activeAddOns, activeSpaceTypes } from '@/db/queries'
import { spaceTypes } from '@/db/schema'
import { SiteShell } from '@/components/theme/SiteShell'
import { CollapsibleTabs, PriceTable, type Tab } from '@/components/theme/Sections'
import { ApplyForm } from './ApplyForm'
import { WaitlistForm } from './WaitlistForm'
import { photoUploadsEnabled } from '@/server/modules/uploads/config'
import { applyFaq, fill } from '@/lib/page-html'
import { applicationWindow, fmtDate, fmtRange } from '@/lib/dates'
import { previewingOpenWindow } from '@/lib/preview'
import { SignupForm } from '@/components/theme/SignupForm'
import { bpsLabel, usd } from '@/lib/money'
import { PhotoStrip } from '@/components/theme/PhotoStrip'
import { rotated, stripFrames } from '@/lib/content'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Maker Application',
  description:
    'Apply to sell at Mermade Market in Dana Point. Indoor consignment spaces and outdoor tent days, prices, dates and the rules, with no fee to apply.',
  alternates: { canonical: '/apply' },
}

/**
 * /apply does two jobs, and they used to be stacked on top of each other:
 * the prospectus (what it costs, when things happen, what the rules are) and
 * the act of applying. Two price tables, a dates block and an eight-row FAQ
 * ran at the same visual weight above the form, which on a phone was a few
 * thousand pixels of scrolling before the first input.
 *
 * The two jobs are now separated and reordered:
 *
 *   1. A short head. What this is, the four figures a maker arrives wanting
 *      (close date, roster date, inside price + rate, outside price), and one
 *      button into the form. docs/08-DESIGN-SYSTEM.md §8: answer the obvious
 *      questions before you explain anything.
 *   2. The form, high enough on the page that a returning maker reaches it
 *      without reading anything.
 *   3. The prospectus underneath, as one uniform stack of disclosures: the
 *      two price tables, the dates, the guidelines, then their FAQ. Every row
 *      is one line until you open it, so the whole reference section is about
 *      a screen tall instead of ten.
 *
 * Every price and date here comes off the Show record, space_types and
 * add_ons (CLAUDE.md rule 6). Nothing on this page is typed in by hand.
 */
export default async function Apply({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>
}) {
  // Two different previews, and they are not the same thing.
  //   ?preview=1        renders the form outside the window, view only.
  //   the launch preview  renders the WHOLE site as it will read once
  //                       applications open, on one staff browser, set from
  //                       /admin. This page gated on the date alone, so the
  //                       launch preview flipped the announcement bar and the
  //                       home page and then left the form shut, which is the
  //                       one page anyone previewing a launch wants to see.
  // Submission is still enforced server-side in actions.ts, which rejects
  // anything outside the window regardless of how the form was reached.
  const preview = (await searchParams).preview === '1'
  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  const spaces = await activeSpaceTypes(show.id)
  const extras = await activeAddOns(show.id)
  const indoor = spaces.filter((s) => s.track === 'indoor')
  const outdoor = spaces.filter((s) => s.track === 'outdoor')
  const forTrack = (t: 'indoor' | 'outdoor') =>
    extras.filter((a) => a.track === null || a.track === t)
  const win = applicationWindow(show.applicationsOpenAt, show.applicationsCloseAt)
  // Either preview opens the form on screen. Neither opens it to the public:
  // the server action that accepts a submission checks the real window and
  // does not consult these (src/app/actions.ts).
  const previewingLaunch = await previewingOpenWindow()
  const showForm = win === 'open' || preview || previewingLaunch
  const days = show.hoursNote.split(' · ')

  const openMs = new Date(show.applicationsOpenAt).getTime()
  const closeMs = new Date(show.applicationsCloseAt).getTime()
  /* Full days, floored, not rounded.
     The window opens Monday morning and closes Monday night, which is
     fourteen days and is how the team says it: Elise, "applications are open
     14 days. Monday to Monday". Rounding turned 14.6 into 15 and the FAQ said
     so. The copy this feeds reads "only open for N full days", and a day that
     is five sixths over is not a full day. */
  const windowDays = Math.max(1, Math.floor((closeMs - openMs) / 86_400_000))

  /** The cheapest and dearest space in a track, as one string. Integer cents
   *  in, usd() out (CLAUDE.md rule 1). A single space prices as itself. */
  const range = (list: Array<{ priceCents: number }>) => {
    if (list.length === 0) return null
    const cents = list.map((s) => s.priceCents)
    const lo = Math.min(...cents)
    const hi = Math.max(...cents)
    return lo === hi ? usd(lo) : `${usd(lo)}-${usd(hi)}`
  }
  const indoorRange = range(indoor)
  const outdoorRange = range(outdoor)

  const vars = {
    showName: show.name,
    dateRange: fmtRange(show.startsOn, show.endsOn),
    venue: show.venueName,
    commission: show.commissionBps / 100,
    paymentWindow: show.paymentWindowHours,
    windowDays,
  }

  /* The prospectus. One shape for all of it: a summary line you can read
     without opening anything, and the detail inside. The summaries name the
     structural difference between the two tracks, who does the selling, and
     the prices live in the table each one opens onto rather than in the
     heading. A maker meeting a dollar range before they know what it buys
     reads it as a bill. */
  const details: Tab[] = [
    {
      q: 'Selling inside: we sell it for you',
      a: (
        <>
          <PriceTable caption="Indoor spaces" spaces={indoor} extras={forTrack('indoor')} />
          <p>
            Inside is consignment. Your shop is set up and on the floor for
            all three days, and you do not have to be: we merchandise your
            work, sell it at one register, and pay out after the show.
          </p>
        </>
      ),
    },
    {
      q: 'Selling outside: you sell it yourself',
      a: (
        <>
          <PriceTable caption="Outdoor days" spaces={outdoor} extras={forTrack('outdoor')} />
          <p>
            If you choose only 1 day above, that tells us you will not be
            flexible. If you choose 2+ days to sell, you&rsquo;ll have a
            higher chance at getting in. No rental tables, and there is a
            waitlist option on the application.
          </p>
        </>
      ),
    },
    {
      q: 'Dates that matter',
      a: (
        <dl className="fact-table">
          {[
            { label: 'Applications open', value: fmtDate(show.applicationsOpenAt) },
            { label: 'Applications close', value: `${fmtDate(show.applicationsCloseAt)}, 11:59pm PT` },
            { label: 'Line-up announced', value: fmtDate(show.rosterAnnouncedOn) },
            { label: 'Booth fee due', value: `Within ${show.paymentWindowHours} hours of being accepted` },
            ...(show.loadInNote ? [{ label: 'Inside set-up', value: show.loadInNote }] : []),
            /* Outside is a separate row because it is a separate day: inside
               loads in the evening before the doors open, outside the morning
               of the one day they booked. One row headed "Set-up" would tell
               half the applicants the wrong thing. */
            ...(show.outdoorLoadInNote
              ? [{ label: 'Outside set-up', value: show.outdoorLoadInNote }]
              : []),
            ...(show.takedownNote ? [{ label: 'Inside take-down', value: show.takedownNote }] : []),
            {
              label: 'Show hours',
              value: <>{days.map((d) => <div key={d}>{d}</div>)}</>,
            },
          ].map((r) => (
            <div className="fact-table__row" key={r.label}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      ),
    },
    {
      q: 'Show guidelines',
      a: (
        <p>
          No application fee. No entrance fee for shoppers. Free hugs and
          taffy. Read the maker rules before you apply:{' '}
          <Link href="/makers/indoor">inside</Link> ·{' '}
          <Link href="/makers/outdoor">outside</Link>.
        </p>
      ),
    },
    ...applyFaq.map((t) => ({
      q: t.q,
      a: <div dangerouslySetInnerHTML={{ __html: fill(t.a, vars) }} />,
    })),
  ]

  /* The four figures a maker arrives wanting. Six to eight rows is a fact
     table; four figures is a strip you read in one pass. */
  const glance: Array<{ label: string; value: string }> = [
    {
      label: win === 'before'
        ? 'Applications open'
        // Past tense once they have. The value under it is the same
        // timestamp either way; only the verb moves.
        : win === 'closed' ? 'Applications closed' : 'Applications close',
      value: win === 'before'
        ? fmtDate(show.applicationsOpenAt, { year: undefined })
        : `${fmtDate(show.applicationsCloseAt, { year: undefined })}, 11:59pm PT`,
    },
    { label: 'Line-up announced', value: fmtDate(show.rosterAnnouncedOn, { year: undefined }) },
    // No price range up here. A maker's first sight of the page was
    // "$60-$450 plus 20%" beside two dates, which reads as a bill before they
    // know what they get for it. The real difference between the two tracks
    // is not what they cost, it is who does the selling and how you pay for
    // it, and that is the question a maker actually arrives with. The full
    // price table is one scroll down, where the figures sit next to what they
    // buy. The rate comes off the Show record, never typed here.
    { label: 'Inside', value: `We sell for you, ${bpsLabel(show.commissionBps)} commission` },
    { label: 'Outside', value: 'You sell in person, no commission' },
  ]

  return (
    <SiteShell show={show} template="page template-suffix-merchant-application">
      {/* ── The head ─────────────────────────────────────────────────────
          Short on purpose. On a 390px screen the form's first step is one
          swipe from here. */}
      <div className="shopify-section section-rich-text">
        {/* `ap-head-w`, not the bare reading width. 620px is the right measure
            for a paragraph and the wrong one for a head carrying a four-up
            figure strip: it squeezed each cell to 155px and wrapped every
            value onto two lines. The lede keeps a reading measure inside it. */}
        <div className="container container--reading-width ap-head-w">
          <header className="ap-head">
            <p className="ap-head__eyebrow">
              {show.name} · {fmtRange(show.startsOn, show.endsOn)} · {show.venueName}
            </p>
            {/* Once the window shuts, the head has to stop being an
                invitation. Everything below it is still worth reading: the
                prices, the dates and the rules are what somebody deciding
                whether to apply next time came here for. So the page keeps
                its whole prospectus and only the ask changes. */}
            <h1 className="majortitle in-content h1 ap-head__title">
              {win === 'closed' ? 'Join the waitlist' : 'Maker Application'}
            </h1>
            <p className="ap-head__lede">
              {win === 'closed'
                ? <>Applications closed and the roster is set. Spaces still come free,
                  usually when an accepted maker does not pay their booth fee in time,
                  and when one does we go to this list first. It is the same form and
                  the same questions: inside is consignment, sold at one register;
                  outside is a tent for the day and you keep everything you sell.</>
                : <>One form covers both tracks. Inside is consignment: we showcase
                  your shop for all three days and sell it at one register. Outside
                  is a tent we set up for you, for the day, and you keep everything
                  you sell. No fee to apply, and we answer either way.</>}
            </p>

            <dl className="ap-glance">
              {glance.map((g) => (
                <div className="ap-glance__item" key={g.label}>
                  <dt>{g.label}</dt>
                  <dd className="num">{g.value}</dd>
                </div>
              ))}
            </dl>

            {/* One button, and a link. The prospectus is reference, so it
                does not get the weight of the thing the page is for. */}
            <div className="ap-head__actions">
              {showForm && (
                <a className="btn ap-head__go" href="#apply">Start your application</a>
              )}
              <a className="ap-head__alt" href="#details">
                Prices, dates and rules
              </a>
            </div>
          </header>
        </div>
      </div>

      {/* ── The form ─────────────────────────────────────────────────────── */}
      <div className="shopify-section section-custom-liquid">
        <div className="custom-html">
          <div className="container">
            {/* Inside the container, not above it. Outside it the anchor sat
                above the section's own top padding, so "Start your
                application" landed a maker with the top of the form 345px
                down a 390px screen: a swipe of empty page between the button
                they pressed and the thing it was for. */}
            <div id="apply" className="ap-anchor" />
            {showForm || win === 'closed' ? (
              <>
                {win !== 'open' && (
                  <p className="ap-preview" role="status">
                    {previewingLaunch
                      ? <>Staff preview. Applications open to the public on{' '}
                        {fmtDate(show.applicationsOpenAt)}, and anything you submit
                        here before then is a real application. Delete it from the
                        admin when you are done.</>
                      /* Two different reasons the form is shut, and the same
                         sentence cannot cover both: before the window opens
                         the date to name is the opening, after it closes that
                         date is in the past and naming it reads as a promise
                         the window is about to reopen. */
                      : win === 'closed'
                        ? <>Applications closed {fmtDate(show.applicationsCloseAt)}.
                          This form is the waiting list now: it still takes a whole
                          application, and what comes in lands as a waitlist entry
                          rather than in the review queue.</>
                        : <>Preview. Applications are not open, and submissions are
                          disabled until {fmtDate(show.applicationsOpenAt)}.</>}
                  </p>
                )}
                <ApplyForm
                  show={show} spaces={spaces} extras={extras}
                  uploads={photoUploadsEnabled()}
                  /* Staff rehearsing before launch submit real applications on
                     purpose, so only a genuinely closed window is the list. */
                  waitlist={win === 'closed' && !previewingLaunch}
                />
              </>
            ) : win === 'before' ? (
              /* Outside the window this is the whole page's ask, so the
                 invitation needs the field that answers it. */
              <div className="reading-width account-form rte align-center ap-closed">
                <h2>{`Applications open ${fmtDate(show.applicationsOpenAt)}.`}</h2>
                <p>Join the list and we’ll email you the morning they open.</p>
                <div className="apply-signup">
                  <SignupForm source="apply" />
                </div>
              </div>
            ) : (
              /* Closed. The page stops being an application and becomes the
                 waiting list for the next one.

                 The one thing not to do here is imply a reopening date. The
                 next show is not on the Show record yet, and a maker who
                 reads a date into this sentence will stop checking. So the
                 copy says what is true: nothing is scheduled, and the list
                 is how you hear first. */
              <div className="reading-width account-form rte align-center ap-closed">
                <h2>{`Applications for ${show.name} closed ${fmtDate(show.applicationsCloseAt)}.`}</h2>
                <p>
                  The next show is not scheduled yet. Leave your email and
                  we’ll write to you the day applications open.
                </p>
                <WaitlistForm />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── The prospectus ───────────────────────────────────────────────
          Reference, under the thing it is reference for. */}
      <div className="ap-details">
        <CollapsibleTabs
          heading="Prices, dates and rules"
          id="details"
          tabs={details}
        />
      </div>

      {/* ── The last thing an applicant sees ─────────────────────────────
          This was a single 600px photograph of one shopper. The filmstrip
          is the same gesture making a better argument: the person reading
          this page is deciding whether to spend a weekend and a booth fee
          on us, and a hundred makers going past answers that question in a
          way one shopper cannot. Rotated per visit, like the homepage. */}
      <PhotoStrip
        id="section-apply-strip"
        frames={rotated(stripFrames, Math.floor(Math.random() * stripFrames.length))}
      />
    </SiteShell>
  )
}
