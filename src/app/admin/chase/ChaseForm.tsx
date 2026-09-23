'use client'

import { useActionState, useState } from 'react'
import { scheduleChase } from './actions'
import { emptyChase, type ChaseState } from './state'

export type Row = {
  bookingId: string
  code: string
  shop: string
  contact: string
  email: string
  track: string
  space: string
  fee: string
  /** Already had one of these in the last day. */
  already: boolean
}

/**
 * The list, ticked, and the time it arrives.
 *
 * Everybody who would be mailed is on the screen with their own fee beside
 * their own address, and every one of them is a checkbox. That is the whole
 * design: the person pressing the button reads the list first, and anybody
 * who should not be on it comes off without a code change.
 *
 * Nothing is preselected that already had one today. A maker who got this an
 * hour ago should not get it again because somebody refreshed.
 */
export function ChaseForm({ rows, defaultAt }: { rows: Row[]; defaultAt: string }) {
  const [state, action, pending] = useActionState<ChaseState, FormData>(scheduleChase, emptyChase)
  const [ticked, setTicked] = useState<Set<string>>(
    () => new Set(rows.filter((r) => !r.already).map((r) => r.bookingId)),
  )

  const on = (id: string) => ticked.has(id)
  const toggle = (id: string) => setTicked((s) => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const chosen = rows.filter((r) => on(r.bookingId))
  const owed = chosen.reduce((n, r) => n + Number(r.fee.replace(/[^0-9.]/g, '')), 0)

  return (
    <form action={action}>
      <div className="adm-strip">
        <button className="adm-btn-q" type="button"
          onClick={() => setTicked(new Set(rows.map((r) => r.bookingId)))}>
          Tick everyone
        </button>
        <button className="adm-btn-q" type="button" onClick={() => setTicked(new Set())}>
          Untick everyone
        </button>
      </div>

      <table className="adm-tbl adm-tbl--tight">
        <thead>
          <tr>
            <th scope="col"><span className="adm-sr">Send</span></th>
            <th scope="col">ID</th>
            <th scope="col">Shop</th>
            <th scope="col">Goes to</th>
            <th scope="col">Space</th>
            <th scope="col">Fee</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.bookingId} style={on(r.bookingId) ? undefined : { opacity: 0.45 }}>
              <td>
                <input
                  type="checkbox" name="send" value={r.bookingId}
                  checked={on(r.bookingId)} onChange={() => toggle(r.bookingId)}
                  aria-label={`Email ${r.shop}`}
                />
              </td>
              <td className="mono">{r.code}</td>
              <td className="adm-nm">
                {r.shop}
                <span className="adm-sub2">{r.contact}</span>
                {r.already && <span className="adm-tag">had one today</span>}
              </td>
              <td className="mono">{r.email}</td>
              <td>{r.track} {r.space}</td>
              <td className="adm-money">{r.fee}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="adm-sec"><h2>When it arrives</h2></div>
      <div className="adm-field">
        <label className="lb" htmlFor="at">Date and time, Pacific</label>
        <input
          className="inp" id="at" name="at" type="datetime-local" required
          defaultValue={state.at || defaultAt} aria-describedby="at-help"
        />
        <span className="hint" id="at-help">
          Resend holds these and delivers them at this time. Nothing on our side has to be
          running, and nobody has to be awake.
        </span>
      </div>

      <div className="adm-acts">
        <button className="adm-btn" type="submit" disabled={pending || chosen.length === 0}>
          {pending
            ? 'Handing them to Resend'
            : `Schedule ${chosen.length} ${chosen.length === 1 ? 'email' : 'emails'}`}
        </button>
      </div>

      <p className="adm-note" role="status" aria-live="polite">
        {state.message
          || `${chosen.length} ticked, $${owed.toLocaleString('en-US')} between them.`}
      </p>
    </form>
  )
}
