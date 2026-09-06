import Link from 'next/link'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { applications, bookings, emailOutbox, vendors } from '@/db/schema'
import { fmtDate, fmtDateTime, fmtRange, applicationWindow } from '@/lib/dates'
import { bpsLabel, usd } from '@/lib/money'
import { PageHead, Stats, Stat, ActionCard, Progress } from './ui'
import { RehearsalLink } from './RehearsalLink'
import { REHEARSAL_TTL_MS, rehearsalConfigured, signRehearsalToken } from '@/lib/rehearsal'
import { siteUrl } from '@/lib/site-url'
import { Icon } from './Icon'

export const dynamic = 'force-dynamic'

/**
 * The front door.
 *
 * /admin used to redirect straight to the jury queue, which was fine while
 * the jury queue was the only screen with work in it. It answers one
 * question now: is anything waiting on a person, and where. Every figure on
 * it is a count from the database against a value on the Show record.
 * Nothing here is typed in, and nothing here is an estimate.
 */

const num = (v: number | string | null | undefined) => Number(v ?? 0)

const WINDOW = {
  before: 'Applications have not opened yet',
  open: 'Applications are open',
  closed: 'Applications are closed',
} as const

export default async function Dashboard() {
  const show = await activeShow()
  if (!show) {
    return (
      <>
        <PageHead title="Dashboard" sub="No active show" />
        <p className="adm-empty">
          No show is marked active, so there is nothing for the admin to be scoped to. Seed the
          database with <code>npm run db:seed</code>, or mark a show active, and every screen
          here comes back.
        </p>
      </>
    )
  }

  const byStatus = await db
    .select({ status: applications.status, n: sql<number>`count(*)` })
    .from(applications)
    .where(eq(applications.showId, show.id))
    .groupBy(applications.status)
  const countOf = (s: string) => num(byStatus.find((c) => c.status === s)?.n)
  const applied = byStatus.reduce((a, r) => a + num(r.n), 0)
  const undecided = countOf('new') + countOf('under_review') + countOf('shortlist')

  const held = await db
    .select({ booking: bookings, app: applications })
    .from(bookings)
    .innerJoin(applications, eq(bookings.applicationId, applications.id))
    .where(eq(bookings.showId, show.id))

  const live = held.filter((r) => ['confirmed', 'awaiting_payment'].includes(r.booking.status))
  const confirmed = held.filter((r) => r.booking.status === 'confirmed')
  const collected = confirmed.reduce((a, r) => a + r.booking.priceCents, 0)
  const expected = live.reduce((a, r) => a + r.booking.priceCents, 0)

  const documented = (a: typeof held[number]['app']) =>
    Boolean(a.sellerPermit.trim()) || a.occasionalSeller
  const needsPerson = held.filter(
    (r) => !documented(r.app) || r.booking.status === 'awaiting_payment' || !r.app.hasCoi,
  ).length

  /* Spaces held per track. A `both` acceptance holds one on each side, so
     the two are counted separately against their own capacity. */
  const acceptedByTrack = await db
    .select({ track: applications.track, n: sql<number>`count(*)` })
    .from(applications)
    .where(and(eq(applications.showId, show.id), eq(applications.status, 'accepted')))
    .groupBy(applications.track)
  const takenIn = (track: 'indoor' | 'outdoor') =>
    acceptedByTrack.filter((r) => r.track === track || r.track === 'both')
      .reduce((a, r) => a + num(r.n), 0)
  const capacity = show.indoorCapacity + show.outdoorCapacity
  const taken = takenIn('indoor') + takenIn('outdoor')

  const mail = await db
    .select({ status: emailOutbox.deliveryStatus, n: sql<number>`count(*)` })
    .from(emailOutbox)
    .groupBy(emailOutbox.deliveryStatus)
  const mailOf = (s: string) => num(mail.find((m) => m.status === s)?.n)
  const mailTotal = mail.reduce((a, r) => a + num(r.n), 0)

  const latest = await db
    .select({
      id: applications.id, status: applications.status, category: applications.category,
      submittedAt: applications.submittedAt, shopName: vendors.shopName, email: vendors.email,
    })
    .from(applications)
    .innerJoin(vendors, eq(applications.vendorId, vendors.id))
    .where(eq(applications.showId, show.id))
    .orderBy(desc(applications.submittedAt))
    .limit(6)

  const state = applicationWindow(show.applicationsOpenAt, show.applicationsCloseAt)

  /* The rehearsal link, minted fresh on every load of this page rather than
     stored. There is nothing to revoke and nothing to look up: the signature
     is the record, and reloading gives you a new one. It only exists before
     the window opens, because afterwards the form is open to everybody and a
     link that grants what everybody already has is a loose end. */
  const opensAt = new Date(show.applicationsOpenAt).getTime()
  const rehearsal = state === 'before' && rehearsalConfigured()
    ? `${siteUrl()}/api/rehearse?t=${encodeURIComponent(
        await signRehearsalToken(Math.min(Date.now() + REHEARSAL_TTL_MS, opensAt)),
      )}`
    : null

  return (
    <>
      <PageHead
        title="Dashboard"
        sub={`${show.numeral} · ${show.name} · ${fmtRange(show.startsOn, show.endsOn)} · ${show.venueName}`}
      >
        <Link className="adm-btn" href="/admin/jury">
          <Icon name="queue" size={16} />
          Review queue
        </Link>
      </PageHead>

      <Stats>
        <Stat
          label="Applications" icon="queue" value={applied}
          note={`${WINDOW[state]}. ${state === 'before' ? 'Open' : 'Close'} ${fmtDateTime(state === 'before' ? show.applicationsOpenAt : show.applicationsCloseAt)}.`}
        />
        <Stat
          label="Still to decide" icon="clock" value={undecided}
          note={`${countOf('new')} new, ${countOf('under_review')} under review, ${countOf('shortlist')} shortlisted.`}
        />
        <Stat
          label="Spaces held" icon="tent" value={taken} unit={`of ${capacity}`}
          note={`${takenIn('indoor')} of ${show.indoorCapacity} indoor, ${takenIn('outdoor')} of ${show.outdoorCapacity} outdoor.`}
        />
        <Stat
          label="Booth fees in" icon="money" value={usd(collected)}
          note={`${usd(expected)} expected across ${live.length} live ${live.length === 1 ? 'booking' : 'bookings'}.`}
        />
      </Stats>

      <div className="adm-stats">
        <Progress
          label="Spaces filled"
          figure={`${taken} / ${capacity}`}
          unit="spaces held"
          pct={capacity > 0 ? (taken / capacity) * 100 : 0}
          status={`${capacity - taken} left across both tracks. Roster announced ${fmtDate(show.rosterAnnouncedOn)}.`}
          link={{ href: '/admin/jury?status=shortlist', label: 'Shortlist' }}
        />
        <Progress
          label="Booth fees collected"
          figure={usd(collected)}
          unit={`of ${usd(expected)} expected`}
          pct={expected > 0 ? (collected / expected) * 100 : 0}
          status={`${confirmed.length} paid, ${live.length - confirmed.length} inside the ${show.paymentWindowHours} hour window. Commission ${bpsLabel(show.commissionBps)} on indoor sales.`}
          link={{ href: '/admin/roster', label: 'Roster' }}
        />
      </div>

      <div className="adm-sec">
        <h2>Where the work is</h2>
        <span className="c">{undecided + needsPerson} open</span>
      </div>
      <div className="adm-acts">
        <ActionCard
          href="/admin/jury" icon="queue" title="Review queue"
          note={undecided === 0 ? 'Nothing waiting' : `${undecided} still to decide`}
        />
        <ActionCard
          href="/admin/roster" icon="shield" title="Roster"
          note={needsPerson === 0 ? 'Every space paid and documented' : `${needsPerson} need a person`}
        />
        <ActionCard
          href="/admin/show" icon="settings" title="Show settings"
          note={`Every date, price and rate for ${show.name}`}
        />
        <ActionCard
          href="/admin/outbox" icon="mail" title="Outbox"
          note={mailTotal === 0 ? 'Nothing sent yet' : `${mailTotal} sent, ${mailOf('failed')} failed`}
        />
      </div>

      {rehearsal && (
        <>
          <div className="adm-sec" id="rehearsal" style={{ scrollMarginTop: '24px' }}>
            <h2>Rehearsal link</h2>
            <span className="c">Expires {fmtDateTime(new Date(Math.min(Date.now() + REHEARSAL_TTL_MS, opensAt)).toISOString())}</span>
          </div>
          <p className="adm-note">
            Send this to anyone who should submit a test application before the form opens.
            It puts their browser in the launch preview and drops them on the form, without
            a staff password. What they submit is a real application in the queue below, so
            delete the rehearsals before opening day.
          </p>
          <RehearsalLink url={rehearsal} />
        </>
      )}

      <div className="adm-sec">
        <h2>Latest applications</h2>
        <Link className="adm-lk c" href="/admin/jury?status=all">
          All applications <span aria-hidden="true">→</span>
        </Link>
      </div>

      {latest.length === 0 ? (
        <p className="adm-empty">
          Nothing has come in for {show.name} yet. The form goes live at{' '}
          {fmtDateTime(show.applicationsOpenAt)} and the first submission lands here.
        </p>
      ) : (
        <table className="adm-tbl">
          <caption className="adm-sr">
            The six most recent applications to {show.name}, newest first.
          </caption>
          <thead>
            <tr>
              <th scope="col">Maker</th>
              <th scope="col" className="c-1">Category</th>
              <th scope="col">Status</th>
              <th scope="col" className="r">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {latest.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link className="adm-nm" href={`/admin/applications/${r.id}`}>{r.shopName}</Link>
                  <span className="adm-sub2">{r.email}</span>
                </td>
                <td className="c-1">{r.category}</td>
                <td><span className="adm-st">{r.status.replace('_', ' ')}</span></td>
                <td className="r"><span className="mono">{fmtDateTime(r.submittedAt)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
