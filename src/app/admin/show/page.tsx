import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { shows, spaceTypes } from '@/db/schema'
import { usd } from '@/lib/money'
import { SettingsForm } from './SettingsForm'

export const dynamic = 'force-dynamic'

/**
 * The one record everything reads (CLAUDE.md rule 6): every date, price,
 * capacity, and rate the public site and the jury render comes from here.
 * Edits are audit-logged; commission changes never touch existing bookings.
 */
export default async function ShowSettings() {
  const show = await db.query.shows.findFirst({ where: eq(shows.isActive, true) })
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')
  const spaces = await db.query.spaceTypes.findMany({
    where: eq(spaceTypes.showId, show.id),
    orderBy: [asc(spaceTypes.sortOrder)],
  })

  return (
    <div style={{ padding: '26px 26px 80px', maxWidth: 900 }}>
      <h1 style={{ fontFamily: 'var(--font-c)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.012em', fontSize: 34, marginBottom: 8 }}>
        Show settings · {show.numeral} · {show.name}
      </h1>
      <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 26, maxWidth: 72 + 'ch' }}>
        Everything the public site renders (dates, prices, the commission rate, the application
        window) is read from this record. Changes apply immediately and are audit-logged.
      </p>

      <SettingsForm show={show} />

      <h2 style={{ fontFamily: 'var(--font-c)', fontWeight: 700, textTransform: 'uppercase' as const, fontSize: 25, margin: '44px 0 14px' }}>
        Priced inventory
      </h2>
      <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14, maxWidth: 72 + 'ch' }}>
        Read-only for now. Space prices are quoted to applicants and snapshotted onto bookings,
        so editing them mid-window needs more care than a text field.
      </p>
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
