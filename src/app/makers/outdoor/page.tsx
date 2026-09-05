import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow, activeAddOns } from '@/db/queries'
import { spaceTypes } from '@/db/schema'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle, RichText, MultiColumn } from '@/components/theme/Sections'
import { outdoorMerchants, fill } from '@/lib/page-html'
import { usd } from '@/lib/money'

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

          <MultiColumn
            id="section-outdoor-pricing"
            columns={[
              <>
                <p><strong>Outdoor Pricing</strong></p>
                                {outdoor.map((s) => (
                  <p key={s.id}>
                    {s.label} {usd(s.priceCents)}
                    {s.description && ` (${s.description.replace(/\.$/, '')})`}
                  </p>
                ))}
              </>,
              <>
                <p><strong>ADD ON:</strong></p>
                {extras.filter((a) => a.track === null || a.track === 'outdoor').map((a) => (
                  <p key={a.id}>
                    {a.name}: {usd(a.priceCents)}{a.isLimited ? ' (LMTD)' : ''}
                  </p>
                ))}
                <p>*NO RENTAL TABLES*</p>
              </>,
            ]}
          />

          <RichText large={false}>
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </RichText>
        </SiteShell>
  )
}
