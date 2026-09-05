import Link from 'next/link'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { bookings, vendors, applications, spaceTypes } from '@/db/schema'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle, LogoGrid, RichText } from '@/components/theme/Sections'
import { fmtDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Merchants' }

/**
 * /pages/spring-2026-merchants — their page title, their intro subheading,
 * then a logo grid per group: the inside makers who are there all three days,
 * then the outside tents day by day.
 *
 * Theirs is typed in by hand every season. This one is GENERATED from
 * confirmed bookings, so it fills in as makers pay and cannot go stale, and
 * before the roster is announced it says so rather than showing last
 * season's lineup.
 */
export default async function Merchants() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const roster = await db
    .select({
      shopName: vendors.shopName,
      instagram: vendors.instagram,
      website: vendors.website,
      track: spaceTypes.track,
      space: spaceTypes.label,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(applications, eq(bookings.applicationId, applications.id))
    .innerJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
    .where(and(eq(bookings.showId, show.id), eq(bookings.status, 'confirmed')))
    .orderBy(asc(spaceTypes.sortOrder), asc(vendors.shopName))

  type Row = (typeof roster)[number]
  const linkFor = (m: Row) => {
    const w = m.website?.trim()
    if (w) return w.startsWith('http') ? w : `https://${w}`
    const ig = m.instagram?.trim()
    return ig ? `https://instagram.com/${ig.replace(/^@/, '')}` : null
  }

  // Inside is one group, all three days. Outside is one group per space,
  // which is one per day, in the order the spaces are listed on /apply.
  // `headed: false` is the inside group, whose heading the intro paragraph
  // above the grid already gives — which is how their page reads. Every
  // outdoor day carries its own. Keying off the group rather than its index
  // means a show with outdoor bookings and no indoor ones still labels its
  // first day.
  const groups: Array<{ heading: string; rows: Row[]; headed: boolean }> = []
  const inside = roster.filter((m) => m.track === 'indoor')
  if (inside.length > 0) groups.push({ heading: 'Inside, all 3 days', rows: inside, headed: false })
  for (const m of roster.filter((r) => r.track === 'outdoor')) {
    const g = groups.find((x) => x.heading === m.space)
    if (g) g.rows.push(m)
    else groups.push({ heading: m.space, rows: [m], headed: true })
  }

  return (
    <SiteShell show={show} template="page template-suffix-merchants">
          <PageTitle title={`${show.name} Merchants`} />

          {roster.length === 0 ? (
            <RichText
              title={`Announced ${fmtDate(show.rosterAnnouncedOn, { year: undefined })}`}
              cta={{ href: '/apply', label: 'Apply now' }}
            >
              <p>
                The {show.name} lineup goes up here the day the roster is set.
                Join the list and we&#39;ll write the morning it does.
              </p>
            </RichText>
          ) : (
            <>
              {/* Their page sets this as a tracked uppercase eyebrow: 267
                  characters of body copy in a label setting, seven lines on a
                  phone. Tracked uppercase is for labels. */}
              <RichText large={false}>
                <p>
                  Just below are the makers that are inside with us at Mermade,
                  all 3 days. They don&#39;t change, we restock for them. Keep
                  scrolling and you will find the makers showcasing outside, and
                  a lot of them change each day. More reason to shop all 3 days
                  with us.
                </p>
              </RichText>

              {groups.map((g) => (
                <div className="merchant-group" key={g.heading}>
                  {/* Above its own group, not below the one before it. */}
                  {g.headed && (
                    <div className="container">
                      <h2 className="merchant-group__heading subheading">{g.heading}</h2>
                    </div>
                  )}
                  <LogoGrid
                    id={`section-merchants-${g.heading.replace(/\W+/g, '-').toLowerCase()}`}
                    cards={g.rows.map((m) => ({ name: m.shopName, href: linkFor(m) }))}
                  />
                </div>
              ))}
            </>
          )}
        </SiteShell>
  )
}
