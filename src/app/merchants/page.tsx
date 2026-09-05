import { eq, and, asc } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { bookings, vendors, applications, spaceTypes } from '@/db/schema'
import { Masthead, Footer } from '@/components/site'
import { fmtDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Merchants',
  description: 'The makers selling at the next Mermade Market in Dana Point.',
}

/**
 * The merchants page, grouped the way the live one is: the inside makers who
 * are there all three days, then the outside tents day by day.
 *
 * The difference is that the list is GENERATED from confirmed bookings, never
 * hand-kept, so it fills in as makers pay and confirm and it cannot go stale.
 * Before the roster is announced it says so rather than showing last season's
 * lineup, which is the one thing a hand-kept page could not do. The outdoor
 * groups come from the booked space's label, so a day only appears once
 * someone is selling on it.
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
      sortOrder: spaceTypes.sortOrder,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(applications, eq(bookings.applicationId, applications.id))
    .innerJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
    .where(and(eq(bookings.showId, show.id), eq(bookings.status, 'confirmed')))
    .orderBy(asc(spaceTypes.sortOrder), asc(vendors.shopName))

  type Row = (typeof roster)[number]
  // Inside is one group, all three days. Outside is one group per space,
  // which is one per day, in the order the spaces are listed on /apply.
  const groups: Array<{ heading: string; note: string; rows: Row[] }> = []
  const inside = roster.filter((m) => m.track === 'indoor')
  if (inside.length > 0) {
    groups.push({
      heading: 'Inside, all three days',
      note: 'They don’t change, and we restock for them.',
      rows: inside,
    })
  }
  for (const m of roster.filter((r) => r.track === 'outdoor')) {
    const g = groups.find((x) => x.heading === m.space)
    if (g) g.rows.push(m)
    else groups.push({ heading: m.space, note: 'Outside', rows: [m] })
  }

  const linkFor = (m: (typeof roster)[number]) => {
    const w = m.website?.trim()
    if (w) return w.startsWith('http') ? w : `https://${w}`
    const ig = m.instagram?.trim()
    return ig ? `https://instagram.com/${ig.replace(/^@/, '')}` : null
  }

  return (
    <>
      <Masthead show={show} />

      <section className="claim">
        <div className="k">{show.name}</div>
        <h1 className="lede">The<br /><em>merchants.</em></h1>
        <p>
          Indoor makers are in the room all three days. The outdoor tents change
          daily, which is why people come back.
        </p>
      </section>

      {roster.length === 0 ? (
        <section className="mission">
          <h2>Announced <em>{fmtDate(show.rosterAnnouncedOn, { year: undefined })}</em></h2>
          <p>
            The {show.name} lineup goes up here the day the roster is set. Join the list
            and we&rsquo;ll write the morning it does.
          </p>
          <div style={{ marginTop: 26 }}>
            <Link href="/apply" className="btn">Apply now</Link>
          </div>
        </section>
      ) : (
        <>
          <section className="sec" style={{ paddingBottom: 0 }}>
            <div className="shead">
              <span className="k">{roster.length} confirmed</span>
              <h2>Selling this show</h2>
            </div>
            <p className="rules">
              Just below are the makers that are inside with us at Mermade, all
              3 days. Keep scrolling and you will find the makers showcasing
              outside, and a lot of them change each day. More reason to shop
              all 3 days with us!
            </p>
          </section>
          {groups.map((g) => (
            <section className="sec" style={{ paddingTop: 'clamp(34px,4vw,52px)' }} key={g.heading}>
              <div className="shead">
                <span className="k">{g.note}</span>
                <h2>{g.heading}</h2>
              </div>
              <div className="dir">
                {g.rows.map((m) => {
                  const href = linkFor(m)
                  return href
                    ? <a key={m.shopName} href={href} target="_blank" rel="noreferrer">{m.shopName}</a>
                    : <span key={m.shopName}>{m.shopName}</span>
                })}
              </div>
            </section>
          ))}
        </>
      )}

      <Footer show={show} />
    </>
  )
}
