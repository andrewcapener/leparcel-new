import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { shows, spaceTypes } from '@/db/schema'
import { SettingsForm } from './SettingsForm'
import { updateSpace } from '@/app/actions'

export const dynamic = 'force-dynamic'

/**
 * The one record everything reads (CLAUDE.md rule 6): every date, price,
 * capacity, and rate the public site and the jury render comes from here.
 * Edits are audit-logged; commission changes never touch existing bookings.
 */
export default async function ShowSettings() {
  const show = await activeShow()
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
        Price edits change what future applicants are quoted; accepted bookings keep the price
        they were promised. Codes and tracks are fixed.
      </p>
      <div style={{ display: 'grid', gap: 0, borderTop: '2px solid var(--ink)' }}>
        {spaces.map((s) => (
          <form action={updateSpace} key={s.id}
            style={{ display: 'grid', gridTemplateColumns: '90px 80px 1.2fr 1.6fr 110px 90px auto',
              gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
            <input type="hidden" name="id" value={s.id} />
            <span style={{ fontFamily: 'var(--font-c)', fontWeight: 600, fontSize: 13, letterSpacing: '.05em' }}>{s.code}</span>
            <span style={{ textTransform: 'capitalize', fontSize: 13, color: 'var(--ink-2)' }}>{s.track}</span>
            <input className="inp" name="label" defaultValue={s.label} aria-label="Label" style={{ padding: '7px 10px', fontSize: 14 }} />
            <input className="inp" name="description" defaultValue={s.description} aria-label="Description" style={{ padding: '7px 10px', fontSize: 13 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>$</span>
              <input className="inp num" name="price" type="number" min={0} step={5}
                defaultValue={s.priceCents / 100} aria-label="Price in dollars" style={{ padding: '7px 10px', fontSize: 14 }} />
            </div>
            <input className="inp num" name="capacity" type="number" min={0}
              defaultValue={s.capacity} aria-label="Capacity" style={{ padding: '7px 10px', fontSize: 14 }} />
            <button className="btn-o" type="submit">Save</button>
          </form>
        ))}
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 10 }}>
        Price · capacity per row. Save applies that row only.
      </p>
    </div>
  )
}
