import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { shows, spaceTypes } from '@/db/schema'
import { usd } from '@/lib/money'
import { fmtDate, fmtRange } from '@/lib/dates'

export const dynamic = 'force-dynamic'

/**
 * Read-only in the prototype. The point of this page is to show that NOTHING
 * is hardcoded: every date, price, capacity, and rate the public site and the
 * jury render comes from this one record. (CLAUDE.md rule 6.)
 */
export default async function ShowSettings() {
  const show = await db.query.shows.findFirst({ where: eq(shows.isActive, true) })
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')
  const spaces = await db.query.spaceTypes.findMany({
    where: eq(spaceTypes.showId, show.id),
    orderBy: [asc(spaceTypes.sortOrder)],
  })

  const rows: Array<[string, string, string?]> = [
    ['Show', `${show.numeral} · ${show.name}`],
    ['Venue', `${show.venueName} — ${show.venueAddress}`],
    ['Dates', fmtRange(show.startsOn, show.endsOn)],
    ['Hours', show.hoursNote],
    ['Applications open', fmtDate(show.applicationsOpenAt),
      '⚠️ Unconfirmed — the site says "late August", Instagram says Sep 7. Open question #1.'],
    ['Applications close', fmtDate(show.applicationsCloseAt)],
    ['Roster announced', fmtDate(show.rosterAnnouncedOn)],
    ['Commission', `${show.commissionBps / 100}% (${show.commissionBps} bps)`,
      'Snapshotted onto each booking at acceptance and immutable from then on.'],
    ['Payment window', `${show.paymentWindowHours} hours`,
      'Audit §2.3 recommends 48 over the current 36.'],
    ['Indoor capacity', String(show.indoorCapacity)],
    ['Outdoor capacity', String(show.outdoorCapacity)],
  ]

  return (
    <div style={{ padding: '26px 26px 80px', maxWidth: 900 }}>
      <h1 style={{ fontFamily: 'var(--font-c)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.012em', fontSize: 34, marginBottom: 8 }}>Show settings</h1>
      <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 26, maxWidth: 72 + 'ch' }}>
        Read-only in the prototype. Everything the public site renders — dates, prices, the
        commission rate, the application window — is read from here. There are no hardcoded dates
        or prices anywhere in the codebase.
      </p>

      <table className="tbl">
        <tbody>
          {rows.map(([k, v, note]) => (
            <tr key={k}>
              <th style={{ width: 200, borderBottom: '1px solid var(--line)' }}>{k}</th>
              <td>
                {v}
                {note && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 5 }}>{note}</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontFamily: 'var(--font-c)', fontWeight: 700, textTransform: 'uppercase' as const, fontSize: 25, margin: '38px 0 14px' }}>
        Priced inventory
      </h2>
      <table className="tbl">
        <thead>
          <tr><th>Code</th><th>Track</th><th>Label</th><th className="r">Price</th><th className="r">Capacity</th></tr>
        </thead>
        <tbody>
          {spaces.map((s) => (
            <tr key={s.id}>
              <td>{s.code}</td>
              <td style={{ textTransform: 'capitalize' }}>{s.track}</td>
              <td>{s.label}<div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.description}</div></td>
              <td className="r">{usd(s.priceCents)}</td>
              <td className="r">{s.capacity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
