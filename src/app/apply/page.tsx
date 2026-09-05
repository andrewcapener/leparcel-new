import Link from 'next/link'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow, activeAddOns } from '@/db/queries'
import { spaceTypes } from '@/db/schema'
import { SiteShell } from '@/components/theme/SiteShell'
import {
  RichText, CollapsibleTabs, Banner, FactTable, PriceTable, type Tab,
} from '@/components/theme/Sections'
import { ApplyForm } from './ApplyForm'
import { applyFaq, fill } from '@/lib/page-html'
import { applicationWindow, fmtDate, fmtRange } from '@/lib/dates'
import { SignupForm } from '@/components/theme/SignupForm'
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
    <SiteShell show={show} template="page template-suffix-merchant-application">
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

          {/* Three columns of identical 15px paragraphs became the shapes the
              content is: two price tables, and the dates as a ruled list with
              the figures in a column. This is the block a maker screenshots. */}
          <RichText wide large={false}>
            <PriceTable
              caption="Indoor spaces"
              spaces={indoor}
              extras={forTrack('indoor')}
            />
          </RichText>

          <RichText wide large={false}>
            <PriceTable
              caption="Outdoor days"
              spaces={outdoor}
              extras={forTrack('outdoor')}
            />
            <p>
              If you choose only 1 day above, that tells us you will not be
              flexible. If you choose 2+ days to sell, you&rsquo;ll have a
              higher chance at getting in. No rental tables, and there is a
              waitlist option on the application.
            </p>
          </RichText>

          <FactTable
            title="Dates that matter"
            rows={[
              { label: 'Applications open', value: fmtDate(show.applicationsOpenAt) },
              { label: 'Applications close', value: `${fmtDate(show.applicationsCloseAt)}, 11:59pm PT` },
              { label: 'Line-up announced', value: fmtDate(show.rosterAnnouncedOn) },
              { label: 'Booth fee due', value: `Within ${show.paymentWindowHours} hours of being accepted` },
              ...(show.loadInNote ? [{ label: 'Inside set-up', value: show.loadInNote }] : []),
              ...(show.takedownNote ? [{ label: 'Inside take-down', value: show.takedownNote }] : []),
              { label: 'Show hours', value: days.map((d) => <div key={d}>{d}</div>) },
            ]}
          />

          <RichText large={false}>
            <p><strong>Show guidelines.</strong> No application fee. No entrance
            fee for shoppers. Free hugs and taffy. Read the maker rules before
            you apply: <Link href="/makers/indoor">inside</Link> ·{' '}
            <Link href="/makers/outdoor">outside</Link>.</p>
          </RichText>

          <CollapsibleTabs
            heading="Merchant Application FAQ"
            id="faq-merchant-application-faq"
            tabs={tabs}
          />


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
                    /* Outside the window this is the whole page's ask, so
                       the invitation needs the field that answers it. It was
                       the sentence on its own, which is the state most makers
                       see in the run-up to opening day. */
                    <div className="reading-width account-form rte align-center">
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
