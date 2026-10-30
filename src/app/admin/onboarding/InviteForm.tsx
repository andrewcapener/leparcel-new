'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { sendOnboardingInvites } from './actions'
import type { Need } from '@/server/modules/email/onboarding-invite'

export type Row = {
  bookingId: string
  code: string | null
  shop: string
  contact: string
  email: string
  needs: Need[]
  items: number
  payouts: string | null
  /** Already had one of these at some point. */
  already: boolean
}

/**
 * The list, ticked, and the button that sends it.
 *
 * Same shape as the booth fee chase, for the same reason: the person pressing
 * the button reads the list first, with every address beside what that maker
 * is actually being asked for. Anybody who should not be on it comes off here
 * rather than in a code change.
 *
 * Nobody who has already had one is ticked. A second round a week later
 * should reach the people who did nothing, and reaching the rest again is a
 * deliberate act, not the default.
 */
function SendButton({ n }: { n: number }) {
  const { pending } = useFormStatus()
  return (
    <button className="adm-btn" type="submit" disabled={pending || n === 0}>
      {pending ? 'Sending' : n === 0 ? 'Nobody ticked' : `Send to ${n}`}
    </button>
  )
}

const WHAT: Record<string, string> = {
  not_started: 'not started',
  unfinished: 'unfinished',
  in_review: 'Stripe is checking',
  disabled: 'disabled',
  ready: 'ready',
}

export function InviteForm({
  rows, subjectBoth, lines,
}: {
  rows: Row[]
  subjectBoth: string
  lines: string[]
}) {
  const [ticked, setTicked] = useState<Set<string>>(
    () => new Set(rows.filter((r) => !r.already).map((r) => r.bookingId)),
  )
  const toggle = (id: string) => setTicked((s) => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  if (rows.length === 0) {
    return <p className="adm-note">Nobody needs this email right now.</p>
  }

  return (
    <form action={sendOnboardingInvites}>
      {/* Sending to one maker meant clearing forty one boxes by hand, and the
          one maker worth sending to first is yourself: a real send, through
          the real mail provider, before forty people get it. Drew, 30
          October, with the roster ready and no way to rehearse it. */}
      <p className="adm-pick">
        <button type="button" className="btn btn--quiet"
          onClick={() => setTicked(new Set(rows.map((r) => r.bookingId)))}>
          Tick everybody
        </button>
        <button type="button" className="btn btn--quiet"
          onClick={() => setTicked(new Set())}>
          Tick nobody
        </button>
        <span className="adm-sub2">
          {ticked.size} of {rows.length} ticked. Send one to yourself first.
        </span>
      </p>

      <table className="adm-tbl">
        <caption className="adm-sr">Makers who will receive this email</caption>
        <thead>
          <tr>
            <th scope="col" className="adm-sr">Send</th>
            <th scope="col">Maker</th>
            <th scope="col">Asked for</th>
            <th scope="col">Where they are</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.bookingId}>
              <td>
                <input
                  type="checkbox" name="send" value={r.bookingId}
                  checked={ticked.has(r.bookingId)}
                  onChange={() => toggle(r.bookingId)}
                  aria-label={`Send to ${r.shop}`}
                />
              </td>
              <td>
                <strong>{r.code ? `${r.code} ` : ''}{r.shop}</strong>
                <span className="adm-sub2"> {r.email}</span>
                {r.already && <span className="adm-sub2"> · had one already</span>}
              </td>
              <td>
                {r.needs.includes('items') && 'Inventory'}
                {r.needs.length === 2 && ' and '}
                {r.needs.includes('payouts') && 'Payouts'}
              </td>
              <td className="adm-sub2">
                {r.items} {r.items === 1 ? 'line' : 'lines'}
                {r.payouts ? ` · payouts ${WHAT[r.payouts] ?? r.payouts}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="adm-note">
        <label>
          <input type="checkbox" name="again" value="1" />{' '}
          Send to people who have already had one of these
        </label>
      </p>

      <p className="adm-note">
        <SendButton n={ticked.size} />
      </p>

      <h2 className="adm-h2">What arrives</h2>
      <p className="adm-note">
        A maker who owes only one of the two gets a shorter version naming only
        that one. This is the full version.
      </p>
      <div className="adm-preview">
        <p><strong>{subjectBoth}</strong></p>
        <ul>{lines.map((l) => <li key={l}>{l}</li>)}</ul>
        <p>Open your account</p>
      </div>
    </form>
  )
}
