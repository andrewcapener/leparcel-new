import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { db } from '@/db'
import { shows } from '@/db/schema'
import { Masthead, Footer } from '@/components/site'
import { Photo } from '@/components/Photo'
import { visiting } from '@/lib/content'
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
        <p>Free to walk in, as it has been every show. No ticket and no line.</p>
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
        </div>
        <div style={{ marginTop: 34 }}>
          <a href={`/api/calendar/${show.slug}`} className="btn">Add to calendar</a>
        </div>
      </section>

      <div className="plate">
        <Photo src="/photos/hero.jpg" alt="The Community House during a show." />
        <div className="cp">
          <span>{show.venueName}</span>
          <span>{show.venueAddress}</span>
        </div>
      </div>

      <section className="sec">
        <div className="shead"><span className="k">02</span><h2>Planning the day</h2></div>
        <div className="prows air">
          {visiting.map((v) => (
            <div className="row" key={v.q}>
              <span className="q">{v.q}</span>
              <span className="a">{v.a}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sec" style={{ background: 'var(--paper-2)', paddingTop: 0 }}>
        <div className="shead" style={{ paddingTop: 'clamp(56px,8.5vw,112px)' }}>
          <span className="k">03</span><h2>What to expect</h2>
        </div>
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
      </section>

      <section className="apply">
        <div className="k">Before you come</div>
        <h2 style={{ marginTop: 18 }}>Bring a <em>tote.</em></h2>
        <p>
          One register at the front means one bag at the end, and the good ceramics do not
          survive a walk to the car in your arms.
        </p>
        <div className="cta">
          <a href={`/api/calendar/${show.slug}`} className="btn">Add to calendar</a>
          <Link href="/faq" className="btn line">Read the FAQ</Link>
        </div>
      </section>
      <Footer show={show} />
    </>
  )
}
