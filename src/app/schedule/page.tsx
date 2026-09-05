import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle, RichText, FactTable } from '@/components/theme/Sections'
import { bookends, extrasFor, splitDay } from '@/lib/schedule'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Mermade Market Schedule' }

/**
 * /pages/schedule — their page title, the venue block, then one headed block
 * a day running open → all-day → music → close.
 *
 * Their live page carries the Spring lineup, typed in by hand. Ours reads the
 * days and hours off the Show record and the bookings off src/lib/schedule.ts,
 * which is empty until the trucks and the musicians are booked. An unbooked
 * day says the rest goes up closer to the show, which is what their own
 * outdoor page promises, rather than inventing a lineup.
 */
export default async function Schedule() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const days = show.hoursNote.split(' · ')
  // True until the trucks and the musicians are actually booked. One flag for
  // the whole show rather than a repeated row inside each day.
  const someDayUnbooked = days.some((row) => {
    const x = extrasFor(splitDay(row).day)
    return !x || (!x.foodTruck && x.allDay.length === 0 && x.music.length === 0)
  })

  return (
    <SiteShell show={show} template="page template-suffix-schedule">
          <PageTitle title="Mermade Market Schedule" />

          <RichText title={`@ The Dana Point ${show.venueName}`}>
            <p>{show.venueAddress}</p>
            <p>
              Inside shops stay there all 3 days, with restock aplenty, and the
              makers outside change each day! With the exception of a few!
            </p>
          </RichText>

          {/* A timetable, not centred prose. Times range right in tabular
              numerals so a shopper can scan the left edge for "when does it
              open"; the closing time is a row, not a heading, because it is
              data inside the day rather than a section of its own.

              `timetable`, not `price-table`. It used to borrow the pricing
              tables' class, which carries a mobile rule that hides the second
              cell — sound there, where that cell is a blurb beside a price,
              and ruinous here, where it is the whole row. Every day on this
              page read as a bare list of times on a phone. */}
          {days.map((row) => {
            const { day, hours } = splitDay(row)
            const { opens, closes } = bookends(hours)
            const x = extrasFor(day)
            return (
              <div className="shopify-section section-rich-text" key={row}>
                <div className="fully-spaced-row--medium" data-cc-animate="">
                  <div className="container container--reading-width">
                    <h2 className="majortitle in-content">{day}</h2>
                    <div className="rte timetable">
                      <table>
                        <caption>{hours}</caption>
                        <tbody>
                          <tr>
                            <th scope="row" className="num">{opens}</th>
                            <td>Inside &amp; outdoor market opens.</td>
                          </tr>
                          {x?.foodTruck && (
                            <tr><th scope="row">Food truck</th><td>{x.foodTruck}</td></tr>
                          )}
                          {x && x.allDay.length > 0 && (
                            <tr><th scope="row" className="num">All day</th><td>{x.allDay.join(' · ')}</td></tr>
                          )}
                          {x?.music.map((m) => (
                            <tr key={`${m.time}${m.what}`}>
                              <th scope="row" className="num">{m.time}</th><td>{m.what}</td>
                            </tr>
                          ))}
                          <tr><th scope="row" className="num">{closes}</th><td>Market closes.</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* The lineup note and the link to the makers used to be a row
              inside every day, which printed the same two sentences three
              times over. They are the same on all three days because they
              are about the show, not about a day, so they sit once, here,
              under the timetable they qualify. */}
          <RichText large={false}>
            {someDayUnbooked && (
              <p>
                The live music, the food trucks and the rest of each day go up
                about a week before the show. The list hears first.
              </p>
            )}
            <p>
              <Link href="/merchants">See the maker line up</Link>. Inside is the
              same all three days; the outdoor tents change daily.
            </p>
          </RichText>

          {/* The most under-served content on a market site, per
              docs/08-DESIGN-SYSTEM.md §6: the practical questions that decide
              whether someone comes. None of it was anywhere on the site. */}
          <FactTable
            title="Before you come"
            rows={[
              { label: 'Admission', value: 'Free. No ticket, no line.' },
              { label: 'Parking', value: 'Free lot on site, plus street parking on San Juan and Del Prado. It fills by late morning on Saturday.' },
              { label: 'Strollers', value: 'Yes. A single stroller or a carrier is easiest in the morning crowd.' },
              { label: 'Dogs', value: 'Well-mannered dogs on leash are welcome. Keep them close and pick up after them.' },
              { label: 'How it works inside', value: 'Grab a basket, shop the whole room, pay once at the front.' },
              { label: 'Coming twice', value: 'The outdoor tents change every day, so Saturday is a different market from Friday.' },
            ]}
            cta={{ href: `/api/calendar/${show.slug}`, label: 'Add to calendar', external: true }}
          />

        </SiteShell>
  )
}
