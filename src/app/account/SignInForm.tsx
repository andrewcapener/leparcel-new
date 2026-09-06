'use client'

import { useActionState } from 'react'
import { requestSignInLink, type FormState } from '@/app/actions'

const initial: FormState = { ok: false }

/**
 * The maker's way in: one field, one button, no password.
 *
 * The success state deliberately does not say whether the address matched a
 * maker. The server does not tell us, on purpose (see requestSignInLink), and
 * a screen that said "no account" would turn this box into a way of asking
 * whether any given shop applied.
 */
export function SignInForm({ expired }: { expired?: boolean }) {
  const [state, action, pending] = useActionState(requestSignInLink, initial)
  const e = state.errors ?? {}
  const v = state.values ?? {}

  if (state.ok) {
    return (
      <div className="mm-signin mm-signin--sent" role="status">
        <h2 className="mm-signin__title">Check your email</h2>
        <p className="mm-signin__note">{state.message}</p>
        <p className="mm-signin__fine">
          It usually lands in under a minute. If it does not, look in spam, then
          try again below.
        </p>
      </div>
    )
  }

  return (
    <div className="mm-signin">
      <h2 className="mm-signin__title">Welcome back, maker</h2>
      <p className="mm-signin__note">
        Use the email you applied with and we will send you a link. No password
        to remember, and none to lose.
      </p>

      {expired && !state.attempt && (
        <p className="mm-signin__expired" role="status">
          That link had run out. They only last twenty minutes. Here is a fresh one.
        </p>
      )}

      <form key={state.attempt ?? 0} action={action} className="mm-signin__form" noValidate>
        <label htmlFor="maker_email">Your email</label>
        <input
          id="maker_email" name="email" type="email" required
          autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
          placeholder="you@yourshop.com"
          defaultValue={v.email ?? ''}
          aria-describedby={e.email ? 'maker_email-error' : undefined}
          aria-invalid={e.email ? true : undefined}
        />
        {e.email && (
          <small className="form-error" id="maker_email-error" role="alert">{e.email}</small>
        )}
        <button className="btn btn--primary mm-signin__btn" type="submit" disabled={pending}>
          {pending ? 'Sending' : 'Email me a link'}
        </button>
      </form>

      <p className="mm-signin__fine">
        Not applied yet? <a href="/apply">Start an application</a>.
      </p>
    </div>
  )
}
