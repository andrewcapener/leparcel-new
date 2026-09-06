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

          {/* The run of show, in the same two-column shape as "Before you
              come" below it. It was a three-column table with its own header
              row, which put a second visual language on one short page: two
              tables of the same facts, one with a DAY / OPEN / WHAT IS ON
              header and heavier rules, one without. The day is the label and
              everything true about that day is the value, which is exactly
              what the fact table already does, so it uses the fact table.
              Booked extras join the value as they land. */}
          <FactTable
            title="The run of show"
            rows={days.map((row) => {
              const { day, hours } = splitDay(row)
              const { opens, closes } = bookends(hours)
              const x = extrasFor(day)
              const on: string[] = []
              if (x?.foodTruck) on.push(x.foodTruck)
              if (x && x.allDay.length > 0) on.push(...x.allDay)
              if (x) on.push(...x.music.map((m) => `${m.time} ${m.what}`))
              /* The hours as written on the Show record when the range cannot
                 be parsed, so an unusual day still shows its own times. */
              const when = opens && closes ? `${opens} to ${closes}` : hours
              return {
                label: day,
                value: `${when} · ${on.length > 0 ? on.join(' · ') : 'Inside and outdoor market open.'}`,
              }
            })}
          />

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
