'use client'

import { useActionState } from 'react'
import { pushToSheet } from './actions'
import { emptyPush, type PushState } from './state'

/**
 * One field and one button: the link to the sheet, and Send.
 *
 * The field takes the whole URL out of the address bar rather than the id in
 * the middle of it, because asking somebody to find the id is asking for a
 * mistake at nine in the morning.
 */
export function PushForm({ defaultLink }: { defaultLink: string }) {
  const [state, action, pending] = useActionState<PushState, FormData>(pushToSheet, {
    ...emptyPush, link: defaultLink,
  })

  return (
    <form action={action}>
      <div className="adm-field">
        <label className="lb" htmlFor="link">The sheet to write into</label>
        <input
          className="inp" id="link" name="link" type="url" required
          defaultValue={state.link || defaultLink}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          aria-describedby="link-help"
        />
        <span className="hint" id="link-help">
          Open the sheet and copy the address out of the bar. Both tabs are made if they are
          not there, and replaced if they are, so nothing is ever written twice.
        </span>
      </div>

      <div className="adm-acts">
        <button className="adm-btn" type="submit" disabled={pending}>
          {pending ? 'Writing' : 'Send the tabs'}
        </button>
      </div>

      <p role="status" aria-live="polite" className="adm-note" style={{ marginTop: 18 }}>
        {state.message}
      </p>
    </form>
  )
}
