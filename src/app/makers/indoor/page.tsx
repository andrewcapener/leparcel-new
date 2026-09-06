import Link from 'next/link'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow, activeAddOns, activeSpaceTypes } from '@/db/queries'
import { spaceTypes } from '@/db/schema'
import { SiteShell } from '@/components/theme/SiteShell'
import {
  PageTitle, RichText, FactTable, PriceTable, CollapsibleTabs, Banner, type Tab,
} from '@/components/theme/Sections'
import { indoorSections, fill } from '@/lib/page-html'
import { dayBefore, fmtDayMonth, fmtWeekday, fmtWeekdayDate } from '@/lib/dates'
import { usd } from '@/lib/money'
import { POLICY } from '@/lib/agreement'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Indoor Makers',
  description:
    'Selling inside at Mermade Market: we merchandise your goods, sell them at a central register and pay you after the show. Space sizes, prices and the rules.',
  alternates: { canonical: '/makers/indoor' },
}

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

  const spaces = await activeSpaceTypes(show.id)
  const extras = await activeAddOns(show.id)
  const indoor = spaces.filter((s) => s.track === 'indoor')
  const days = show.hoursNote.split(' · ')

  const vars = {
    indoorCapacity: show.indoorCapacity,
    outdoorCapacity: show.outdoorCapacity,
    // One source for the payout window, so the fact table, this prose and
    // the signed agreement cannot say three different things.
    // Load-in day on its own, for copy that names the day rather than the
    // window (CLAUDE.md rule 6: never a typed date).
    loadInDay: fmtWeekdayDate(dayBefore(show.startsOn)),
    payoutMin: POLICY.payoutDaysMin,
    payoutMax: POLICY.payoutDays,
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
  /* The label and jewelry-bag fees came off this summary on 5 Sep 2026: it is
     a short list of what a maker must do before the show, and those two are
     things that happen at it. Both are still in the maker agreement, which is
     the binding version, and both are still explained in the sections below. */

  return (
    <SiteShell show={show} template="page template-suffix-indoor-merchants">
          <PageTitle title="Indoor Makers" />

          {/* The six facts a maker needs before two thousand words of rules.
              An audit timed the top questions against this page and found the
              commission rate — the single most consequential number on the
              indoor track — appeared nowhere on it. */}
          <FactTable
            title="The deal, in short"
            rows={[
              /* Elise's wording, 5 Sep 2026, with the numbers still coming off
                 the Show record and POLICY so nothing here can drift from what
                 a maker signs. */
              { label: 'How it works', value: 'Let us sell your items for you. You set up your mini shop space with each item tagged, and we keep it clean and restocked for you.' },
              { label: 'Our commission', value: <>We keep <strong>{show.commissionBps / 100}%</strong> of sales, and you keep the rest.</> },
              /* The range came off the page at Elise's request: the sizes and
                 their prices are on the application, where a maker is choosing
                 one rather than being met with a spread. */
              { label: 'Booth fee', value: <>Varies by space size. <Link href="/apply">See the application</Link> for details.</> },
              { label: 'Load-in', value: show.loadInNote || 'Announced with your acceptance' },
              { label: 'Take-down', value: show.takedownNote || 'Announced with your acceptance' },
              { label: 'Getting paid', value: `${POLICY.payoutDaysMin} to ${POLICY.payoutDays} days after the show, with a follow-up email showing your space's report under your Mermade ID.` },
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
                {/* This list used to open "Rules that cost money" and read
                    like a schedule of fines: what we would take, item by item.
                    The deadlines are real and the amounts have not moved, but
                    the reason for each one is what a maker actually needs, and
                    a room of a hundred shops selling through one register is a
                    reason that holds up. docs/12-VOICE.md: warm through
                    specifics, and the specifics here are the times. */}
                <h3 className="mk-rules__title">The deadlines that matter</h3>
                <ul className="mk-rules__list">
                  <li>
                    Indoor set-up runs {fmtWeekdayDate(dayBefore(show.startsOn))} until 7pm.
                    If you show up after 6:00pm, even at 6:01pm, we charge you{' '}
                    {usd(LATE_FEE_CENTS)} because we will be delayed.
                  </li>
                  <li>
                    There is no {fmtWeekday(show.startsOn)} morning{' '}
                    ({fmtDayMonth(show.startsOn)}) set-up for indoor makers. If that prior
                    day does not work with your schedule, and you cannot find help to
                    replace you, outside may be your better option.
                  </li>
                  <li>
                    Your inventory list and prices must be given to us two weeks before
                    the show. We remind you plenty about this and give great instruction
                    on how to succeed in this.
                  </li>
                </ul>
                <p className="mk-rules__note">
                  Each one is explained in full below. The binding version is the{' '}
                  <Link href="/agreement">maker agreement</Link>, with the site{' '}
                  <Link href="/terms">terms</Link> alongside it.
                </p>
              </div>
            }
            tabs={tabs}
          />
          </div>

          {/* Two thousand words of rules and, until now, no picture of the
              thing they describe. An indoor space is a few feet of shelving
              against a white wall, and a maker who has read this far has
              earned a look at one that works. */}
          <Banner
            id="section-indoor-plate"
            image="/photos/ceramics.jpg"
            title=""
            heightMobile={420}
            heightDesktop={560}
            shadow={false}
          />

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
