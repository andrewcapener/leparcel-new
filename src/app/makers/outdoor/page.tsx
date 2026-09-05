import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow, activeAddOns } from '@/db/queries'
import { spaceTypes } from '@/db/schema'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle, RichText, FactTable, PriceTable } from '@/components/theme/Sections'
import { outdoorMerchants, fill } from '@/lib/page-html'
import { usd } from '@/lib/money'
import { fmtDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Outdoor Merchants' }

/**
 * /pages/outdoor-merchants — their page title and their rules, unedited, plus
 * a price column their live page does not have.
 *
 * The prose is their own rich-text block (src/lib/page-html.ts). The dates,
 * the capacity and the prices in it are tokens filled from the Show record
 * and from space_types, because the live page has last season's typed into
 * the sentence and goes stale the moment a date moves.
 */
export default async function OutdoorMerchants() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const spaces = await db.query.spaceTypes.findMany({
    where: eq(spaceTypes.showId, show.id),
    orderBy: [asc(spaceTypes.sortOrder)],
  })
  const extras = await activeAddOns(show.id)
  const outdoor = spaces.filter((s) => s.track === 'outdoor')
  const days = show.hoursNote.split(' · ')

  const html = fill(outdoorMerchants, {
    indoorCapacity: show.indoorCapacity,
    outdoorCapacity: show.outdoorCapacity,
    loadIn: show.loadInNote || 'announced with your acceptance',
    takedown: show.takedownNote || 'announced with your acceptance',
    day1: days[0] ?? '',
    day2: days[1] ?? '',
    day3: days[2] ?? '',
  })

  return (
    <SiteShell show={show} template="page template-suffix-outdoor-merchants">
          <PageTitle title="Outdoor Merchants" />

          <FactTable
            title="The deal, in short"
            rows={[
              { label: 'How it works', value: 'We set the tent up for you. You sell in person and run your own payments.' },
              { label: 'Our commission', value: <><strong>None.</strong> You keep 100% of what you sell.</> },
              { label: 'Booth fee', value: outdoor.length > 0
                ? `${usd(Math.min(...outdoor.map((x) => x.priceCents)))} to ${usd(Math.max(...outdoor.map((x) => x.priceCents)))} a day`
                : 'See the table below' },
              { label: 'The tent', value: '6.5ft square and 7.5ft tall, provided. A few 10 × 10s exist and you can ask for one.' },
              { label: 'Set-up', value: '7am on your day. The market opens at 9am.' },
              { label: 'Choosing days', value: 'Pick more than one and your odds go up. It tells us you are flexible.' },
              { label: 'Applications close', value: fmtDate(show.applicationsCloseAt) },
            ]}
            cta={{ href: '/apply', label: 'Apply to sell' }}
          />

          <RichText large={false}>
            <PriceTable
              caption="Outdoor days"
              spaces={outdoor}
              extras={extras.filter((a) => a.track === null || a.track === 'outdoor')}
            />
          </RichText>

          <RichText large={false}>
            <div className="rte--long" dangerouslySetInnerHTML={{ __html: html }} />
          </RichText>

          <RichText cta={{ href: '/apply', label: 'Apply to sell' }}>
            <p>
              One application covers both tracks, and there is no fee to apply.
            </p>
          </RichText>
        </SiteShell>
  )
}
