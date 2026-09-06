'use client'

import { useActionState } from 'react'
import { updateShow, type FormState } from '@/app/actions'
import type { Show } from '@/db/schema'
import { isoToLaWall } from '@/lib/dates'

const initial: FormState = { ok: false }

function Field({
  name, label, hint, error, children,
}: {
  name: string; label: string; hint?: string; error?: string; children: React.ReactNode
}) {
  return (
    <label className="adm-field" htmlFor={name}>
      <span className="lb">{label}</span>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="err">{error}</span>}
    </label>
  )
}

/**
 * One block of the form: a legend, a line saying which public surfaces the
 * block drives, a hairline, then the fields. Grouped rather than flat because
 * someone changing a date should not have to read past the commission rate to
 * find it, and because a real fieldset is what a screen reader needs to
 * announce "Dates and hours, Show starts" instead of just "Show starts".
 */
function Block({
  legend, why, children,
}: {
  legend: string; why: string; children: React.ReactNode
}) {
  return (
    <fieldset className="adm-fs">
      <legend className="k">{legend}</legend>
      <p className="why">{why}</p>
      {children}
    </fieldset>
  )
}

export function SettingsForm({ show }: { show: Show }) {
  const [state, action, pending] = useActionState(updateShow, initial)
  const e = state.errors ?? {}
  const v = state.values ?? {}
  const keep = (k: string, fallback: string) => ({ defaultValue: v[k] ?? fallback })
  const problems = Object.keys(e).length

  return (
    <form key={state.attempt ?? 0} action={action} style={{ maxWidth: 720 }} noValidate>
      <Block
        legend="Venue"
        why="The home page venue block, the site footer, /schedule, /apply, and the address written into the add to calendar file."
      >
        <div className="adm-row2">
          <Field
            name="venueName" label="Venue name" error={e.venueName}
            hint="Rendered after “Dana Point” in the footer and the masthead line."
          >
            <input className="inp" id="venueName" name="venueName" required {...keep('venueName', show.venueName)} />
          </Field>
          <Field
            name="venueAddress" label="Address" error={e.venueAddress}
            hint="One line, as it should read on a phone map."
          >
            <input className="inp" id="venueAddress" name="venueAddress" required {...keep('venueAddress', show.venueAddress)} />
          </Field>
        </div>
      </Block>

      <Block
        legend="Dates and hours · all times Pacific"
        why="The hero dates, the masthead banner, /schedule, the calendar file, and the run of show on both maker pages."
      >
        <div className="adm-row2">
          <Field
            name="startsOn" label="Show starts" error={e.startsOn}
            hint="First public hour of the show, not load-in."
          >
            <input className="inp" id="startsOn" name="startsOn" type="datetime-local" required {...keep('startsOn', isoToLaWall(show.startsOn))} />
          </Field>
          <Field
            name="endsOn" label="Show ends" error={e.endsOn}
            hint="Last public hour. The hero renders the two as one range."
          >
            <input className="inp" id="endsOn" name="endsOn" type="datetime-local" required {...keep('endsOn', isoToLaWall(show.endsOn))} />
          </Field>
        </div>
        <Field
          name="hoursNote" label="Hours, as shown to shoppers" error={e.hoursNote}
          hint="One day per segment, separated by “ · ”. Five pages split on that separator, so keep it."
        >
          <input className="inp" id="hoursNote" name="hoursNote" required {...keep('hoursNote', show.hoursNote)} />
        </Field>
        <div className="adm-row2">
          <Field
            name="loadInNote" label="Load-in inside, as shown to makers" error={e.loadInNote}
            hint="The evening before the doors open. Appears on /makers/indoor, on /apply above the set-up times, and in the signed agreement. Prose, e.g. “Thursday 12 November, 1-7pm”."
          >
            <input className="inp" id="loadInNote" name="loadInNote" {...keep('loadInNote', show.loadInNote)} />
          </Field>
          <Field
            name="outdoorLoadInNote" label="Load-in outside, as shown to makers"
            error={e.outdoorLoadInNote}
            hint="Outside sets up the morning of the day they booked, so it gets its own line. Prose, e.g. “7am on your day”. The page adds the time the market opens, so do not type that here."
          >
            <input
              className="inp" id="outdoorLoadInNote" name="outdoorLoadInNote"
              {...keep('outdoorLoadInNote', show.outdoorLoadInNote)}
            />
          </Field>
          <Field
            name="takedownNote" label="Take-down, as shown to makers" error={e.takedownNote}
            hint="Same three pages. Left blank, they read “announced with your acceptance”."
          >
            <input className="inp" id="takedownNote" name="takedownNote" {...keep('takedownNote', show.takedownNote)} />
          </Field>
          <Field
            name="loadInSlots" label="Set-up time slots" error={e.loadInSlots}
            hint="Comma separated, e.g. “1-3pm, 3-5pm, 5-7pm”. Indoor makers pick from these on the application and staff build the arrival schedule from the answers. Left blank, the question is not asked."
          >
            <input className="inp" id="loadInSlots" name="loadInSlots" {...keep('loadInSlots', show.loadInSlots)} />
          </Field>
        </div>
      </Block>

      <Block
        legend="The application window"
        why="The banner across the top of every public page, whether /apply accepts a submission, and the date the confirmation email promises an answer by."
      >
        <div className="adm-row2">
          <Field
            name="applicationsOpenAt" label="Applications open" error={e.applicationsOpenAt}
            hint="Before this, /apply shows the date instead of the form."
          >
            <input className="inp" id="applicationsOpenAt" name="applicationsOpenAt" type="datetime-local" required {...keep('applicationsOpenAt', isoToLaWall(show.applicationsOpenAt))} />
          </Field>
          <Field
            name="applicationsCloseAt" label="Applications close" error={e.applicationsCloseAt}
            hint="Set the minute, not the day: 23:59 Pacific is what makers are told."
          >
            <input className="inp" id="applicationsCloseAt" name="applicationsCloseAt" type="datetime-local" required {...keep('applicationsCloseAt', isoToLaWall(show.applicationsCloseAt))} />
          </Field>
        </div>
        <Field
          name="rosterAnnouncedOn" label="Roster announced" error={e.rosterAnnouncedOn}
          hint="The promise on /apply, in the application form, on /merchants, and in every waitlist email."
        >
          <input className="inp" id="rosterAnnouncedOn" name="rosterAnnouncedOn" type="datetime-local" required {...keep('rosterAnnouncedOn', isoToLaWall(show.rosterAnnouncedOn))} />
        </Field>
      </Block>

      <Block
        legend="Money and capacity"
        why="The rate on /makers/indoor and on the application, the deadline in the acceptance email, and the space counts on both maker pages, /faq and the jury header."
      >
        <div className="adm-row2">
          <Field
            name="commissionPct" label="Commission (%)" error={e.commissionPct}
            hint="Applies to future acceptances only. Existing bookings keep the rate they were promised."
          >
            <input className="inp num" id="commissionPct" name="commissionPct" type="number" step="0.25" min="0" max="50" required {...keep('commissionPct', String(show.commissionBps / 100))} />
          </Field>
          <Field
            name="paymentWindowHours" label="Payment window (hours)" error={e.paymentWindowHours}
            hint="How long an accepted maker has to pay before the space returns to the pool."
          >
            <input className="inp num" id="paymentWindowHours" name="paymentWindowHours" type="number" min="1" max="240" required {...keep('paymentWindowHours', String(show.paymentWindowHours))} />
          </Field>
        </div>
        <div className="adm-row2">
          <Field
            name="indoorCapacity" label="Indoor capacity" error={e.indoorCapacity}
            hint="Spaces on the floor. The jury header counts committed bookings against this."
          >
            <input className="inp num" id="indoorCapacity" name="indoorCapacity" type="number" min="0" required {...keep('indoorCapacity', String(show.indoorCapacity))} />
          </Field>
          <Field
            name="outdoorCapacity" label="Outdoor capacity" error={e.outdoorCapacity}
            hint="Tents in the lot, counted the same way."
          >
            <input className="inp num" id="outdoorCapacity" name="outdoorCapacity" type="number" min="0" required {...keep('outdoorCapacity', String(show.outdoorCapacity))} />
          </Field>
        </div>
      </Block>

      {/* The bar rides the bottom of the window, so Save is reachable from any
          block and the result of the last save is where the eye already is. */}
      <div className="adm-save">
        <button className="adm-btn" type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save settings'}
        </button>
        <p className="msg" data-ok={state.ok ? '1' : '0'} role="status" aria-live="polite">
          {state.message
            ? (state.ok ? `${state.message} The public site updates immediately.` : state.message)
            : problems > 0
              ? `${problems} ${problems === 1 ? 'field needs' : 'fields need'} a look.`
              : ''}
        </p>
        <span className="drive">Saved changes are audit-logged</span>
      </div>
    </form>
  )
}
