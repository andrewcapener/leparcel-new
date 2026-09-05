'use client'

import { useActionState } from 'react'
import { subscribe, type FormState } from '@/app/actions'

const initial: FormState = { ok: false }

export function SubscribeForm({ fine, compact }: { fine?: string; compact?: boolean }) {
  const [state, action, pending] = useActionState(subscribe, initial)

  if (state.ok) {
    return (
      <div>
        <p style={{ fontFamily: 'var(--font-g)', fontSize: 21, lineHeight: 1.4 }}>
          {state.message}
        </p>
      </div>
    )
  }

  return (
    <form action={action} className={compact ? 'subf compact' : undefined}>
      <div className="f">
        <input
          type="email"
          name="email"
          required
          placeholder="your@email.com"
          aria-label="Email address"
          aria-invalid={state.errors?.email ? 'true' : undefined}
        />
        <button className="go" type="submit" disabled={pending}
          style={{ background: 'none', border: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
          {pending ? 'Joining…' : 'Join →'}
        </button>
      </div>
      {state.errors?.email && <span className="err">{state.errors.email}</span>}
      {fine && <div className="fine">{fine}</div>}
    </form>
  )
}
