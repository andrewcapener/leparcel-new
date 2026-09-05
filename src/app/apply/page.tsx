import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { shows, spaceTypes } from '@/db/schema'
import { Masthead, Footer } from '@/components/site'
import { ApplyForm } from './ApplyForm'
import { applicationWindow, fmtDate, fmtRange } from '@/lib/dates'
import { usd } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function Apply({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>
}) {
  // ?preview=1 shows the form outside the application window — view only.
  // Submission is still enforced server-side in actions.ts, which rejects
  // anything outside the window regardless of how the form was reached.
  const preview = (await searchParams).preview === '1'
  const show = await db.query.shows.findFirst({ where: eq(shows.isActive, true) })
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  const spaces = await db.query.spaceTypes.findMany({
    where: eq(spaceTypes.showId, show.id),
    orderBy: [asc(spaceTypes.sortOrder)],
  })

  const win = applicationWindow(show.applicationsOpenAt, show.applicationsCloseAt)

  return (
    <>
      <Masthead show={show} />

      <section className="claim" style={{ paddingBottom: 72 }}>
        <div className="k">Apply to sell · {show.name}</div>
        <p className="lede" style={{ maxWidth: '22ch' }}>
          Show us <em>what you make.</em>
        </p>
        <p>We look at everything, and we say no a lot. Here is how to be a yes.</p>
      </section>

      {/* The two tracks share a brand and this form and nothing else.
          docs/CLAUDE.md — model them separately. */}
      <section className="sec">
        <div className="prows" id="indoor">
          <div className="row">
            <span className="q">The show</span>
            <span className="a num">
              {fmtRange(show.startsOn, show.endsOn)} · {show.venueName}, Dana Point
            </span>
          </div>
          <div className="row">
            <span className="q">Indoor</span>
            <span className="a">
              You drop off your work and we do the rest: the display, the floor, the
              register. We keep {show.commissionBps / 100}% of what sells and pay you
              after the show. You don’t need to be there.
            </span>
          </div>
          <div className="row" id="outdoor">
            <span className="q">Outdoor</span>
            <span className="a">
              You rent a 10 × 10 tent, run your own payments, and keep everything. No commission.
            </span>
          </div>
          <div className="row">
            <span className="q">Booth fees</span>
            <span className="a">
              {spaces.map((s) => `${s.label} ${usd(s.priceCents)}`).join(' · ')}
            </span>
          </div>
          <div className="row">
            <span className="q">Timeline</span>
            <span className="a">
              Applications close {fmtDate(show.applicationsCloseAt)}. Roster announced{' '}
              {fmtDate(show.rosterAnnouncedOn)}. Accepted makers have{' '}
              {show.paymentWindowHours} hours to pay and confirm.
            </span>
          </div>
          <div className="row">
            <span className="q">What we look for</span>
            <span className="a">
              Work made by the person applying. We take one to three makers per category,
              which means some seasons we say no to work we love. We read everything and
              answer either way.
            </span>
          </div>
        </div>
      </section>

      {win === 'open' || preview ? (
        <>
          {win !== 'open' && (
            <section className="apply" style={{ paddingBottom: 0 }}>
              <div className="k">
                Preview. Applications are not open, and submissions are disabled until{' '}
                {fmtDate(show.applicationsOpenAt)}.
              </div>
            </section>
          )}
          <ApplyForm show={show} spaces={spaces} />
        </>
      ) : (
        <section className="apply">
          <div className="k">{win === 'before' ? 'Not open yet' : 'Closed'}</div>
          <h2 style={{ marginTop: 18 }}>
            {win === 'before'
              ? `Applications open ${fmtDate(show.applicationsOpenAt)}.`
              : `Applications for ${show.name} closed ${fmtDate(show.applicationsCloseAt)}.`}
          </h2>
          <p>
            {win === 'before'
              ? 'Join the list and we’ll email you the morning they open.'
              : 'Join the list and we’ll email you the morning the next window opens.'}
          </p>
        </section>
      )}

      <Footer show={show} />
    </>
  )
}
