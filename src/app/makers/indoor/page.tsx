import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow, activeAddOns } from '@/db/queries'
import { spaceTypes } from '@/db/schema'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle, RichText, FactTable, PriceTable } from '@/components/theme/Sections'
import { indoorMerchants, fill } from '@/lib/page-html'
import { usd } from '@/lib/money'
import { fmtDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Indoor Merchants' }

/**
 * /pages/indoor-merchants — their page title and their rules, unedited, plus
 * a price column their live page does not have.
 *
 * The prose is their own rich-text block (src/lib/page-html.ts). The dates,
 * the capacity and the prices in it are tokens filled from the Show record
 * and from space_types, because the live page has last season's typed into
 * the sentence and goes stale the moment a date moves.
 */
export default async function IndoorMerchants() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const spaces = await db.query.spaceTypes.findMany({
    where: eq(spaceTypes.showId, show.id),
    orderBy: [asc(spaceTypes.sortOrder)],
  })
  const extras = await activeAddOns(show.id)
  const indoor = spaces.filter((s) => s.track === 'indoor')
  const days = show.hoursNote.split(' · ')

  const html = fill(indoorMerchants, {
    indoorCapacity: show.indoorCapacity,
    outdoorCapacity: show.outdoorCapacity,
    loadIn: show.loadInNote || 'announced with your acceptance',
    takedown: show.takedownNote || 'announced with your acceptance',
    day1: days[0] ?? '',
    day2: days[1] ?? '',
    day3: days[2] ?? '',
  })

  return (
    <SiteShell show={show} template="page template-suffix-indoor-merchants">
          <PageTitle title="Indoor Merchants" />

          {/* The six facts a maker needs before two thousand words of rules.
              An audit timed the top questions against this page and found the
              commission rate — the single most consequential number on the
              indoor track — appeared nowhere on it. */}
          <FactTable
            title="The deal, in short"
            rows={[
              { label: 'How it works', value: 'You build your space on load-in day and go home. Our staff run the floor and the registers.' },
              { label: 'Our commission', value: <><strong>{show.commissionBps / 100}%</strong> of what sells. You keep the rest.</> },
              { label: 'Booth fee', value: indoor.length > 0
                ? `${usd(Math.min(...indoor.map((x) => x.priceCents)))} to ${usd(Math.max(...indoor.map((x) => x.priceCents)))}, by space size`
                : 'See the table below' },
              { label: 'Load-in', value: show.loadInNote || 'Announced with your acceptance' },
              { label: 'Take-down', value: show.takedownNote || 'Announced with your acceptance' },
              { label: 'Getting paid', value: 'Within a week of the last day, with a statement showing every sale under your code.' },
              { label: 'Applications close', value: fmtDate(show.applicationsCloseAt) },
            ]}
            cta={{ href: '/apply', label: 'Apply to sell' }}
          />

          <RichText large={false}>
            <PriceTable
              caption="Indoor spaces"
              spaces={indoor}
              extras={extras.filter((a) => a.track === null || a.track === 'indoor')}
            />
          </RichText>

          <RichText large={false}>
            <div className="rte--long" dangerouslySetInnerHTML={{ __html: html }} />
          </RichText>

          {/* The rules pages had no link to the application anywhere in two
              thousand words. A maker who reads to the bottom now has one. */}
          <RichText cta={{ href: '/apply', label: 'Apply to sell' }}>
            <p>
              One application covers both tracks, and there is no fee to apply.
            </p>
          </RichText>
        </SiteShell>
  )
}
