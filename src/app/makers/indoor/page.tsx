import Link from 'next/link'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow, activeAddOns } from '@/db/queries'
import { spaceTypes } from '@/db/schema'
import { SiteShell } from '@/components/theme/SiteShell'
import {
  PageTitle, RichText, FactTable, PriceTable, CollapsibleTabs, type Tab,
} from '@/components/theme/Sections'
import { indoorSections, fill } from '@/lib/page-html'
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
 *
 * September 2026. The page used to run the whole rules block as one column:
 * about eight thousand pixels of body copy covering what inside selling is,
 * the schedule, display, inventory, labelling, treats, jewelry, junior
 * makers, advertising and liability, with an FAQ at the end. Nobody read it
 * and nobody could find anything in it. It is now the four shapes of
 * docs/08-DESIGN-SYSTEM.md §8, in the order a maker meets them:
 *
 *   1. The fact table. The deal in six rows.
 *   2. The price table. What each space costs, add-ons in the same table.
 *   3. The rules that carry money, as a list you can read in ten seconds.
 *   4. Their prose, whole, in ten named sections you open one at a time.
 *
 * Every word of the prose survives. Only the bare list of space sizes went,
 * because the price table above it now carries the same list with prices.
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

  const vars = {
    indoorCapacity: show.indoorCapacity,
    outdoorCapacity: show.outdoorCapacity,
    loadIn: show.loadInNote || 'announced with your acceptance',
    takedown: show.takedownNote || 'announced with your acceptance',
    day1: days[0] ?? '',
    day2: days[1] ?? '',
    day3: days[2] ?? '',
  }

  /* Their sections, in their order, with the first one open. `id` makes each
     one a link target: /makers/indoor#labels goes to the labelling rules. */
  const tabs: Tab[] = indoorSections.map((s, i) => ({
    id: s.id,
    q: s.q,
    open: i === 0,
    a: (
      <div className="rte--long" dangerouslySetInnerHTML={{ __html: fill(s.html, vars) }} />
    ),
  }))

  /* The four figures in this list are penalties their prose publishes: $100
     for turning up late, $100 for bad labels, $20 for jewelry with no bag.
     They are not Show-record fields yet, which they should be before a second
     show uses different numbers (docs/06-OPEN-QUESTIONS.md). Until then they
     read out of money.ts like every other figure on the site, in cents. */
  const LATE_FEE_CENTS = 10_000
  const LABEL_FEE_CENTS = 10_000
  const JEWELRY_BAG_FEE_CENTS = 2_000

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

          {/* Their rules, in their words, one section at a time. The list on
              top is the subset that costs money if you miss it; each line is
              explained in full in the section it came from. */}
          <div className="mk-sections">
          <CollapsibleTabs
            heading="Inside maker information"
            id="rules"
            deepLink
            intro={
              <div className="mk-rules">
                <h3 className="mk-rules__title">Rules that cost money</h3>
                <ul className="mk-rules__list">
                  <li>
                    Arrive after 6pm on set-up night and it is {usd(LATE_FEE_CENTS)}.
                    After 7pm you are not in the show.
                  </li>
                  <li>
                    There is one set-up window and no Friday morning. If you cannot
                    be there, you cannot sell inside.
                  </li>
                  <li>Your inventory list and prices are due two weeks before the show.</li>
                  <li>
                    Every product carries your MM code and its price. Labelled
                    wrong, or not at all, is {usd(LABEL_FEE_CENTS)} off your final payment.
                  </li>
                  <li>Prices cannot change on your labels without our approval first.</li>
                  <li>
                    Jewelry needs bags or boxes left at your space. Without them
                    it is {usd(JEWELRY_BAG_FEE_CENTS)} off your final sales.
                  </li>
                  <li>Your shop name goes somewhere in your space.</li>
                </ul>
                <p className="mk-rules__note">
                  Each one is explained in full below. The binding version is the{' '}
                  <Link href="/agreement">vendor agreement</Link>, with the site{' '}
                  <Link href="/terms">terms</Link> alongside it.
                </p>
              </div>
            }
            tabs={tabs}
          />
          </div>

          {/* The rules pages had no link to the application anywhere in two
              thousand words. A maker who reads to the bottom now has one. */}
          <RichText cta={{ href: '/apply', label: 'Apply to sell' }}>
            <p>
              One application covers both tracks, and there is no fee to apply.
              Selling outside is a different deal:{' '}
              <Link href="/makers/outdoor">read that one too</Link>.
            </p>
          </RichText>
        </SiteShell>
  )
}
