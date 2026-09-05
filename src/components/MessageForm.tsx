'use client'

import { useActionState } from 'react'
import { sendMessage, type FormState } from '@/app/actions'

const initial: FormState = { ok: false }

/**
 * The three-field contact form the live site runs on /pages/contact and
 * /pages/collaborate. Same fields, same order, same button.
 *
 * `topic` only changes the subject line on the message that lands in the
 * inbox, so one form serves both pages.
 */
export function MessageForm({ topic }: { topic?: 'contact' | 'collaborate' }) {
  const [state, action, pending] = useActionState(sendMessage, initial)
  const e = state.errors ?? {}
  const v = state.values ?? {}

  if (state.ok) {
    return (
      <p className="sent" role="status">{state.message}</p>
    )
  }

  return (
    <form key={state.attempt ?? 0} action={action} className="cform" noValidate>
      <input type="hidden" name="topic" value={topic ?? 'contact'} />

      <label className="field" htmlFor="cf-name">
        <span className="lb">Name</span>
        <input className="inp" id="cf-name" name="name" required defaultValue={v.name ?? ''} />
        {e.name && <span className="err">{e.name}</span>}
      </label>

      <label className="field" htmlFor="cf-email">
        <span className="lb">Email</span>
        <input
          className="inp" id="cf-email" name="email" type="email" required
          defaultValue={v.email ?? ''} aria-invalid={e.email ? 'true' : undefined}
        />
        {e.email && <span className="err">{e.email}</span>}
      </label>

      <label className="field" htmlFor="cf-message">
        <span className="lb">Message</span>
        <textarea
          className="inp" id="cf-message" name="message" required maxLength={4000}
          style={{ minHeight: 150 }} defaultValue={v.message ?? ''}
        />
        {e.message && <span className="err">{e.message}</span>}
      </label>

      <button className="btn" type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send'}
      </button>
    </form>
  )
}
