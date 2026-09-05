import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow, activeAddOns } from '@/db/queries'
import { spaceTypes } from '@/db/schema'
import { AnnouncementBar, PageHeader, PageFooter } from '@/components/theme/Chrome'
import {
  RichText, MultiColumn, CollapsibleTabs, Banner, type Tab,
} from '@/components/theme/Sections'
import { ApplyForm } from './ApplyForm'
import { applyFaq, fill } from '@/lib/page-html'
import { applicationWindow, fmtDate, fmtRange } from '@/lib/dates'
import { usd } from '@/lib/money'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Merchant Application' }

/**
 * /pages/merchant-application, section for section: the title block, the
 * three pricing columns, the application FAQ, and then the form.
 *
 * Their live page types the prices and the dates into the columns by hand and
 * embeds a third-party form builder at #apply. Here the prices come off
 * space_types and add_ons, the dates off the Show record (CLAUDE.md rule 6),
 * and #apply is our own form — which is the whole point of the rebuild.
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

  const vars = {
    showName: show.name,
    dateRange: fmtRange(show.startsOn, show.endsOn),
    venue: show.venueName,
    commission: show.commissionBps / 100,
    paymentWindow: show.paymentWindowHours,
    windowDays,
  }
  const tabs: Tab[] = applyFaq.map((t) => ({
    q: t.q,
    a: <div dangerouslySetInnerHTML={{ __html: fill(t.a, vars) }} />,
  }))

  return (
    <>
      <AnnouncementBar show={show} />
      <PageHeader />
      <main id="content" role="main">
        <div className="container cf">
          <RichText
            wide
            title="Merchant Application"
            cta={{
              href: '#apply',
              label: `Apply ${fmtDate(show.applicationsOpenAt, { year: undefined })}-${fmtDate(show.applicationsCloseAt, { year: undefined })} only`,
            }}
          >
            <p>Market Dates: {fmtRange(show.startsOn, show.endsOn)}</p>
          </RichText>

          <MultiColumn
            id="section-apply-pricing"
            columns={[
              <>
                <p><strong>Indoor Pricing </strong></p>
                <p><em>Space Size</em></p>
                {indoor.map((s) => <p key={s.id}>{s.label} {usd(s.priceCents)}</p>)}
                <p><strong>ADD ON:</strong></p>
                {forTrack('indoor').map((a) => (
                  <p key={a.id}>{a.name}: {usd(a.priceCents)}{a.isLimited ? ' (LMTD)' : ''}</p>
                ))}
                <p>*NO RENTAL TABLES*</p>
                <p>*FOOD MAKERS RETRIEVE TFF*</p>
              </>,
              <>
                <p><strong>Outdoor Pricing </strong></p>
                {outdoor.map((s) => <p key={s.id}>{s.label} {usd(s.priceCents)}</p>)}
                <p><strong>ADD ON:</strong></p>
                {forTrack('outdoor').map((a) => (
                  <p key={a.id}>{a.name}: {usd(a.priceCents)}{a.isLimited ? ' (LMTD)' : ''}</p>
                ))}
                <p>*NO RENTAL TABLES*</p>
                <p>
                  If you choose only 1 day above, that tells us you will not be
                  flexible. If you choose 2+ days to sell, you&rsquo;ll have a
                  higher chance at getting in.
                </p>
                <p>Waitlist Options on application</p>
                <p><strong>Show Guidelines</strong></p>
                <p>No Application Fee!</p>
                <p>No Entrance Fee!</p>
                <p>Free hugs + taffy!</p>
                <p>Must read all maker rules before applying. </p>
                <p><a href="/makers/indoor">Inside Maker Rules</a> + Info</p>
                <p><a href="/makers/outdoor">Outside Maker Rules</a> + Info</p>
              </>,
              <>
                <p><strong>Upcoming Dates</strong></p>
                <p>Applications Open: {fmtDate(show.applicationsOpenAt)}</p>
                <p>Applications Close: {fmtDate(show.applicationsCloseAt)} / 11:59pm PT</p>
                <p>Maker Line Up Announced: {fmtDate(show.rosterAnnouncedOn)}</p>
                {show.loadInNote && <p>Inside Maker Set Up<em>:</em> {show.loadInNote}</p>}
                {show.takedownNote && <p>Inside Maker Take Down: {show.takedownNote}</p>}
                <p><strong>Hours Show is Open:</strong></p>
                {days.map((d) => <p key={d}>{d}</p>)}
              </>,
            ]}
          />

          <CollapsibleTabs
            heading="Merchant Application FAQ"
            id="faq-merchant-application-faq"
            tabs={tabs}
          />

          <RichText title={<>Merchant Application</>}>
            <p>{show.name}. {fmtRange(show.startsOn, show.endsOn)}</p>
          </RichText>

          <div className="shopify-section section-custom-liquid">
            <div className="fully-spaced-row--medium">
              <div className="custom-html">
                <div id="apply" />
                <div className="container">
                  {win === 'open' || preview ? (
                    <>
                      {win !== 'open' && (
                        <p className="form-hint">
                          Preview. Applications are not open, and submissions are
                          disabled until {fmtDate(show.applicationsOpenAt)}.
                        </p>
                      )}
                      <ApplyForm show={show} spaces={spaces} extras={extras} />
                    </>
                  ) : (
                    <div className="reading-width account-form rte">
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
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Banner
            id="section-apply-band"
            image="IMG_3335.jpg"
            title=""
            heightMobile={460}
            heightDesktop={600}
          />
        </div>
      </main>
      <PageFooter show={show} />
    </>
  )
}
