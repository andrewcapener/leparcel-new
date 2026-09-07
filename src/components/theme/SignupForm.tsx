'use client'

import { useActionState } from 'react'
import { subscribe, type FormState } from '@/app/actions'

const initial: FormState = { ok: false }

/**
 * The footer newsletter form, in their `signup-form` markup. Theirs posts to
 * Shopify's customer endpoint; this one writes to our subscribers table.
 */
export function SignupForm({ source = 'home' }: { source?: 'home' | 'footer' | 'apply' | 'popup' } = {}) {
  const [state, action, pending] = useActionState(subscribe, initial)

  if (state.ok) {
    return (
      <div className="signup-form">
        <p role="status">{state.message}</p>
      </div>
    )
  }

  return (
    <div className="signup-form">
      <form action={action} className="contact-form" noValidate>
        {/* Which form this is, so a segment can be built later without anyone
            having to remember which page had which box. Allowlisted server
            side; an unknown value just reads as 'home'. */}
        <input type="hidden" name="source" value={source} />
        <p>
          <input
            type="email"
            placeholder="Your email"
            className="signup-form__email"
            name="email"
            aria-label="Email"
            required
          />
        </p>
        {state.errors?.email && <p className="form-error">{state.errors.email}</p>}
        <button className="btn btn--primary signup-form__button" type="submit" disabled={pending}>
          {pending ? 'Subscribing…' : 'Subscribe'}
        </button>
      </form>
    </div>
  )
}
