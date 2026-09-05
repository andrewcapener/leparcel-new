import Link from 'next/link'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow, activeAddOns } from '@/db/queries'
import { spaceTypes } from '@/db/schema'
import { SiteShell } from '@/components/theme/SiteShell'
import { CollapsibleTabs, Banner, PriceTable, type Tab } from '@/components/theme/Sections'
import { ApplyForm } from './ApplyForm'
import { photoUploadsEnabled } from '@/server/modules/uploads/config'
import { applyFaq, fill } from '@/lib/page-html'
import { applicationWindow, fmtDate, fmtRange } from '@/lib/dates'
import { SignupForm } from '@/components/theme/SignupForm'
import { bpsLabel, usd } from '@/lib/money'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Merchant Application' }

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
  // ?preview=1 shows the form outside the application window — view only.
  // Submission is still enforced server-side in actions.ts, which rejects
  // anything outside the window regardless of how the form was reached.
  const preview = (await searchParams).preview === '1'
  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  const spaces = await db.query.spaceTypes.findMany({
    where: eq(spaceTypes.showId, show.id),
    orderBy: [asc(spaceTypes.sortOrder)],
  })
  const extras = await activeAddOns(show.id)
  const indoor = spaces.filter((s) => s.track === 'indoor')
  const outdoor = spaces.filter((s) => s.track === 'outdoor')
  const forTrack = (t: 'indoor' | 'outdoor') =>
    extras.filter((a) => a.track === null || a.track === t)
  const win = applicationWindow(show.applicationsOpenAt, show.applicationsCloseAt)
  const days = show.hoursNote.split(' · ')

  const openMs = new Date(show.applicationsOpenAt).getTime()
  const closeMs = new Date(show.applicationsCloseAt).getTime()
  const windowDays = Math.max(1, Math.round((closeMs - openMs) / 86_400_000))

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
     without opening anything, and the detail inside. The price summaries
     carry the figure, so a maker who only wants the number never opens the
     table. */
  const details: Tab[] = [
    {
      q: `Inside spaces${indoorRange ? `: ${indoorRange}, ${bpsLabel(show.commissionBps)} commission` : ''}`,
      a: (
        <>
          <PriceTable caption="Indoor spaces" spaces={indoor} extras={forTrack('indoor')} />
          <p>
            Inside is consignment. We merchandise your work, sell it at one
            register, and pay out after the show. You are not at the show.
          </p>
        </>
      ),
    },
    {
      q: `Outside days${outdoorRange ? `: ${outdoorRange}, no commission` : ''}`,
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
      label: win === 'before' ? 'Applications open' : 'Applications close',
      value: win === 'before'
        ? fmtDate(show.applicationsOpenAt, { year: undefined })
        : `${fmtDate(show.applicationsCloseAt, { year: undefined })}, 11:59pm PT`,
    },
    { label: 'Line-up announced', value: fmtDate(show.rosterAnnouncedOn, { year: undefined }) },
    ...(indoorRange
      ? [{ label: 'Inside spaces', value: `${indoorRange} plus ${bpsLabel(show.commissionBps)}` }]
      : []),
    ...(outdoorRange
      ? [{ label: 'Outside days', value: `${outdoorRange}, no commission` }]
      : []),
  ]

  return (
    <SiteShell show={show} template="page template-suffix-merchant-application">
      {/* ── The head ─────────────────────────────────────────────────────
          Short on purpose. On a 390px screen the form's first step is one
          swipe from here. */}
      <div className="shopify-section section-rich-text">
        <div className="container container--reading-width">
          <header className="ap-head">
            <p className="ap-head__eyebrow">
              {show.name} · {fmtRange(show.startsOn, show.endsOn)} · {show.venueName}
            </p>
            <h1 className="majortitle in-content h1 ap-head__title">Merchant Application</h1>
            <p className="ap-head__lede">
              One form covers both tracks. Inside is consignment at one
              register. Outside is a tent we set up for you, for the day, and
              you keep everything you sell. No fee to apply, and we answer
              either way.
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
              {(win === 'open' || preview) && (
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
          <div id="apply" className="ap-anchor" />
          <div className="container">
            {win === 'open' || preview ? (
              <>
                {win !== 'open' && (
                  <p className="ap-preview" role="status">
                    Preview. Applications are not open, and submissions are
                    disabled until {fmtDate(show.applicationsOpenAt)}.
                  </p>
                )}
                <ApplyForm
                  show={show} spaces={spaces} extras={extras}
                  uploads={photoUploadsEnabled()}
                />
              </>
            ) : (
              /* Outside the window this is the whole page's ask, so the
                 invitation needs the field that answers it. */
              <div className="reading-width account-form rte align-center ap-closed">
                <h2>
                  {win === 'before'
                    ? `Applications open ${fmtDate(show.applicationsOpenAt)}.`
                    : `Applications for ${show.name} closed ${fmtDate(show.applicationsCloseAt)}.`}
                </h2>
                <p>
                  {win === 'before'
                    ? 'Join the list and we’ll email you the morning they open.'
                    : 'Join the list and we’ll email you the morning the next window opens.'}
                </p>
                <div className="apply-signup">
                  <SignupForm />
                </div>
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

      <Banner
        id="section-apply-band"
        image="IMG_3335.jpg"
        title=""
        heightMobile={460}
        heightDesktop={600}
      />
    </SiteShell>
  )
}
