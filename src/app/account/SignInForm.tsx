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
export function SignInForm({
  expired, next, title, note, offerApply = true,
}: {
  expired?: boolean
  /** Where to land after the emailed link is clicked. Only "payment" is
   *  understood; anything else falls back to the account. */
  next?: 'payment'
  /** The heading and the sentence under it. Pass null for either to render
   *  nothing: the payment page already carries "Pay your booth fee" as its
   *  page title, so the card repeating it said the same thing twice on a
   *  screen the size of a phone. */
  title?: string | null
  note?: string | null
  /** Whether to offer the application form underneath. True on the account,
   *  where somebody may well have arrived without applying. False on the
   *  payment door, which is only ever reached by a link we sent to a maker
   *  who is already in: an invitation to apply there is an answer to a
   *  question nobody asked. */
  offerApply?: boolean
}) {
  const [state, action, pending] = useActionState(requestSignInLink, initial)
  const e = state.errors ?? {}
  const v = state.values ?? {}
  /* Nothing above the field. The heavy top rule and the deep padding exist to
     sit under a heading; with no heading they frame an empty inch. */
  const bare = title === null && note === null

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
    <div className={`mm-signin${bare ? ' mm-signin--bare' : ''}`}>
      {title !== null && <h2 className="mm-signin__title">{title ?? 'Welcome back, maker'}</h2>}
      {note !== null && (
        <p className="mm-signin__note">
          {note ?? 'Use the email you applied with and we will send you a link. No password to remember, and none to lose.'}
        </p>
      )}

      {expired && !state.attempt && (
        <p className="mm-signin__expired" role="status">
          That link had run out. They only last twenty minutes. Here is a fresh one.
        </p>
      )}

      <form key={state.attempt ?? 0} action={action} className="mm-signin__form" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
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

      {offerApply && (
        <p className="mm-signin__fine">
          Not applied yet? <a href="/apply">Start an application</a>.
        </p>
      )}
    </div>
  )
}
