import Link from 'next/link'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow, activeAddOns, activeSpaceTypes } from '@/db/queries'
import { spaceTypes } from '@/db/schema'
import { SiteShell } from '@/components/theme/SiteShell'
import {
  PageTitle, RichText, FactTable, PriceTable, CollapsibleTabs, Banner, type Tab,
} from '@/components/theme/Sections'
import { outdoorSections, fill } from '@/lib/page-html'
import { POLICY } from '@/lib/agreement'
import { usd } from '@/lib/money'
import { fmtDate } from '@/lib/dates'
import { bookends, splitDay } from '@/lib/schedule'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Outdoor Makers',
  description:
    'Selling outside at Mermade Market: a 10ft tent we set up, you run your own payments and keep everything you take. Day rates, add-ons and the rules.',
  alternates: { canonical: '/makers/outdoor' },
}

/**
 * /pages/outdoor-merchants — their page title and their rules, unedited, plus
 * a price column their live page does not have.
 *
 * The prose is their own rich-text block (src/lib/page-html.ts). The dates,
 * the capacity and the prices in it are tokens filled from the Show record
 * and from space_types, because the live page has last season's typed into
 * the sentence and goes stale the moment a date moves.
 *
 * September 2026. Same rebuild as /makers/indoor: the rules ran as one
 * column of about eight thousand pixels, so they are now the fact table, the
 * price table, the rules that carry money, and eleven named sections a maker
 * opens one at a time (docs/08-DESIGN-SYSTEM.md §8). Every word survives.
 */
export default async function OutdoorMerchants() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const spaces = await activeSpaceTypes(show.id)
  const extras = await activeAddOns(show.id)
  const outdoor = spaces.filter((s) => s.track === 'outdoor')
  const days = show.hoursNote.split(' · ')

  /* The outdoor day rows name the day and let their own sentence give the
     hours, because the two do not agree: `hoursNote` has the building open
     Friday 5-9pm and their outdoor copy has the tents trading 9am to 6pm.
     Printing both in one row asserts a contradiction, so the row header is
     the date off the Show record and the hours stay in their sentence. The
     mismatch itself is theirs to settle at /admin/show. */
  const dayName = (d: string) => d.replace(/,\s*[^,]*$/, '').trim()

  /* When the market opens, taken off the hours rather than typed beside the
     set-up time. Only printed when every day opens together: three days that
     start at different times cannot be summed up in one sentence, and a
     sentence that picks the first day would be wrong for the other two. */
  const opens = days.map((d) => bookends(splitDay(d).hours).opens).filter(Boolean)
  const sameOpen = opens.length > 0 && opens.every((o) => o === opens[0])
  /* Outside sets up the morning of the day they booked. This used to be a
     sentence typed into the page, which meant it could not be edited at
     /admin/show and could not follow the venue (CLAUDE.md rule 6). */
  const outdoorLoadIn = show.outdoorLoadInNote || 'the morning of your day'

  const vars = {
    indoorCapacity: show.indoorCapacity,
    outdoorCapacity: show.outdoorCapacity,
    // One source for the payout window, so the fact table, this prose and
    // the signed agreement cannot say three different things.
    payoutMin: POLICY.payoutDaysMin,
    payoutMax: POLICY.payoutDays,
    // The outdoor note, not the indoor one. Inside loads in the evening
    // before the doors open; outside is not there that day.
    loadIn: outdoorLoadIn,
    takedown: show.takedownNote || 'announced with your acceptance',
    day1: days[0] ?? '',
    day2: days[1] ?? '',
    day3: days[2] ?? '',
    day1Date: dayName(days[0] ?? ''),
    day2Date: dayName(days[1] ?? ''),
    day3Date: dayName(days[2] ?? ''),
  }

  /* Their sections, in their order, with the first one open. `id` makes each
     one a link target: /makers/outdoor#refunds goes to the refund rules. */
  const tabs: Tab[] = outdoorSections.map((s, i) => ({
    id: s.id,
    q: s.q,
    open: i === 0,
    a: (
      <div className="rte--long" dangerouslySetInnerHTML={{ __html: fill(s.html, vars) }} />
    ),
  }))

  return (
    <SiteShell show={show} template="page template-suffix-outdoor-merchants">
          <PageTitle title="Outdoor Makers" />

          <FactTable
            title="The deal, in short"
            rows={[
              { label: 'How it works', value: 'We set the tent up for you. You sell in person and run your own payments.' },
              { label: 'Our commission', value: <><strong>None.</strong> You keep 100% of what you sell.</> },
              { label: 'Booth fee', value: outdoor.length > 0
                ? `${usd(Math.min(...outdoor.map((x) => x.priceCents)))} to ${usd(Math.max(...outdoor.map((x) => x.priceCents)))} a day`
                : 'See the table below' },
              { label: 'The tent', value: '6.5ft square and 7.5ft tall, provided. A few 10 × 10s exist and you can ask for one.' },
              { label: 'Set-up', value: sameOpen
                ? `${outdoorLoadIn}. The market opens at ${opens[0]}.`
                : `${outdoorLoadIn}, before the market opens.` },
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

          {/* Their rules, in their words, one section at a time. The list on
              top is the subset that costs money or a future show if you miss
              it; each line is explained in full in its own section. */}
          <div className="mk-sections">
          <CollapsibleTabs
            heading="Outside maker information"
            id="rules"
            deepLink
            intro={
              <div className="mk-rules">
                <h3 className="mk-rules__title">Rules that cost money</h3>
                <ul className="mk-rules__list">
                  <li>Booth fees are nonrefundable, cancellations included.</li>
                  <li>Weights at the bottom of the tent legs. Not optional.</li>
                  <li>A backdrop hung in your tent is mandatory.</li>
                  <li>Your shop name has to be up, and no vinyl signs.</li>
                  <li>Nothing across the front of your tent. That space is for shoppers.</li>
                  <li>
                    Never sell an <Link href="/makers/indoor">inside maker</Link>&rsquo;s
                    work at your tent. It costs you the next show.
                  </li>
                  <li>
                    If we cancel a day for weather, your fee becomes a credit towards an
                    outdoor day at any show in the next 18 months. If we run it and you
                    stay home, nothing carries over.
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

          {/* The outdoor half in one frame: a table under a tent on the lot,
              which is what the six and a half feet described above actually
              buys. */}
          <Banner
            id="section-outdoor-plate"
            image="/photos/jewelry.jpg"
            title=""
            heightMobile={420}
            heightDesktop={560}
            shadow={false}
          />

          <RichText cta={{ href: '/apply', label: 'Apply to sell' }}>
            <p>
              One application covers both tracks, and there is no fee to apply.
              Selling inside is a different deal:{' '}
              <Link href="/makers/indoor">read that one too</Link>.
            </p>
          </RichText>
        </SiteShell>
  )
}
