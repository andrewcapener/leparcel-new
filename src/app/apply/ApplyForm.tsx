'use client'

import { useActionState, useState } from 'react'
import { submitApplication, type FormState } from '@/app/actions'
import { CATEGORIES, type AddOn, type Show, type SpaceType } from '@/db/schema'
import { usd } from '@/lib/money'

const initial: FormState = { ok: false }

/**
 * The application form, in Symmetry's own form markup: `account-form`, a
 * `flexible-layout--form` of `column--half` / `column--full` fields, their
 * label-above-input pattern and their `.btn`. Their live page embeds a
 * third-party form builder here; this is the same shape, ours.
 *
 * The form itself is unchanged from the version that has been through the
 * dress rehearsal: server-side Zod validation, values echoed back on
 * rejection so a bad submit costs one field and not the whole form, and a
 * window check in the action that no amount of client markup can get around.
 */

function Field({
  name, label, hint, error, half, children,
}: {
  name: string; label: string; hint?: string; error?: string; half?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={half ? 'column column--half' : 'column column--full'}>
      <label htmlFor={name}>{label}</label>
      {children}
      {hint && !error && <small className="note">{hint}</small>}
      {error && <small className="form-error">{error}</small>}
    </div>
  )
}

export function ApplyForm({
  show, spaces, extras,
}: {
  show: Show; spaces: SpaceType[]; extras: AddOn[]
}) {
  const [state, action, pending] = useActionState(submitApplication, initial)
  const e = state.errors ?? {}
  const v = state.values ?? {}
  const [track, setTrack] = useState<'indoor' | 'outdoor' | 'both'>(
    (v.track as 'indoor' | 'outdoor' | 'both') ?? 'indoor',
  )
  const [occasional, setOccasional] = useState(v.occasionalSeller === 'on')
  const keep = (k: string) => ({ defaultValue: v[k] ?? '' })

  const visible = spaces.filter((s) => track === 'both' || s.track === track)
  // A null-track add-on is offered to everyone; the rest follow the track.
  const visibleExtras = extras.filter(
    (a) => a.track === null || track === 'both' || a.track === track,
  )

  if (state.ok) {
    // Their /pages/thank-you, in their words.
    return (
      <div className="reading-width account-form rte">
        <h2>Thank You For Applying!</h2>
        <p>
          Yeeew! You took the time and we appreciate it! We know it wasn&rsquo;t
          easy.. A member of our team will be in touch. If we have questions you
          will hear from us sooner than later.
        </p>
        <p>
          Please be patient and know we are doing our best to curate the best
          market we could give you!
        </p>
        <p>
          You&rsquo;ll get a confirmation email in a moment. The {show.name}{' '}
          roster is announced{' '}
          {new Date(show.rosterAnnouncedOn).toLocaleDateString('en-US', {
            timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric',
          })}
          , and we answer either way.
        </p>
        {/* Their thank-you page asks for photos at two addresses depending on
            the track. Their own copy garbles the second heading ("Outside
            makers: Inside makers:"); the two addresses are the part that
            matters and both are kept. */}
        <p>
          <strong>Inside makers:</strong> if you do not have a solid
          website/instagram, please email photos of your product to{' '}
          <a href="mailto:hello@mermademarket.com">hello@mermademarket.com</a>{' '}
          with the subject line: your shop name + the shop space you applied
          for, e.g. &ldquo;Mama&#39;s Notebooks&rdquo;.
        </p>
        <p>
          <strong>Outside makers:</strong> same, to{' '}
          <a href="mailto:hillary@mermademarket.com">hillary@mermademarket.com</a>,
          with your shop name and the day, e.g. &ldquo;Mama&#39;s Babies,
          Saturday Only&rdquo;.
        </p>
      </div>
    )
  }

  return (
    <div className="reading-width account-form">
      <form key={state.attempt ?? 0} action={action} className="contact-form" noValidate>
        {state.message && !state.ok && <p className="form-error">{state.message}</p>}

        <div className="lightish-spaced-row"><h2>Your shop</h2></div>
        <div className="flexible-layout flexible-layout--form">
          <Field name="shopName" label="Shop or brand name" error={e.shopName}>
            <input type="text" id="shopName" name="shopName" required {...keep('shopName')} />
          </Field>
          <Field name="contactName" label="Your name" error={e.contactName} half>
            <input type="text" id="contactName" name="contactName" required {...keep('contactName')} />
          </Field>
          <Field name="email" label="Email" error={e.email} half>
            <input id="email" name="email" type="email" required {...keep('email')} />
          </Field>
          <Field name="phone" label="Phone" error={e.phone} half>
            <input type="text" id="phone" name="phone" required {...keep('phone')} />
          </Field>
          <Field
            name="instagram" label="Instagram" error={e.instagram} half
            hint="It’s the main thing the jury looks at."
          >
            <input type="text" id="instagram" name="instagram" placeholder="@yourshop" required {...keep('instagram')} />
          </Field>
          <Field name="website" label="Website (optional)" error={e.website} half>
            <input type="text" id="website" name="website" {...keep('website')} />
          </Field>
          <Field name="city" label="City" error={e.city} half>
            <input type="text" id="city" name="city" required {...keep('city')} />
          </Field>
          <Field name="state" label="State" error={e.state} half>
            <input type="text" id="state" name="state" required defaultValue={v.state ?? 'CA'} />
          </Field>
        </div>

        <div className="lightish-spaced-row"><h2>What you make</h2></div>
        <div className="flexible-layout flexible-layout--form">
          <Field name="category" label="Primary category" error={e.category} half>
            <select id="category" name="category" required defaultValue={v.category ?? ''}>
              <option value="" disabled>Choose one</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field name="madeByYou" label="Is everything made by you?" error={e.madeByYou} half>
            <select id="madeByYou" name="madeByYou" required defaultValue={v.madeByYou ?? 'all'}>
              <option value="all">Yes, I make everything</option>
              <option value="mostly_sourced_components">Mostly, with sourced components</option>
              <option value="curate_resell">I curate and resell</option>
            </select>
          </Field>
          <Field
            name="description" label="Describe your product" error={e.description}
            hint="600 characters max. What it is, how it's made, who makes it."
          >
            <textarea id="description" name="description" maxLength={600} required {...keep('description')} />
          </Field>
          <Field name="priceLow" label="Lowest price ($)" error={e.priceLow} half>
            <input id="priceLow" name="priceLow" type="number" min={1} required {...keep('priceLow')} />
          </Field>
          <Field name="priceHigh" label="Highest price ($)" error={e.priceHigh} half>
            <input id="priceHigh" name="priceHigh" type="number" min={1} required {...keep('priceHigh')} />
          </Field>
          {/* Renegade and Patchwork both added the AI question in 2025.
              docs/01-PRODUCT-SPEC.md §3.1 — ask it now, not later. */}
          <Field name="usesAiArtwork" label="Any AI-generated artwork?" error={e.usesAiArtwork} half>
            <select id="usesAiArtwork" name="usesAiArtwork" defaultValue={v.usesAiArtwork ?? 'no'}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          <Field name="isMlm" label="Are you an MLM / direct-sales brand?" error={e.isMlm} half>
            <select id="isMlm" name="isMlm" defaultValue={v.isMlm ?? 'no'}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
        </div>

        <div className="lightish-spaced-row"><h2>Which track</h2></div>
        <div className="flexible-layout flexible-layout--form">
          <Field name="track" label="Indoor, outdoor, or both" error={e.track}>
            <select
              id="track" name="track" value={track}
              onChange={(ev) => setTrack(ev.target.value as typeof track)}
            >
              <option value="indoor">
                Indoor: consignment, {show.commissionBps / 100}% commission, you don’t attend
              </option>
              <option value="outdoor">Outdoor: your own tent, and you keep 100%</option>
              <option value="both">Both</option>
            </select>
          </Field>
          <div className="column column--full">
            <label>Spaces</label>
            {visible.map((s) => (
              <label key={s.id} className="check-option">
                <input type="checkbox" name="spaces" value={s.id} />
                <span>
                  {s.label} · {usd(s.priceCents)}
                  {s.description && <small> {s.description}</small>}
                </span>
              </label>
            ))}
            <small className="note">
              Check everything you&rsquo;d say yes to. Outdoor makers can check
              more than one day.
            </small>
            {e.spaces && <small className="form-error">{e.spaces}</small>}
          </div>
          {visibleExtras.length > 0 && (
            <div className="column column--full">
              <label>Anything else</label>
              {visibleExtras.map((a) => (
                <label key={a.id} className="check-option">
                  <input type="checkbox" name="addons" value={a.code} />
                  <span>
                    {a.name} · {usd(a.priceCents)}{a.isLimited ? ' (LMTD)' : ''}
                    {a.description && <small> {a.description}</small>}
                  </span>
                </label>
              ))}
              <small className="note">
                A request, not a charge. We confirm what we can give you when
                you&rsquo;re accepted, and it goes on that invoice.
              </small>
            </div>
          )}
        </div>

        {/* Paperwork is OPTIONAL here on purpose. The CDTFA obligation
            attaches to renting space, not to reading an application, so the
            hard gate is at load-in (see /admin/roster). Asking here just gets
            us a head start on the vendors who already have their papers. */}
        <div className="lightish-spaced-row"><h2>Paperwork (optional)</h2></div>
        <div className="flexible-layout flexible-layout--form">
          <div className="column column--full">
            <p>
              None of this is required to apply, and none of it affects the jury.
              If you&rsquo;re accepted we&rsquo;ll need it before load-in.
            </p>
          </div>
          <Field
            name="sellerPermit" label="CA seller’s permit number (if you have one)"
            error={e.sellerPermit}
            hint="Leave it blank if you don’t. We’ll sort it out with you after acceptance."
          >
            <input
              id="sellerPermit" name="sellerPermit" disabled={occasional}
              aria-invalid={e.sellerPermit ? 'true' : undefined} {...keep('sellerPermit')}
            />
          </Field>
          <div className="column column--full">
            <label className="check-option">
              <input
                type="checkbox" name="occasionalSeller"
                checked={occasional} onChange={(ev) => setOccasional(ev.target.checked)}
              />
              <span>I don’t have a permit. I qualify as an occasional seller (CDTFA 410-D)</span>
            </label>
            <label className="check-option">
              <input type="checkbox" name="hasCoi" defaultChecked={v.hasCoi === 'on'} />
              <span>I carry my own liability insurance (recommended, not required)</span>
            </label>
          </div>
        </div>

        <div className="lightish-spaced-row"><h2>Agree &amp; submit</h2></div>
        <div className="flexible-layout flexible-layout--form">
          <div className="column column--full">
            <label className="check-option">
              <input type="checkbox" name="agree" defaultChecked={v.agree === 'on'} required />
              <span>
                I’ve read and accept the Mermade Market vendor agreement (v2026.1).
              </span>
            </label>
            {e.agree && <small className="form-error">{e.agree}</small>}
          </div>
          <Field
            name="signedName" label="Type your name to sign" error={e.signedName}
            hint="We record the terms version and timestamp with your signature."
          >
            <input type="text" id="signedName" name="signedName" required {...keep('signedName')} />
          </Field>
        </div>

        <div className="lightly-spaced-row">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? 'Sending…' : 'Submit application'}
          </button>
          <p><small>No fee to apply.</small></p>
        </div>
      </form>
    </div>
  )
}
