'use client'

import Link from 'next/link'
import {
  cloneElement, isValidElement, useActionState, useEffect, useRef, useState,
  type ReactElement,
} from 'react'
import { submitApplication, type FormState } from '@/app/actions'
import { CATEGORIES, type AddOn, type Show, type SpaceType } from '@/db/schema'
import { bpsLabel, usd } from '@/lib/money'

const initial: FormState = { ok: false }

/**
 * The application form, in Symmetry's own form markup: `account-form`, a
 * `flexible-layout--form` of `column--half` / `column--full` fields, their
 * label-above-input pattern and their `.btn`. Their live page embeds a
 * third-party form builder here; this is the same shape, ours.
 *
 * What the form does beyond looking like the site:
 *
 *  - Five named steps, numbered, with a plan at the top that ticks off as
 *    they are answered. Step 4 is optional and says so in the heading, the
 *    plan, and its own first line. Nothing about paperwork blocks an
 *    application (see the note above that step).
 *  - Server-side Zod validation with the values echoed back, so a rejected
 *    submit costs one field and not the whole form. The checkbox groups are
 *    held in React state instead, because FormData collapses repeated keys
 *    and the echo can only carry the last one.
 *  - Errors are summarised at the top, focus moves there on rejection, and
 *    each message is also tied to its own field with aria-describedby.
 *  - The choosers price every option on its own row and total the choice
 *    underneath, because that total is the number a maker is deciding on.
 *
 * Every input name here is parsed by submitApplication in src/app/actions.ts.
 * Renaming one breaks the application silently. Don't.
 */

type Step = { n: number; id: string; title: string; optional?: boolean }

const STEPS: Step[] = [
  { n: 1, id: 'ap-shop', title: 'Your shop' },
  { n: 2, id: 'ap-work', title: 'What you make' },
  { n: 3, id: 'ap-space', title: 'Where you want to be' },
  { n: 4, id: 'ap-paper', title: 'Paperwork', optional: true },
  { n: 5, id: 'ap-sign', title: 'Agree and submit' },
]

/** Field names in the error summary, in the words the label uses. */
const LABELS: Record<string, string> = {
  shopName: 'Shop or brand name',
  contactName: 'Your name',
  email: 'Email',
  phone: 'Phone',
  instagram: 'Instagram',
  website: 'Website',
  city: 'City',
  state: 'State',
  category: 'Primary category',
  madeByYou: 'Made by you',
  description: 'Describe your product',
  priceLow: 'Lowest price',
  priceHigh: 'Highest price',
  usesAiArtwork: 'AI-generated artwork',
  isMlm: 'MLM or direct sales',
  track: 'Inside or outside',
  spaces: 'Spaces',
  sellerPermit: 'Seller’s permit number',
  signedName: 'Type your name to sign',
  agree: 'Vendor agreement',
}

/**
 * One labelled field. The child input keeps its own `name`; everything else
 * (id, aria-describedby, aria-invalid) is derived from it so a hint and an
 * error can never come unstuck from the control they belong to.
 */
function Field({
  name, label, hint, error, half, children,
}: {
  name: string; label: string; hint?: string; error?: string; half?: boolean
  children: React.ReactNode
}) {
  const hintId = hint ? `${name}-hint` : null
  const errorId = error ? `${name}-error` : null
  const describedBy = [errorId, hintId].filter(Boolean).join(' ')
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
      id: name,
      'aria-describedby': describedBy || undefined,
      'aria-invalid': error ? 'true' : undefined,
    })
    : children

  return (
    <div className={half ? 'column column--half' : 'column column--full'}>
      <label htmlFor={name}>{label}</label>
      {control}
      {hint && <small className="note" id={hintId!}>{hint}</small>}
      {error && <small className="form-error" id={errorId!}>{error}</small>}
    </div>
  )
}

