'use client'

import { useActionState } from 'react'
import { sendMessage, type FormState } from '@/app/actions'

const initial: FormState = { ok: false }

/**
 * `section-contact-form` — their three-field form, in their markup.
 *
 * Theirs posts to Shopify's /contact endpoint. This one goes through our
 * server action: the message is recorded in the outbox table and delivered
 * through Resend with reply-to set to the sender.
 */
export function ContactFormSection({
  heading, topic,
}: {
  heading?: string; topic?: 'contact' | 'collaborate'
}) {
  const [state, action, pending] = useActionState(sendMessage, initial)
  const e = state.errors ?? {}
  const v = state.values ?? {}

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
            <form key={state.attempt ?? 0} action={action} className="contact-form" noValidate>
              <input type="hidden" name="topic" value={topic ?? 'contact'} />
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
