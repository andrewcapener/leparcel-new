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
    <label className="field" htmlFor={name}>
      <span className="lb">{label}</span>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="err">{error}</span>}
    </label>
  )
}

export function SettingsForm({ show }: { show: Show }) {
  const [state, action, pending] = useActionState(updateShow, initial)
  const e = state.errors ?? {}
  const v = state.values ?? {}
  const keep = (k: string, fallback: string) => ({ defaultValue: v[k] ?? fallback })

  return (
    <form key={state.attempt ?? 0} action={action} style={{ maxWidth: 680 }} noValidate>
      {state.message && (
        <p className={state.ok ? 'hint' : 'err'} style={{ marginBottom: 20, fontSize: 'var(--t-s)' }}>
          {state.ok ? `${state.message} The public site updates immediately.` : state.message}
        </p>
      )}

      <div className="k" style={{ marginBottom: 18 }}>Venue</div>
      <div className="row2">
        <Field name="venueName" label="Venue name" error={e.venueName}>
          <input className="inp" id="venueName" name="venueName" required {...keep('venueName', show.venueName)} />
        </Field>
        <Field name="venueAddress" label="Address" error={e.venueAddress}>
          <input className="inp" id="venueAddress" name="venueAddress" required {...keep('venueAddress', show.venueAddress)} />
        </Field>
      </div>

      <div className="k" style={{ margin: '30px 0 18px' }}>Dates · all times Pacific</div>
      <div className="row2">
        <Field name="startsOn" label="Show starts" error={e.startsOn}>
          <input className="inp" id="startsOn" name="startsOn" type="datetime-local" required {...keep('startsOn', isoToLaWall(show.startsOn))} />
        </Field>
        <Field name="endsOn" label="Show ends" error={e.endsOn}>
          <input className="inp" id="endsOn" name="endsOn" type="datetime-local" required {...keep('endsOn', isoToLaWall(show.endsOn))} />
        </Field>
      </div>
      <Field name="hoursNote" label="Hours, as shown to shoppers" error={e.hoursNote}>
        <input className="inp" id="hoursNote" name="hoursNote" required {...keep('hoursNote', show.hoursNote)} />
      </Field>
      <div className="row2">
        <Field
          name="loadInNote" label="Load-in, as shown to makers" error={e.loadInNote}
          hint="Appears on the indoor rules page. Prose, e.g. “Thursday 12 November, 1-7pm”."
        >
          <input className="inp" id="loadInNote" name="loadInNote" {...keep('loadInNote', show.loadInNote)} />
        </Field>
        <Field name="takedownNote" label="Take-down, as shown to makers" error={e.takedownNote}>
          <input className="inp" id="takedownNote" name="takedownNote" {...keep('takedownNote', show.takedownNote)} />
        </Field>
      </div>
      <div className="row2">
        <Field name="applicationsOpenAt" label="Applications open" error={e.applicationsOpenAt}>
          <input className="inp" id="applicationsOpenAt" name="applicationsOpenAt" type="datetime-local" required {...keep('applicationsOpenAt', isoToLaWall(show.applicationsOpenAt))} />
        </Field>
        <Field name="applicationsCloseAt" label="Applications close" error={e.applicationsCloseAt}>
          <input className="inp" id="applicationsCloseAt" name="applicationsCloseAt" type="datetime-local" required {...keep('applicationsCloseAt', isoToLaWall(show.applicationsCloseAt))} />
        </Field>
      </div>
      <Field name="rosterAnnouncedOn" label="Roster announced" error={e.rosterAnnouncedOn}>
        <input className="inp" id="rosterAnnouncedOn" name="rosterAnnouncedOn" type="datetime-local" required {...keep('rosterAnnouncedOn', isoToLaWall(show.rosterAnnouncedOn))} />
      </Field>

      <div className="k" style={{ margin: '30px 0 18px' }}>Money &amp; capacity</div>
      <div className="row2">
        <Field
          name="commissionPct" label="Commission (%)" error={e.commissionPct}
          hint="Applies to future acceptances only. Existing bookings keep the rate they were promised."
        >
          <input className="inp" id="commissionPct" name="commissionPct" type="number" step="0.25" min="0" max="50" required {...keep('commissionPct', String(show.commissionBps / 100))} />
        </Field>
        <Field
          name="paymentWindowHours" label="Payment window (hours)" error={e.paymentWindowHours}
          hint="How long an accepted maker has to pay before the space returns to the pool."
        >
          <input className="inp" id="paymentWindowHours" name="paymentWindowHours" type="number" min="1" max="240" required {...keep('paymentWindowHours', String(show.paymentWindowHours))} />
        </Field>
      </div>
      <div className="row2">
        <Field name="indoorCapacity" label="Indoor capacity" error={e.indoorCapacity}>
          <input className="inp" id="indoorCapacity" name="indoorCapacity" type="number" min="0" required {...keep('indoorCapacity', String(show.indoorCapacity))} />
        </Field>
        <Field name="outdoorCapacity" label="Outdoor capacity" error={e.outdoorCapacity}>
          <input className="inp" id="outdoorCapacity" name="outdoorCapacity" type="number" min="0" required {...keep('outdoorCapacity', String(show.outdoorCapacity))} />
        </Field>
      </div>

      <button className="btn" type="submit" disabled={pending} style={{ marginTop: 8 }}>
        {pending ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  )
}
