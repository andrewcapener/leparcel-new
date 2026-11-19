'use client'

import { useActionState } from 'react'
import { planNextShow, activateShow, type FormState } from '@/app/actions'

export type Planned = {
  slug: string
  name: string
  isActive: boolean
  startsOn: string
}

/**
 * Plan the next season, and switch to it when you mean to.
 *
 * Two controls rather than one, because they are two decisions. Planning
 * April in November is housekeeping; making it live takes the public site
 * off the show you are still paying makers for. The build plan has wanted
 * this since the start ("spring 2027 show cloned from fall in one click")
 * and until now the only screen was this one, which edits the ACTIVE show
 * and would have rewritten Fall's record to hold April's dates.
 *
 * The form arrives prefilled from the season just gone: same weekday shape,
 * same lead time into the application window. Those are suggestions sitting
 * in editable fields, not decisions, which is the only honest way to offer a
 * default for something only Drew and Elise actually know.
 */
export function NextShowForm({
  suggestion, shows,
}: {
  suggestion: {
    season: 'spring' | 'fall'; year: number
    startsOn: string; endsOn: string
    applicationsOpenAt: string; applicationsCloseAt: string
    rosterAnnouncedOn: string
  }
  shows: Planned[]
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    planNextShow, { ok: false, attempt: 0 },
  )
  const e = state.errors ?? {}
  const keep = (name: string, fallback: string) => ({
    defaultValue: state.values?.[name] ?? fallback,
  })

  const planned = shows.filter((s) => !s.isActive)

  return (
    <section className="nxt">
      <h2 className="adm-h2">The next show</h2>

      <form key={state.attempt ?? 0} action={action} noValidate>
        <p className="adm-note nxt__lede">
          Copies this show's venue, prices, capacities, commission and load-in notes
          into a new record. <strong>Saving this announces it:</strong> the public site
          starts showing the new dates straight away, and the button above the fold
          becomes the waiting list until applications open. Your admin does not move.
          The roster, the jury, the statements and the payouts all stay on the show
          you are working now.
        </p>

        <div className="nxt__row">
          <label className="nxt__f">
            <span>Season</span>
            <select className="inp" name="season" {...keep('season', suggestion.season)}>
              <option value="spring">Spring</option>
              <option value="fall">Fall</option>
            </select>
            {e.season && <em className="nxt__e">{e.season}</em>}
          </label>
          <label className="nxt__f">
            <span>Year</span>
            <input className="inp" name="year" type="number" min={2024} max={2100}
              {...keep('year', String(suggestion.year))} />
            {e.year && <em className="nxt__e">{e.year}</em>}
          </label>
        </div>

        <div className="nxt__row">
          <label className="nxt__f">
            <span>First day</span>
            <input className="inp" name="startsOn" type="datetime-local"
              {...keep('startsOn', suggestion.startsOn)} />
            {e.startsOn && <em className="nxt__e">{e.startsOn}</em>}
          </label>
          <label className="nxt__f">
            <span>Last day</span>
            <input className="inp" name="endsOn" type="datetime-local"
              {...keep('endsOn', suggestion.endsOn)} />
            {e.endsOn && <em className="nxt__e">{e.endsOn}</em>}
          </label>
        </div>

        <div className="nxt__row">
          <label className="nxt__f">
            <span>Applications open</span>
            <input className="inp" name="applicationsOpenAt" type="datetime-local"
              {...keep('applicationsOpenAt', suggestion.applicationsOpenAt)} />
            {e.applicationsOpenAt && <em className="nxt__e">{e.applicationsOpenAt}</em>}
          </label>
          <label className="nxt__f">
            <span>Applications close</span>
            <input className="inp" name="applicationsCloseAt" type="datetime-local"
              {...keep('applicationsCloseAt', suggestion.applicationsCloseAt)} />
            {e.applicationsCloseAt && <em className="nxt__e">{e.applicationsCloseAt}</em>}
          </label>
        </div>

        <div className="nxt__row">
          <label className="nxt__f">
            <span>Roster announced</span>
            <input className="inp" name="rosterAnnouncedOn" type="datetime-local"
              {...keep('rosterAnnouncedOn', suggestion.rosterAnnouncedOn)} />
            {e.rosterAnnouncedOn && <em className="nxt__e">{e.rosterAnnouncedOn}</em>}
          </label>
          <div className="nxt__f nxt__go">
            <button className="adm-btn" type="submit" disabled={pending}>
              {pending ? 'Planning...' : 'Plan the next show'}
            </button>
          </div>
        </div>

        {state.message && (
          <p className={state.ok ? 'nxt__ok' : 'nxt__e'} role="status">{state.message}</p>
        )}
      </form>

      {planned.length > 0 && (
        <div className="nxt__list">
          <p className="adm-note nxt__warn">
            <strong>You almost certainly do not need this.</strong> The public site
            already announces the show above as soon as it is planned. This button is
            the other half: it moves the ADMIN onto it too, so the roster, the jury,
            the onboarding and the payout screens all start showing a show with
            nobody in it. Nothing is deleted and nothing is lost, but do not press it
            until the show you are working now is finished and paid out.
          </p>
          {planned.map((s) => (
            <form key={s.slug} action={activateShow} className="nxt__one">
              <input type="hidden" name="slug" value={s.slug} />
              <span className="nxt__nm">{s.name}</span>
              <span className="nxt__dt">{s.startsOn}</span>
              <button className="adm-btn-q" type="submit">
                Move the admin onto this show
              </button>
            </form>
          ))}
        </div>
      )}

      <style>{`
.nxt { margin-top: 34px; border-top: 1px solid var(--ad-line); padding-top: 22px }
.nxt__lede { max-width: 66ch }
.nxt__row { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 14px }
.nxt__f { flex: 1 1 220px; display: flex; flex-direction: column; gap: 5px;
  font-size: var(--t-s) }
.nxt__f > span { color: var(--ad-ink-3) }
.nxt__go { justify-content: flex-end }
.nxt__e { color: var(--ad-warn); font-style: normal; font-size: var(--t-s) }
.nxt__ok { color: var(--ad-ink); font-size: var(--t-s); margin-top: 12px }
.nxt__list { margin-top: 26px }
.nxt__warn { border-left: 2px solid var(--ad-warn); padding-left: 12px }
.nxt__one { display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 10px 0; border-top: 1px solid var(--ad-line) }
.nxt__nm { font-weight: 500 }
.nxt__dt { color: var(--ad-ink-3); font-size: var(--t-s) }
      `}</style>
    </section>
  )
}
