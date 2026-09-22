'use client'

import { useActionState, useEffect, useRef } from 'react'
import { subscribe, type FormState } from '@/app/actions'

const initial: FormState = { ok: false }

/**
 * The waiting list on /apply, once the window has closed.
 *
 * Same server action and the same table as the footer signup (`subscribe`,
 * with source 'apply'): there is one list, and an address that arrives here
 * is the same address that arrives there, on the same export at
 * /admin/subscribers. What differs is the accessibility of it, and that is
 * why this is not <SignupForm>:
 *
 *   - A real <label>, not an aria-label. Once the window closes this field is
 *     the whole purpose of the page, and the footer's placeholder-only box is
 *     a compact treatment for a compact job.
 *   - One live region, mounted before anything is submitted and reused for
 *     both the rejection and the confirmation. SignupForm swaps the form out
 *     for a role="status" that did not exist a moment earlier, and a region
 *     that appears at the same instant as its text is not reliably announced.
 *   - The focus ring is the site-wide :focus-visible rule in local.css.
 *
 * The footer's version stays as it is. It is on every page and changing it is
 * a separate job.
 */
export function WaitlistForm() {
  const [state, action, pending] = useActionState(subscribe, initial)
  const error = state.errors?.email
  const note = state.ok ? state.message : error

  /* On success the form unmounts, and whatever the keyboard was standing on
     unmounts with it: focus falls back to <body> and the next Tab starts the
     page again from the top. Move it onto the confirmation instead, which is
     both where the answer is and the right place to carry on from. */
  const noteRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (state.ok) noteRef.current?.focus()
  }, [state.ok])

  return (
    <div className="apply-signup">
      <div className="signup-form">
        {!state.ok && (
          <form action={action} className="contact-form" noValidate>
            {/* Allowlisted server side, and it is what puts these rows under
                'apply' on the subscribers export. */}
            <input type="hidden" name="source" value="apply" />
            <p>
              <label htmlFor="waitlist_email">Email</label>
              <input
                type="email"
                id="waitlist_email"
                name="email"
                className="signup-form__email"
                autoComplete="email"
                spellCheck={false}
                autoCapitalize="off"
                required
                aria-describedby="waitlist-note"
                aria-invalid={error ? true : undefined}
              />
            </p>
            <button
              className="btn btn--primary signup-form__button"
              type="submit"
              disabled={pending}
            >
              {pending ? 'Adding you…' : 'Join the list'}
            </button>
          </form>
        )}

        {/* Mounted on first render and never unmounted, so the confirmation
            and the rejection both land in a region a screen reader is already
            watching. Empty until there is something to say. */}
        <p
          ref={noteRef}
          tabIndex={-1}
          id="waitlist-note"
          className={state.ok ? 'wl-note' : 'wl-note form-error'}
          role="status"
          aria-live="polite"
        >
          {note ?? ''}
        </p>
      </div>
    </div>
  )
}
