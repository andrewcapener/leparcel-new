'use client'

import { useActionState, useEffect, useRef } from 'react'
import { sendMessage, type FormState } from '@/app/actions'

const initial: FormState = { ok: false }

/**
 * `section-contact-form` — their three-field form, in their markup.
 *
 * Theirs posts to Shopify's /contact endpoint. This one goes through our
 * server action: the message is recorded in the outbox table and delivered
 * through Resend with reply-to set to the sender.
 *
 * Two fields a person never meets, both read in
 * src/server/modules/contact/spam.ts: a decoy input that only a script fills,
 * and how long the form has been open. Nothing else changes for the visitor.
 * There is no puzzle to solve here and there is not going to be one: a maker
 * with a question at eleven at night is who this form is for.
 */
export function ContactFormSection({
  heading, topic,
}: {
  heading?: string; topic?: 'contact' | 'collaborate'
}) {
  const [state, action, pending] = useActionState(sendMessage, initial)
  const e = state.errors ?? {}
  const v = state.values ?? {}

  /* When this form appeared. Kept in a ref and stamped into the hidden field
     on submit, so the number is how long it was actually open rather than
     whatever a server render happened to bake in. Re-set on every attempt,
     so a person correcting a typo is timed from the correction. */
  const openedAt = useRef(Date.now())
  const elapsed = useRef<HTMLInputElement>(null)
  useEffect(() => { openedAt.current = Date.now() }, [state.attempt])

  return (
    <div className="shopify-section section-contact-form">
      <div className="container fully-spaced-row--medium" data-cc-animate="">
        <div className="reading-width account-form">
          {state.ok ? (
            <div className="rte" role="status">
              {heading && <h2>{heading}</h2>}
              <p>{state.message}</p>
            </div>
          ) : (
            <form
              key={state.attempt ?? 0}
              action={action}
              className="contact-form"
              noValidate
              onSubmit={() => {
                if (elapsed.current) {
                  elapsed.current.value = String(Date.now() - openedAt.current)
                }
              }}
            >
              <input type="hidden" name="topic" value={topic ?? 'contact'} />
              <input type="hidden" name="elapsed" ref={elapsed} defaultValue="" />
              {/* The decoy. Off the screen, out of the tab order and hidden
                  from assistive technology, so no person can reach it and no
                  browser fills it; a script walking the inputs does. It is
                  called "company" rather than anything with "bot" or "trap"
                  in the name, because the scripts read field names. */}
              <div className="hp-field" aria-hidden="true">
                <label htmlFor="contact_company">Company</label>
                <input
                  type="text" id="contact_company" name="company"
                  tabIndex={-1} autoComplete="off" defaultValue=""
                />
              </div>
              {heading && (
                <div className="lightish-spaced-row"><h2>{heading}</h2></div>
              )}
              <div className="flexible-layout flexible-layout--form">
                <div className="column column--half">
                  <label htmlFor="contact_name">Name</label>
                  <input
                    type="text" autoComplete="name" required id="contact_name" name="name"
                    defaultValue={v.name ?? ''}
                  />
                  {e.name && <span className="form-error">{e.name}</span>}
                </div>
                <div className="column column--half">
                  <label htmlFor="contact_email">Email</label>
                  <input
                    type="email" required id="contact_email" className="email" name="email"
                    autoComplete="email" spellCheck={false} autoCapitalize="off"
                    defaultValue={v.email ?? ''}
                  />
                  {e.email && <span className="form-error">{e.email}</span>}
                </div>
                <div className="column column--full">
                  <label htmlFor="message">Message</label>
                  <textarea id="message" required name="message" defaultValue={v.message ?? ''} />
                  {e.message && <span className="form-error">{e.message}</span>}
                </div>
              </div>
              <div className="lightly-spaced-row">
                <button className="btn" type="submit" disabled={pending}>
                  {pending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
