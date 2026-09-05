import Link from 'next/link'
import { activeShow } from '@/db/queries'
import { SiteShell } from '@/components/theme/SiteShell'
import { PageTitle, RichText, RichTextBlocks } from '@/components/theme/Sections'
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

          <RichTextBlocks
            blocks={days.map((row) => {
              const { day, hours } = splitDay(row)
              const { opens, closes } = bookends(hours)
              const x = extrasFor(day)
              const nothingBooked = !x || (!x.foodTruck && x.allDay.length === 0 && x.music.length === 0)
              return {
                title: `${day} / ${hours}`,
                body: (
                  <>
                    <p>
                      <strong>{opens} </strong>Inside &amp; Outdoor Market Opens{' '}
                      <Link href="/merchants">(see maker line up here)</Link>
                    </p>
                    {x?.foodTruck && <p><strong>Food Truck: </strong>{x.foodTruck}</p>}
                    {x && x.allDay.length > 0 && (
                      <p><strong>{opens}</strong> - <strong>ALL DAY</strong> {x.allDay.join(' + ')}</p>
                    )}
                    {x && x.music.length > 0 && (
                      <>
                        <h2><strong>Live music</strong>: </h2>
                        {x.music.map((m) => (
                          <p key={`${m.time}${m.what}`}><strong>{m.time} </strong>{m.what}</p>
                        ))}
                      </>
                    )}
                    {nothingBooked && (
                      <p>
                        The live music, the food trucks and the rest of the day go
                        up about a week before the show. The list hears first.
                      </p>
                    )}
                    <h1><strong>{closes}:</strong> Market Closes</h1>
                  </>
                ),
              }
            })}
          />
        </SiteShell>
  )
}
