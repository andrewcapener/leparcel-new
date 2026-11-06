import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { googleCalendarUrl } from '@/server/modules/calendar/ics'
import { SiteShell } from '@/components/theme/SiteShell'
import { LdJson, eventLd, organizationLd } from '@/lib/structured-data'
import { PageTitle, RichText, FactTable, Banner, type FactRow } from '@/components/theme/Sections'
import { bookends, extrasFor, hasExtras, type Named, splitDay, TBA } from '@/lib/schedule'

/* Cached and re-rendered at most once a minute. Read-only, nothing
 * per-request, and the Show record it reads changes a few times a season.
 * Being dynamic meant a cold database on the visitor's critical path for no
 * benefit; saving in the admin clears the tag, so staff still see edits at
 * once. See src/app/page.tsx for the incident this came from. */
export const revalidate = 60

export const metadata = {
  title: 'Schedule',
  description:
    'What is on each day at Mermade Market: hours, live music set times, the food trucks and carts, and the tents that change daily.',
  alternates: { canonical: '/schedule' },
}

/** The day name without the date, for "See Friday's makers". */
function justDay(day: string): string {
  return day.split(' ')[0] ?? day
}

/**
 * A day's food or all-day list, with a link on anything that has one.
 *
 * Elise, 6 November: "Oh happy hair lounge needs a link." A shopper who does
 * not recognise a name has nowhere to go, and a maker reposting the day wants
 * the handle. Separated by the middle dot the rest of the site uses, and the
 * separators are not links, so a mis-tap does not take anybody off the page.
 */
function NamedList({ items }: { items: readonly Named[] }) {
  return (
    <>
      {items.map((item, i) => (
        <span key={item.name}>
          {i > 0 && ' · '}
          {item.href
            ? <a href={item.href} rel="noopener noreferrer" target="_blank">{item.name}</a>
            : item.name}
        </span>
      ))}
    </>
  )
}

/**
 * /schedule — the venue, then one block a day, then what to know before you
 * come.
 *
 * Elise, 6 November, a week out: "I actually usually do it two weeks before
 * the show and since it's one week I think we should do it today." What she
 * wanted off Hillary's bar-graph spreadsheet was the thing a shopper and a
 * maker both ask, which is not when the market is open but what is on: the
 * live music with its set times, the food trucks, and the few things that
 * run all day. In her words, so "customers can know what day to go to you
 * and makers can repost it."
 *
 * So each day is its own block that stands alone on a phone screen and in a
 * screenshot, rather than three rows of one table. The hours come off the
 * Show record (CLAUDE.md rule 6) and the music, food and all-day rows come
 * off src/lib/schedule.ts. The makers are not listed here at all: they are
 * generated from bookings on /makers and the day's row links straight to
 * them, which is the one place that cannot go stale when a maker drops.
 */
export default async function Schedule() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

  const days = show.hoursNote.split(' · ')

  return (
    <SiteShell show={show} template="page template-suffix-schedule">
      {/* The show as an Event, so a search result can carry the dates and the
          venue instead of only a title. Built from the Show record, so moving
          the show at /admin/show moves this with it. */}
      <LdJson data={organizationLd()} />
      <LdJson data={eventLd(show)} />

          <PageTitle title="Mermade Market Schedule">
            <p className="mk-dir__lede">
              Inside shops stay all three days, with restock aplenty. The makers
              outside change every day, so Saturday is a different market from
              Friday.
            </p>
          </PageTitle>

          <RichText title={`@ The Dana Point ${show.venueName}`}>
            <p>{show.venueAddress}</p>
          </RichText>

          {days.map((row) => {
            const { day, hours } = splitDay(row)
            const { opens, closes } = bookends(hours)
            /* The hours as written on the Show record when the range cannot
               be parsed, so an unusual day still shows its own times. */
            const when = opens && closes ? `${opens} to ${closes}` : hours
            const x = extrasFor(day)
            const rows: FactRow[] = [{ label: 'Open', value: when }]

            /* Food, then what is on all day, then the music, then the
               makers.
            
               Elise: "can you move music down below each thing?" The music
               sat directly under the opening time, which put six set times
               between a shopper and the two rows telling her what is actually
               there. The music is the longest row and the one she reads last,
               so it goes last of the things that are on, with the makers link
               closing the day. */
            if (hasExtras(x) && x.food.length > 0) {
              rows.push({ label: 'Food and drink', value: <NamedList items={x.food} /> })
            }
            if (hasExtras(x) && x.allDay.length > 0) {
              rows.push({ label: 'All day', value: <NamedList items={x.allDay} /> })
            }
            if (hasExtras(x) && x.music.length > 0) {
              rows.push({
                label: 'Live music',
                value: (
                  <dl className="sched-sets">
                    {x.music.map((slot) => (
                      <div className="sched-sets__set" key={slot.time + slot.what}>
                        <dt>{slot.time}</dt>
                        {/* An hour that is held and not booked is set back a
                            shade, so a row of real names is not read as
                            having a band called TBA in it. */}
                        <dd className={slot.what === TBA ? 'sched-sets__tba' : undefined}>
                          {slot.what}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ),
              })
            }
            /* "Tents" was ours, not theirs. Elise: 'Instead of "see Fridays
               tents" can you say "see Fridays makers!"' A shopper is coming
               to see the people, and inside makers are on this page too and
               have never been in a tent. */
            rows.push({
              label: 'Outside today',
              value: (
                <Link href={`/makers#${justDay(day).toLowerCase()}`}>
                  See {justDay(day)}&#39;s makers!
                </Link>
              ),
            })

            return <FactTable key={day} title={day} titleAs="heading" rows={rows} />
          })}

          <FactTable
            title="Before you come"
            rows={[
              { label: 'Admission', value: 'Free. No ticket, no line.' },
              { label: 'Parking', value: 'Free lot on site, plus street parking on San Juan and Del Prado. It fills by late morning on Saturday.' },
              { label: 'Strollers', value: 'Yes. A single stroller or a carrier is easiest in the morning crowd.' },
              { label: 'Dogs', value: 'Well-mannered dogs on leash are welcome. Keep them close and pick up after them.' },
              { label: 'How it works inside', value: 'Grab a basket, shop the whole room, pay once at the front.' },
            ]}
            /* Two, because one was not enough.
            
               Drew, 6 November: "the add to calendar button is broken on the
               schedule page." The route answered and the file downloaded; what
               was broken was the file (see the calendar module) and, on a
               phone, the gesture. An .ics is a download, and a download on a
               phone lands in Files and looks exactly like nothing happening.
               So Google first, which opens a filled-in event a person can see
               and save, and the file second for Apple and Outlook. */
            cta={[
              { href: googleCalendarUrl(show), label: 'Add to Google Calendar', external: true },
              { href: `/api/calendar/${show.slug}`, label: 'Download for Apple or Outlook', external: true },
            ]}
          />

          {/* The page answers when. This answers what you are turning up to,
              and it has to be the picture this page is actually about.
            
              It was a rack of clothes indoors, which is a fine photograph of
              shopping and a poor one of a day: no sky, no tents, nobody in
              it. Elise, 6 November, wanted it changed immediately and she is
              right. The row of white tents under a blue sky with a crowd in
              it is the day this page times out, and it is the half of the
              show the music, the trucks and the daily lineup above all
              belong to. */}
          <Banner
            id="section-schedule-plate"
            image="/photos/tents.jpg"
            title=""
            heightMobile={420}
            heightDesktop={560}
            shadow={false}
          />

        </SiteShell>
  )
}
