import { eq, and, asc } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { bookings, vendors, applications } from '@/db/schema'
import { Masthead, Footer } from '@/components/site'
import { fmtDate } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Merchants',
  description: 'The makers selling at the next Mermade Market in Dana Point.',
}

/**
 * The merchants page the header links to.
 *
 * The list is GENERATED from confirmed bookings, never hand-kept, so it
 * fills in as makers pay and confirm and it cannot go stale. Before the
 * roster is announced it says so rather than showing last season's lineup,
 * which is the one thing a hand-kept page could not do.
 */
export default async function Merchants() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const roster = await db
    .select({
      shopName: vendors.shopName,
      instagram: vendors.instagram,
      website: vendors.website,
      track: applications.track,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(applications, eq(bookings.applicationId, applications.id))
    .where(and(eq(bookings.showId, show.id), eq(bookings.status, 'confirmed')))
    .orderBy(asc(vendors.shopName))

  const linkFor = (m: (typeof roster)[number]) => {
    const w = m.website?.trim()
    if (w) return w.startsWith('http') ? w : `https://${w}`
    const ig = m.instagram?.trim()
    return ig ? `https://instagram.com/${ig.replace(/^@/, '')}` : null
  }

  return (
    <>
      <Masthead show={show} />

      <section className="claim" style={{ paddingBottom: 56 }}>
        <div className="k">{show.name}</div>
        <h1 className="lede" style={{ maxWidth: '18ch' }}>The <em>merchants.</em></h1>
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
        <section className="sec">
          <div className="shead">
            <span className="k">{roster.length} confirmed</span>
            <h2>Selling this show</h2>
          </div>
          <div className="dir">
            {roster.map((m) => {
              const href = linkFor(m)
              return href
                ? <a key={m.shopName} href={href} target="_blank" rel="noreferrer">{m.shopName}</a>
                : <span key={m.shopName}>{m.shopName}</span>
            })}
          </div>
        </section>
      )}

      <Footer show={show} />
    </>
  )
}
