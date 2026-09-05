import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow, activeAddOns } from '@/db/queries'
import { spaceTypes } from '@/db/schema'
import { SettingsForm } from './SettingsForm'
import { updateSpace, updateAddOn } from '@/app/actions'
import { fmtRange } from '@/lib/dates'

export const dynamic = 'force-dynamic'

/** Column tracks shared by a header row and every editable row beneath it. */
const SPACE_COLS = { '--op-cols': '96px 78px 1.15fr 1.6fr 112px 92px auto' } as React.CSSProperties
const ADDON_COLS = { '--op-cols': '112px 78px 1.15fr 1.6fr 112px 104px auto' } as React.CSSProperties

/**
 * The one record everything reads (CLAUDE.md rule 6): every date, price,
 * capacity, and rate the public site and the jury render comes from here.
 * Edits are audit-logged; commission changes never touch existing bookings.
 *
 * Laid out in four blocks, in the order someone setting up a season works:
 * what the show is, what it costs and when, then the priced inventory.
 */
export default async function ShowSettings() {
  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')
  const spaces = await db.query.spaceTypes.findMany({
    where: eq(spaceTypes.showId, show.id),
    orderBy: [asc(spaceTypes.sortOrder)],
  })
  // Migration-tolerant: an environment that has not run 0002 yet has no
  // add_ons table, and the rest of this page still has to render.
  const extras = await activeAddOns(show.id)

  const spaceCap = (track: 'indoor' | 'outdoor') =>
    spaces.filter((s) => s.track === track).reduce((n, s) => n + s.capacity, 0)

  /* Read-only because nothing edits them: the identity of a season is set
     when the show is created, and the slug is a live URL. */
  const identity: Array<{ k: string; v: React.ReactNode }> = [
    { k: 'Show', v: `${show.numeral} · ${show.name}` },
    { k: 'Season', v: `${show.season === 'fall' ? 'Fall' : 'Spring'} ${show.year}` },
    { k: 'Dates', v: fmtRange(show.startsOn, show.endsOn) },
    { k: 'Slug', v: <code>{show.slug}</code> },
    { k: 'Status', v: show.isActive ? 'Active. This is the show the public site renders.' : 'Not active.' },
  ]

  return (
    <div style={{ padding: '26px 26px 80px', maxWidth: 980 }}>
      <header className="op-head">
        <h1>Show settings · {show.numeral} · {show.name}</h1>
        <p className="lede">
          The single source of truth. Every date, price, capacity and rate on the public site is
          read from this record, so nothing here is typed into a page anywhere else. Changes
          apply immediately and are audit-logged.
        </p>
      </header>

      <div className="op-sec" style={{ marginTop: 0 }}>
        <h2>Identity</h2>
        <span className="c">Set at creation</span>
      </div>
      <dl className="op-facts" style={{ marginBottom: 12 }}>
        {identity.map((f) => (
          <div key={f.k}>
            <dt>{f.k}</dt>
            <dd>{f.v}</dd>
          </div>
        ))}
      </dl>
      <p className="op-note">
        The dates come from the Dates block below. The rest is fixed for the life of the show.
      </p>

      <div className="op-sec">
        <h2>Settings</h2>
        <span className="c">Every field below drives a public page</span>
      </div>
      <SettingsForm show={show} />

      <div className="op-sec">
        <h2>Priced inventory</h2>
        <span className="c">{spaces.length} spaces</span>
      </div>
      <p className="op-note" style={{ marginBottom: 16 }}>
        The prices quoted on <strong>/apply</strong>, both maker rules pages and the home page.
        A price edit changes what future applicants are quoted; an accepted booking keeps the
        price it was promised. Codes and tracks are fixed. Save applies one row.
        {spaces.length > 0 && (
          <> Indoor spaces total <strong>{spaceCap('indoor')}</strong> against a show capacity of{' '}
            {show.indoorCapacity}, outdoor <strong>{spaceCap('outdoor')}</strong> against{' '}
            {show.outdoorCapacity}.</>
        )}
      </p>
      <div className="op-rows" style={SPACE_COLS}>
        <div className="hd" aria-hidden="true">
          <span className="k">Code</span>
          <span className="k">Track</span>
          <span className="k">Label</span>
          <span className="k">What it suits</span>
          <span className="k">Price</span>
          <span className="k">Capacity</span>
          <span />
        </div>
        {spaces.map((s) => (
          <form action={updateSpace} key={s.id}>
            <input type="hidden" name="id" value={s.id} />
            <span className="cd">{s.code}</span>
            <span className="tk">{s.track}</span>
            <input className="inp" name="label" defaultValue={s.label} aria-label={`Label for ${s.code}`} />
            <input className="inp" name="description" defaultValue={s.description} aria-label={`What ${s.code} suits`} />
            <div className="mny">
              <span aria-hidden="true">$</span>
              <input className="inp num" name="price" type="number" min={0} step={5}
                defaultValue={s.priceCents / 100} aria-label={`Price of ${s.code} in dollars`} />
            </div>
            <input className="inp num" name="capacity" type="number" min={0}
              defaultValue={s.capacity} aria-label={`Capacity of ${s.code}`} />
            <button className="btn-o" type="submit">Save</button>
          </form>
        ))}
      </div>

      <div className="op-sec">
        <h2>Add-ons</h2>
        <span className="c">{extras.length} offered</span>
      </div>
      <p className="op-note" style={{ marginBottom: 16 }}>
        What a maker can ask for on top of a space, priced on the application and on the rules
        pages. Same rule as above: an edit changes what future applicants are quoted, never what
        an accepted maker was promised. &ldquo;Limited&rdquo; shows as LMTD.
      </p>
      {extras.length === 0 ? (
        <p style={{ fontSize: 'var(--t-s)', color: 'var(--ink-2)' }}>
          No add-ons for this show yet. They are seeded with the show; if this is
          unexpected, migration 0002 has not run against this database.
        </p>
      ) : (
        <div className="op-rows" style={ADDON_COLS}>
          <div className="hd" aria-hidden="true">
            <span className="k">Code</span>
            <span className="k">Track</span>
            <span className="k">Name</span>
            <span className="k">Description</span>
            <span className="k">Price</span>
            <span className="k">Limited</span>
            <span />
          </div>
          {extras.map((a) => (
            <form action={updateAddOn} key={a.id}>
              <input type="hidden" name="id" value={a.id} />
              <span className="cd">{a.code}</span>
              <span className="tk">{a.track ?? 'both'}</span>
              <input className="inp" name="name" defaultValue={a.name} aria-label={`Name of ${a.code}`} />
              <input className="inp" name="description" defaultValue={a.description} aria-label={`Description of ${a.code}`} />
              <div className="mny">
                <span aria-hidden="true">$</span>
                <input className="inp num" name="price" type="number" min={0} step={5}
                  defaultValue={a.priceCents / 100} aria-label={`Price of ${a.code} in dollars`} />
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--t-lbl)' }}>
                <input type="checkbox" name="isLimited" defaultChecked={a.isLimited} />
                Limited
              </label>
              <button className="btn-o" type="submit">Save</button>
            </form>
          ))}
        </div>
      )}
    </div>
  )
}