/** A step heading: the number, the name, and whether it is optional. */
function StepHead({ step }: { step: Step }) {
  return (
    <div className="lightish-spaced-row ap-step__head">
      <p className="ap-step__n">
        Step {step.n} of {STEPS.length}
        {step.optional && <span className="ap-step__flag">Optional</span>}
      </p>
      <h2 id={`${step.id}-h`}>{step.title}</h2>
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
  // Checkbox groups live here, not in the DOM: the form remounts on every
  // rejected submit (see `key` below) and FormData's echo keeps only the last
  // value of a repeated name, so state is the only thing that can carry a
  // multi-choice answer across an attempt intact.
  const [pickedSpaces, setPickedSpaces] = useState<string[]>([])
  const [pickedAddons, setPickedAddons] = useState<string[]>([])
  const keep = (k: string) => ({ defaultValue: v[k] ?? '' })

  // A snapshot of the text answers, read off the form on every change. It
  // drives the plan's ticks and the character count, nothing else: the inputs
  // stay uncontrolled, so typing never re-renders a value out from under you.
  const formRef = useRef<HTMLFormElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLDivElement>(null)
  const [answered, setAnswered] = useState<Record<string, string>>({})

  function scan() {
    const form = formRef.current
    if (!form) return
    const next: Record<string, string> = {}
    for (const [k, val] of new FormData(form).entries()) {
      if (typeof val === 'string' && val.trim() !== '') next[k] = val
    }
    setAnswered(next)
  }

  useEffect(scan, [state.attempt, state.ok])

  // A rejected submit has to land somewhere a screen reader and a thumb both
  // find. The summary is outside the keyed form so it survives the remount.
  useEffect(() => {
    if (state.ok) { doneRef.current?.focus(); return }
    if (state.attempt) summaryRef.current?.focus()
  }, [state])

  const toggle = (list: string[], set: (n: string[]) => void, key: string) =>
    (checked: boolean) => set(checked ? [...list, key] : list.filter((k) => k !== key))

  const visible = spaces.filter((s) => track === 'both' || s.track === track)
  // A null-track add-on is offered to everyone; the rest follow the track.
  const visibleExtras = extras.filter(
    (a) => a.track === null || track === 'both' || a.track === track,
  )
  // Only what is on screen is submitted, so only what is on screen counts.
  const chosen = visible.filter((s) => pickedSpaces.includes(s.id))
  const chosenExtras = visibleExtras.filter((a) => pickedAddons.includes(a.code))
  // The action books the first requested space and treats the rest as
  // alternates (actions.ts: `const space = requested[0]`). Money is integer
  // cents throughout; usd() does the only formatting.
  const first = chosen[0]
  const totalCents = (first?.priceCents ?? 0)
    + chosenExtras.reduce((n, a) => n + a.priceCents, 0)

  const description = answered.description ?? ''
  const has = (k: string) => Boolean(answered[k])
  const stepDone: Record<number, boolean> = {
    1: ['shopName', 'contactName', 'email', 'phone', 'instagram', 'city', 'state'].every(has),
    2: has('category') && description.trim().length >= 40 && has('priceLow') && has('priceHigh'),
    3: chosen.length > 0,
    4: true,
    5: answered.agree === 'on' && (answered.signedName ?? '').trim().length >= 2,
  }
  const left = STEPS.filter((s) => !s.optional && !stepDone[s.n]).length

  const problems = Object.entries(e)
  const rejected = Boolean(state.attempt) && !state.ok
    && (problems.length > 0 || Boolean(state.message))

  if (state.ok) {
    // Their /pages/thank-you, in their words.
    return (
      <div className="reading-width account-form rte" ref={doneRef} tabIndex={-1}>
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
      {/* The plan. Five steps, what each one is, and what is still open. */}
      <nav className="ap-plan" aria-label="The five steps">
        <p className="ap-plan__intro">
          Five steps. Everything is required unless it says optional, and
          nothing is saved until you submit.
        </p>
        <ol className="ap-plan__list">
          {STEPS.map((s) => (
            <li key={s.id} className="ap-plan__item">
              <a href={`#${s.id}`}>
                <span className="ap-plan__n">{String(s.n).padStart(2, '0')}</span>
                <span className="ap-plan__title">{s.title}</span>
                <span className="ap-plan__state">
                  {s.optional ? 'Optional' : stepDone[s.n] ? 'Done' : ''}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {rejected && (
        <div
          className="errors ap-errors" ref={summaryRef} tabIndex={-1}
          role="alert" aria-labelledby="ap-errors-h"
        >
          <p className="ap-errors__h" id="ap-errors-h">
            {state.message ?? 'Some answers need another look.'}
          </p>
          {problems.length > 0 && (
            <ul>
              {problems.map(([k, msg]) => (
                <li key={k}>
                  <a href={`#${k}`}>{LABELS[k] ?? k}</a>: {msg}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form
        key={state.attempt ?? 0} action={action} onChange={scan}
        ref={formRef} className="contact-form ap-form" noValidate
      >
        <section id={STEPS[0]!.id} aria-labelledby={`${STEPS[0]!.id}-h`}>
          <StepHead step={STEPS[0]!} />
          <div className="flexible-layout flexible-layout--form">
            <Field name="shopName" label="Shop or brand name" error={e.shopName}>
              <input type="text" name="shopName" autoComplete="organization" required {...keep('shopName')} />
            </Field>
            <Field name="contactName" label="Your name" error={e.contactName} half>
              <input type="text" name="contactName" autoComplete="name" required {...keep('contactName')} />
            </Field>
            <Field name="email" label="Email" error={e.email} half>
              <input name="email" type="email" inputMode="email" autoComplete="email" required {...keep('email')} />
            </Field>
            <Field name="phone" label="Phone" error={e.phone} half>
              <input type="tel" name="phone" inputMode="tel" autoComplete="tel" required {...keep('phone')} />
            </Field>
            <Field
              name="instagram" label="Instagram" error={e.instagram} half
              hint="It’s the main thing the jury looks at."
            >
              <input type="text" name="instagram" placeholder="@yourshop" autoCapitalize="none" autoCorrect="off" required {...keep('instagram')} />
            </Field>
            <Field name="website" label="Website (optional)" error={e.website} half>
              <input type="text" name="website" inputMode="url" autoCapitalize="none" autoCorrect="off" {...keep('website')} />
            </Field>
            <Field name="city" label="City" error={e.city} half>
              <input type="text" name="city" autoComplete="address-level2" required {...keep('city')} />
            </Field>
            <Field name="state" label="State" error={e.state} half>
              <input type="text" name="state" autoComplete="address-level1" required defaultValue={v.state ?? 'CA'} />
            </Field>
          </div>
        </section>

        <section id={STEPS[1]!.id} aria-labelledby={`${STEPS[1]!.id}-h`}>
          <StepHead step={STEPS[1]!} />
          <div className="flexible-layout flexible-layout--form">
            <Field name="category" label="Primary category" error={e.category} half>
              <select name="category" required defaultValue={v.category ?? ''}>
                <option value="" disabled>Choose one</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field name="madeByYou" label="Is everything made by you?" error={e.madeByYou} half>
              <select name="madeByYou" required defaultValue={v.madeByYou ?? 'all'}>
                <option value="all">Yes, I make everything</option>
                <option value="mostly_sourced_components">Mostly, with sourced components</option>
                <option value="curate_resell">I curate and resell</option>
              </select>
            </Field>
            <Field
              name="description" label="Describe your product" error={e.description}
              hint="What it is, how it’s made, who makes it. 40 characters minimum."
            >
              <textarea name="description" maxLength={600} required {...keep('description')} />
            </Field>
            <div className="column column--full ap-count-row">
              <span className="ap-count" aria-hidden="true">
                {description.length} / 600
              </span>
            </div>
            <Field name="priceLow" label="Lowest price ($)" error={e.priceLow} half>
              <input name="priceLow" type="number" inputMode="numeric" min={1} step={1} required {...keep('priceLow')} />
            </Field>
            <Field name="priceHigh" label="Highest price ($)" error={e.priceHigh} half>
              <input name="priceHigh" type="number" inputMode="numeric" min={1} step={1} required {...keep('priceHigh')} />
            </Field>
            {/* Renegade and Patchwork both added the AI question in 2025.
                docs/01-PRODUCT-SPEC.md §3.1 — ask it now, not later. */}
            <Field name="usesAiArtwork" label="Any AI-generated artwork?" error={e.usesAiArtwork} half>
              <select name="usesAiArtwork" defaultValue={v.usesAiArtwork ?? 'no'}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>
            <Field name="isMlm" label="Are you an MLM / direct-sales brand?" error={e.isMlm} half>
              <select name="isMlm" defaultValue={v.isMlm ?? 'no'}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>
          </div>
        </section>

        <section id={STEPS[2]!.id} aria-labelledby={`${STEPS[2]!.id}-h`}>
          <StepHead step={STEPS[2]!} />
          <div className="flexible-layout flexible-layout--form">
            <Field
              name="track" label="Inside or outside" error={e.track}
              hint={
                track === 'indoor'
                  ? `Inside is consignment. We merchandise your work, sell it at one register, and take ${bpsLabel(show.commissionBps)}. You are not at the show.`
                  : track === 'outdoor'
                    ? 'Outside is a tent for the day. You run your own payments and keep all of it.'
                    : 'One application, both tracks. Check what you want in each.'
              }
            >
              <select
                name="track" value={track}
                onChange={(ev) => setTrack(ev.target.value as typeof track)}
              >
                <option value="indoor">
                  Inside: consignment, {bpsLabel(show.commissionBps)} commission
                </option>
                <option value="outdoor">Outside: your own tent, no commission</option>
                <option value="both">Both</option>
              </select>
            </Field>

            <div className="column column--full">
              <fieldset
                className="ap-group" id="spaces" tabIndex={-1}
                aria-describedby={`spaces-hint${e.spaces ? ' spaces-error' : ''}`}
              >
                <legend className="ap-group__legend">Spaces</legend>
                <p className="note" id="spaces-hint">
                  Check everything you’d say yes to. The first one on the list
                  becomes your first choice, and the rest tell the jury what
                  else works. Outside makers can check more than one day.
                </p>
                {visible.map((s) => (
                  <label key={s.id} className="ap-option">
                    <input
                      type="checkbox" name="spaces" value={s.id}
                      checked={pickedSpaces.includes(s.id)}
                      onChange={(ev) => toggle(pickedSpaces, setPickedSpaces, s.id)(ev.target.checked)}
                    />
                    <span className="ap-option__body">
                      <span className="ap-option__name">{s.label}</span>
                      {s.description && (
                        <small className="ap-option__note">{s.description}</small>
                      )}
                    </span>
                    <span className="ap-option__price num">{usd(s.priceCents)}</span>
                  </label>
                ))}
                {e.spaces && (
                  <small className="form-error" id="spaces-error">{e.spaces}</small>
                )}
              </fieldset>
            </div>

            {visibleExtras.length > 0 && (
              <div className="column column--full">
                <fieldset className="ap-group" aria-describedby="addons-hint">
                  <legend className="ap-group__legend">Anything else</legend>
                  <p className="note" id="addons-hint">
                    A request, not a charge. We confirm what we can give you
                    when you’re accepted, and it goes on that invoice.
                  </p>
                  {visibleExtras.map((a) => (
                    <label key={a.id} className="ap-option">
                      <input
                        type="checkbox" name="addons" value={a.code}
                        checked={pickedAddons.includes(a.code)}
                        onChange={(ev) => toggle(pickedAddons, setPickedAddons, a.code)(ev.target.checked)}
                      />
                      <span className="ap-option__body">
                        <span className="ap-option__name">
                          {a.name}
                          {a.isLimited && <span className="ap-option__flag">Limited</span>}
                        </span>
                        {a.description && (
                          <small className="ap-option__note">{a.description}</small>
                        )}
                      </span>
                      <span className="ap-option__price num">{usd(a.priceCents)}</span>
                    </label>
                  ))}
                </fieldset>
              </div>
            )}

            {/* What the checkboxes above add up to, in the same breath as the
                choice. The figures are the ones on the Show record. */}
            <div className="column column--full">
              <div className="ap-tally" role="status">
                {!first ? (
                  <p className="ap-tally__line">
                    Nothing checked yet. Pick at least one space.
                  </p>
                ) : (
                  <>
                    <p className="ap-tally__line">
                      <span>First choice: {first.label}</span>
                      <span className="num">{usd(first.priceCents)}</span>
                    </p>
                    {chosen.length > 1 && (
                      <p className="ap-tally__alt">
                        Also happy with{' '}
                        {chosen.slice(1).map((s) => s.label).join(', ')}.
                      </p>
                    )}
                    {chosenExtras.map((a) => (
                      <p className="ap-tally__line" key={a.code}>
                        <span>Requested: {a.name}</span>
                        <span className="num">{usd(a.priceCents)}</span>
                      </p>
                    ))}
                    {/* One space and no extras is already its own total. */}
                    {chosenExtras.length > 0 && (
                      <p className="ap-tally__line ap-tally__total">
                        <span>If we can confirm all of it</span>
                        <span className="num">{usd(totalCents)}</span>
                      </p>
                    )}
                    <p className="ap-tally__note">
                      Nothing is due now. The booth fee is due within{' '}
                      {show.paymentWindowHours} hours of being accepted.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Paperwork is OPTIONAL here on purpose. The CDTFA obligation
            attaches to renting space, not to reading an application, so the
            hard gate is at load-in (see /admin/roster). Asking here just gets
            us a head start on the vendors who already have their papers. */}
        <section id={STEPS[3]!.id} aria-labelledby={`${STEPS[3]!.id}-h`}>
          <StepHead step={STEPS[3]!} />
          <div className="flexible-layout flexible-layout--form">
            <div className="column column--full">
              <p className="ap-lede">
                Skip all of this if you want. None of it is required to apply,
                and none of it reaches the jury. If you’re accepted we’ll need
                it before load-in.
              </p>
            </div>
            <Field
              name="sellerPermit" label="CA seller’s permit number (optional)"
              error={e.sellerPermit}
              hint="Leave it blank if you don’t have one. We’ll sort it out with you after acceptance."
            >
              {/* No inputMode: a permit number carries a hyphen, and a
                  numeric keypad on a phone has no key for it. */}
              <input
                name="sellerPermit" disabled={occasional}
                autoCapitalize="characters" autoCorrect="off" {...keep('sellerPermit')}
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
        </section>

        <section id={STEPS[4]!.id} aria-labelledby={`${STEPS[4]!.id}-h`}>
          <StepHead step={STEPS[4]!} />
          <div className="flexible-layout flexible-layout--form">
            <div className="column column--full">
              <p className="ap-lede">
                The rules for your track, before you sign:{' '}
                <Link href="/makers/indoor">inside</Link> ·{' '}
                <Link href="/makers/outdoor">outside</Link>.
              </p>
              <label className="check-option" htmlFor="agree">
                <input
                  type="checkbox" name="agree" id="agree"
                  defaultChecked={v.agree === 'on'} required
                  aria-describedby={e.agree ? 'agree-error' : undefined}
                  aria-invalid={e.agree ? 'true' : undefined}
                />
                <span>
                  I’ve read and accept the Mermade Market vendor agreement (v2026.1).
                </span>
              </label>
              {e.agree && (
                <small className="form-error" id="agree-error">{e.agree}</small>
              )}
            </div>
            <Field
              name="signedName" label="Type your name to sign" error={e.signedName}
              hint="We record the terms version and the timestamp with your signature."
            >
              <input type="text" name="signedName" autoComplete="name" required {...keep('signedName')} />
            </Field>
          </div>
        </section>

        <div className="lightly-spaced-row ap-submit">
          <button className="btn btn--large" type="submit" disabled={pending}>
            {pending ? 'Sending…' : 'Submit application'}
          </button>
          <p className="ap-submit__note">
            <small>
              No fee to apply. We read every one and answer either way.
              {left > 0
                && ` ${left} required step${left === 1 ? '' : 's'} still open.`}
            </small>
          </p>
        </div>
      </form>
    </div>
  )
}
