import { eq, asc } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow, activeAddOns } from '@/db/queries'
import { spaceTypes } from '@/db/schema'
import { SettingsForm } from './SettingsForm'
import { updateSpace, updateAddOn } from '@/app/actions'
import { fmtDate, fmtDateTime, fmtRange, applicationWindow } from '@/lib/dates'
import { bpsLabel, usd } from '@/lib/money'
import { PageHead, Stats, Stat } from '../ui'

export const dynamic = 'force-dynamic'

/** Column tracks shared by a header row and every editable row beneath it. */
const SPACE_COLS = { '--cols': '76px 66px 1fr 1.7fr 106px 84px 72px' } as React.CSSProperties
const ADDON_COLS = { '--cols': '92px 66px 1fr 1.7fr 106px 96px 72px' } as React.CSSProperties

const WINDOW_LABEL = {
  before: 'Applications have not opened yet',
  open: 'Applications are open',
  closed: 'Applications are closed',
} as const

/**
 * The one record everything reads (CLAUDE.md rule 6): every date, price,
 * capacity, and rate the public site and the jury render comes from here.
 * Edits are audit-logged; commission changes never touch existing bookings.
 *
 * It reads as an instrument panel: the live values first, in the shapes they
 * take on the public site, then the controls that set them, grouped in the
 * order someone setting up a season works.
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
  const windowState = applicationWindow(show.applicationsOpenAt, show.applicationsCloseAt)

  /* Read-only because nothing edits them: the identity of a season is set
     when the show is created, and the slug is a live URL. */
  const identity: Array<{ k: string; v: React.ReactNode }> = [
    { k: 'Show', v: `${show.numeral} · ${show.name}` },
    { k: 'Season', v: `${show.season === 'fall' ? 'Fall' : 'Spring'} ${show.year}` },
    { k: 'Venue', v: `${show.venueName}, ${show.venueAddress}` },
    { k: 'Slug', v: <span className="mono">{show.slug}</span> },
    {
      k: 'Status',
      v: show.isActive ? 'Active. This is the show the public site renders.' : 'Not active.',
    },
  ]

  return (
    <div className="adm-narrow">
      <PageHead
        title="Show settings"
        sub={`${show.numeral} · ${show.name} · ${fmtRange(show.startsOn, show.endsOn)} · ${WINDOW_LABEL[windowState].toLowerCase()}`}
      />

      <p className="adm-note">
        Every date, price, capacity and rate on the public site is read from this record, so
        nothing here is typed into a page anywhere else. Changes apply immediately and are
        audit-logged.
      </p>

      {/* The readouts are the values as the public site renders them, not as
          the database stores them, so a wrong date is visible before anyone
          has to read a form field. */}
      <Stats>
        <Stat
          label="Show dates" icon="clock" text value={fmtRange(show.startsOn, show.endsOn)}
          note="The hero, the masthead banner and the calendar file."
        />
        <Stat
          label="Applications open" icon="queue" text value={fmtDateTime(show.applicationsOpenAt)}
          note={`Close ${fmtDateTime(show.applicationsCloseAt)}, Pacific.`}
        />
        <Stat
          label="Roster announced" icon="roster" text value={fmtDate(show.rosterAnnouncedOn)}
          note="The promise on /apply and in every waitlist email."
        />
        <Stat
          label="Commission" icon="money" value={bpsLabel(show.commissionBps)}
          note="Indoor consignment. Snapshotted onto each booking at acceptance."
        />
        <Stat
          label="Payment window" icon="clock" value={show.paymentWindowHours} unit="hours"
          note="From acceptance until the space returns to the pool."
        />
        <Stat
          label="Capacity" icon="tent" value={show.indoorCapacity + show.outdoorCapacity} unit="spaces"
          note={`${show.indoorCapacity} indoor, ${show.outdoorCapacity} outdoor.`}
        />
      </Stats>

      <div className="adm-sec">
        <h2>Identity</h2>
        <span className="c">Set when the show is created</span>
      </div>
      <dl className="adm-facts">
        {identity.map((f) => (
          <div key={f.k}>
            <dt>{f.k}</dt>
            <dd>{f.v}</dd>
          </div>
        ))}
      </dl>

      <div className="adm-sec">
        <h2>Settings</h2>
        <span className="c">Every field drives a public page</span>
      </div>
      <SettingsForm show={show} />

      <div className="adm-sec">
        <h2>Priced inventory</h2>
        <span className="c">
          {spaces.length} {spaces.length === 1 ? 'space' : 'spaces'}
        </span>
      </div>
      <p className="adm-note tight">
        The prices quoted on <strong>/apply</strong>, both maker rules pages and the home page. A
        price edit changes what future applicants are quoted; an accepted booking keeps the price
        it was promised. Codes and tracks are fixed. Save applies one row.
      </p>
      {spaces.length > 0 && (
        <p className="adm-note">
          Indoor spaces total <strong>{spaceCap('indoor')}</strong> against a show capacity of{' '}
          <strong>{show.indoorCapacity}</strong>, outdoor <strong>{spaceCap('outdoor')}</strong>
          {' '}against <strong>{show.outdoorCapacity}</strong>. Full board at today&rsquo;s prices is{' '}
          <strong>{usd(spaces.reduce((n, s) => n + s.priceCents * s.capacity, 0))}</strong>.
        </p>
      )}
      <div className="adm-rows" style={SPACE_COLS}>
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
            <button className="adm-btn-q" type="submit">
              Save<span className="adm-sr"> {s.code}</span>
            </button>
          </form>
        ))}
      </div>

      <div className="adm-sec">
        <h2>Add-ons</h2>
        <span className="c">{extras.length} offered</span>
      </div>
      <p className="adm-note">
        What a maker can ask for on top of a space, priced on the application and on the rules
        pages. Same rule as above: an edit changes what future applicants are quoted, never what an
        accepted maker was promised. &ldquo;Limited&rdquo; shows as LMTD.
      </p>
      {extras.length === 0 ? (
        <p className="adm-empty">
          No add-ons for this show yet. They are seeded with the show; if this is unexpected,
          migration 0002 has not run against this database.
        </p>
      ) : (
        <div className="adm-rows" style={ADDON_COLS}>
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
              <label className="lim">
                <input type="checkbox" name="isLimited" defaultChecked={a.isLimited} />
                Limited
              </label>
              <button className="adm-btn-q" type="submit">
                Save<span className="adm-sr"> {a.code}</span>
              </button>
            </form>
          ))}
        </div>
      )}

      <div className="adm-foot">
        <p className="adm-note">
          <strong>Every edit is audit-logged</strong> with the actor, the timestamp and the before
          and after values.
        </p>
        <p className="adm-note">
          <strong>Commission changes apply to future acceptances only.</strong> A booking
          snapshots its rate at acceptance and keeps it for the life of the show.
        </p>
      </div>
    </div>
  )
}
