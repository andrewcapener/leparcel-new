import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { shows } from '@/db/schema'
import { Masthead, Footer } from '@/components/site'
import { fmtRange } from '@/lib/dates'

export const dynamic = 'force-dynamic'

/**
 * Ported from the old site's schedule page. Hours come off the Show record;
 * the day-by-day lineup (music, food) is announced the week of the show, as
 * it always has been, so this page promises only what is set.
 */
export default async function Schedule() {
  const show = await db.query.shows.findFirst({ where: eq(shows.isActive, true) })
  if (!show) throw new Error('No active show.')

  const days = show.hoursNote.split(' · ')

  return (
    <>
      <Masthead show={show} />
      <section className="claim" style={{ paddingBottom: 64 }}>
        <div className="k">{show.name} · {fmtRange(show.startsOn, show.endsOn)}</div>
        <p className="lede" style={{ maxWidth: '22ch' }}>Three days at the <em>Community House.</em></p>
      </section>

      <section className="sec">
        <div className="shead"><span className="k">01</span><h2>Hours</h2></div>
        <div className="prows air">
          {days.map((d) => {
            const [day, ...rest] = d.split(', ')
            return (
              <div className="row" key={d}>
                <span className="q">{day}</span>
                <span className="a num">{rest.join(', ')}</span>
              </div>
            )
          })}
          <div className="row">
            <span className="q">Where</span>
            <span className="a">{show.venueName}, {show.venueAddress}</span>
          </div>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="shead"><span className="k">02</span><h2>What to expect</h2></div>
        <div className="prows air">
          <div className="row">
            <span className="q">Inside</span>
            <span className="a">The full room of makers, all three days, restocked as things sell. One register at the front.</span>
          </div>
          <div className="row">
            <span className="q">Outside</span>
            <span className="a">A new set of tents every day. Friday&rsquo;s makers are not Saturday&rsquo;s, which is why people come back.</span>
          </div>
          <div className="row">
            <span className="q">The lineup</span>
            <span className="a">Live music, food, coffee, and the extras get their day-by-day schedule the week of the show. The list hears first.</span>
          </div>
        </div>
        <div style={{ marginTop: 34 }}>
          <a href={`/api/calendar/${show.slug}`} className="btn">Add to calendar</a>
        </div>
      </section>
      <Footer show={show} />
    </>
  )
}
