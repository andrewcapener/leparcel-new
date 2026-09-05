import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { Masthead, Footer } from '@/components/site'
import { Photo } from '@/components/Photo'
import { visiting } from '@/lib/content'
import { fmtRange } from '@/lib/dates'
import { bookends, extrasFor, splitDay } from '@/lib/schedule'

export const dynamic = 'force-dynamic'

/**
 * /pages/schedule on the live site: the venue, a line about how the room
 * works, then one block per day running open → all-day → music → close.
 *
 * The lineup for a given day comes from src/lib/schedule.ts and is empty
 * until it is booked, so a day renders its opening and closing rows and says
 * the rest is posted closer to the show. Hours come off the Show record.
 */
export default async function Schedule() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const days = show.hoursNote.split(' · ')

  return (
    <>
      <Masthead show={show} />
      <section className="claim">
        <div className="k">{show.name} · {fmtRange(show.startsOn, show.endsOn)}</div>
        <h1 className="lede">Mermade Market<br /><em>schedule.</em></h1>
        <p>
          @ The Dana Point {show.venueName}, {show.venueAddress}. Inside shops
          stay there all 3 days, with restock aplenty, and the makers outside
          change each day! With the exception of a few.
        </p>
        <div className="cta">
          <a href={`/api/calendar/${show.slug}`} className="btn">Add to calendar</a>
        </div>
      </section>

      {/* One block a day, the way the live schedule page runs. */}
      {days.map((row, i) => {
        const { day, hours } = splitDay(row)
        const { opens, closes } = bookends(hours)
        const x = extrasFor(day)
        return (
          <section className="sec runsheet" key={row} style={i > 0 ? { paddingTop: 0 } : undefined}>
            <div className="shead">
              <span className="k">{String(i + 1).padStart(2, '0')}</span>
              <h2>{day} <span className="num">/ {hours}</span></h2>
            </div>
            <div className="prows air">
              <div className="row">
                <span className="q num">{opens}</span>
                <span className="a">
                  Inside &amp; outdoor market opens.{' '}
                  <Link href="/merchants">See the maker line up</Link>.
                </span>
              </div>
              {x?.foodTruck && (
                <div className="row">
                  <span className="q">Food truck</span>
                  <span className="a">{x.foodTruck}</span>
                </div>
              )}
              {x && x.allDay.length > 0 && (
                <div className="row">
                  <span className="q num">All day</span>
                  <span className="a">{x.allDay.join(' · ')}</span>
                </div>
              )}
              {x?.music.map((m) => (
                <div className="row" key={`${m.time}${m.what}`}>
                  <span className="q num">{m.time}</span>
                  <span className="a">{m.what}</span>
                </div>
              ))}
              {(!x || (x.allDay.length === 0 && x.music.length === 0 && !x.foodTruck)) && (
                <div className="row">
                  <span className="q">Music, food &amp; extras</span>
                  <span className="a">
                    The live music, the food trucks and the rest of the day go up
                    about a week before the show. The list hears first.
                  </span>
                </div>
              )}
              <div className="row">
                <span className="q num">{closes}</span>
                <span className="a">Market closes.</span>
              </div>
            </div>
          </section>
        )
      })}

      <div className="plate">
        <Photo src="/photos/hero.jpg" alt="The Community House during a show." />
        <div className="cp">
          <span>Dana Point {show.venueName}</span>
          <span>{show.venueAddress}</span>
        </div>
      </div>

      <section className="sec">
        <div className="shead"><span className="k">04</span><h2>Planning the day</h2></div>
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
          <span className="k">05</span><h2>What to expect</h2>
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
