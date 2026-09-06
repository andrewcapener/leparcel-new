import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { LdJson, eventLd, organizationLd } from '@/lib/structured-data'
import { PageTitle, RichText, FactTable, Banner } from '@/components/theme/Sections'
import { bookends, extrasFor, splitDay } from '@/lib/schedule'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Schedule',
  description:
    'Show dates and hours for Mermade Market at the Dana Point Community House, plus parking, admission and what is on each day.',
  alternates: { canonical: '/schedule' },
}

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
      {/* The show as an Event, so a search result can carry the dates and the
          venue instead of only a title. Built from the Show record, so moving
          the show at /admin/show moves this with it. */}
      <LdJson data={organizationLd()} />
      <LdJson data={eventLd(show)} />
      
          <PageTitle title="Mermade Market Schedule" />

          <RichText title={`@ The Dana Point ${show.venueName}`}>
            <p>{show.venueAddress}</p>
            <p>
              Inside shops stay there all 3 days, with restock aplenty, and the
              makers outside change each day! With the exception of a few!
            </p>
          </RichText>

          {/* One table for the run of show, not one per day.
              Until the trucks and the musicians are booked a day has exactly
              two facts, its open and its close, and three separate tables of
              two rows each put a page of white space between them and printed
              the same hours twice: once as the caption, once as the rows. The
              days belong in one column so they compare, which is the whole
              reason a shopper is on this page. Booked extras become rows
              under their own day as they land. */}
          <div className="shopify-section section-rich-text">
            <div className="fully-spaced-row--medium" data-cc-animate="">
              <div className="container container--reading-width">
                <div className="rte timetable timetable--run">
                  <table>
                    <caption>The run of show</caption>
                    <thead>
                      <tr>
                        <th scope="col">Day</th>
                        <th scope="col">Open</th>
                        <th scope="col">What is on</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((row) => {
                        const { day, hours } = splitDay(row)
                        const { opens, closes } = bookends(hours)
                        const x = extrasFor(day)
                        const on: string[] = []
                        if (x?.foodTruck) on.push(x.foodTruck)
                        if (x && x.allDay.length > 0) on.push(...x.allDay)
                        if (x) on.push(...x.music.map((m) => `${m.time} ${m.what}`))
                        return (
                          <tr key={row}>
                            <th scope="row">{day}</th>
                            {/* The hours as written on the Show record, so a
                                range that cannot be parsed still shows. */}
                            <td className="num">{opens && closes ? `${opens} to ${closes}` : hours}</td>
                            <td>
                              {on.length > 0
                                ? on.join(' · ')
                                : 'Inside and outdoor market open.'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

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

          {/* The timetable answers when. This answers what it is like: one
              long room, racks and shelves, and enough space to look twice. */}
          <Banner
            id="section-schedule-plate"
            image="/photos/racks.jpg"
            title=""
            heightMobile={420}
            heightDesktop={560}
            shadow={false}
          />

        </SiteShell>
  )
}
