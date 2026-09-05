'use client'

import Link from 'next/link'
import {
  cloneElement, isValidElement, useActionState, useCallback, useEffect, useRef,
  useState, type ReactElement,
} from 'react'
import { submitApplication, type FormState } from '@/app/actions'
import { CATEGORIES, type AddOn, type Show, type SpaceType } from '@/db/schema'
import { bpsLabel, usd } from '@/lib/money'
import { PhotoField } from './PhotoField'
import type { PhotoItem } from './photo-upload'

const initial: FormState = { ok: false }

/**
 * The application form, in Symmetry's own form markup: `account-form`, a
 * `flexible-layout--form` of `column--half` / `column--full` fields, their
 * label-above-input pattern and their `.btn`.
 *
 * It is one <form> showing one step at a time.
 *
 *  - Every field stays mounted for the whole session. The steps that are not
 *    on screen carry `hidden`, which removes them from the page and from the
 *    accessibility tree but not from the form, so the submission is the same
 *    23 names in the same shape whatever step you were looking at. Nothing is
 *    lost by moving between steps, and the browser's back button is not part
 *    of the mechanism.
 *  - Progress is a row of five segments across the top: where you are, what
 *    is answered, what is left. Each one is a button, so any step is one tap
 *    away and nothing traps you.
 *  - The next action lives in a bar at the foot of the card that sticks to
 *    the bottom of a phone screen, along with the running total of what has
 *    been picked. Both are visible from every step.
 *  - Server-side Zod validation with the values echoed back, so a rejected
 *    submit costs one field and not the whole form. The checkbox groups are
 *    held in React state instead, because FormData collapses repeated keys
 *    and the echo can only carry the last one. A rejection also moves you to
 *    the first step that has a problem in it.
 *  - Errors are summarised above the form, focus moves there on rejection,
 *    each message is a button that opens its step and focuses its field, and
 *    each is also tied to its own field with aria-describedby.
 *  - The choosers price every option in its own column, rank the spaces in
 *    the order the jury will read them, and total the choice underneath.
 *
 * Every input name here is parsed by submitApplication in src/app/actions.ts.
 * Renaming one breaks the application silently. Don't.
 */

type Step = {
  n: number
  id: string
  title: string
  /** One line on what the step is for, under its heading. */
  blurb: string
  optional?: boolean
}

const STEPS: Step[] = [
  {
    n: 1,
    id: 'ap-shop',
    title: 'Your shop',
    blurb: 'Who you are, and where we can look at your work.',
  },
  {
    n: 2,
    id: 'ap-work',
    title: 'What you make',
    blurb: 'The part the jury reads. Be specific about materials and method.',
  },
  {
    n: 3,
    id: 'ap-space',
    title: 'Where you want to be',
    blurb: 'Check every space you would say yes to. Choosing inside and outside, '
      + 'or more than one day, raises your chance of getting in.',
  },
  {
    n: 4,
    id: 'ap-paper',
    title: 'Paperwork',
    blurb: 'None of it reaches the jury. Skip it and nothing changes.',
    optional: true,
  },
  {
    n: 5,
    id: 'ap-sign',
    title: 'Agree and submit',
    blurb: 'Read the rules for your track, sign, and send it.',
  },
]

const LAST = STEPS.length

/** "1st", "2nd", "3rd", "4th"… The rank badge on a checked space says which
 *  one the acceptance books, so it has to read as an order and not a count. */
function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th'
    : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'
  return `${n}${suffix}`
}

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
 * Which step a field lives on. A rejected submit opens the earliest step
 * that has a problem in it, and every line of the error summary opens the
 * step its field is on. Anything unmapped falls back to the last step, which
 * is where the submit button is.
 */
const STEP_OF: Record<string, number> = {
  shopName: 1, contactName: 1, email: 1, phone: 1, instagram: 1, website: 1,
  city: 1, state: 1,
  category: 2, madeByYou: 2, description: 2, priceLow: 2, priceHigh: 2,
  usesAiArtwork: 2, isMlm: 2,
  track: 3, spaces: 3, addons: 3,
  sellerPermit: 4, occasionalSeller: 4, hasCoi: 4,
  agree: 5, signedName: 5,
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

/** A step heading: the number, the name, whether it is optional, and what
 *  the step is for. It takes focus when you arrive at the step. */
function StepHead({ step }: { step: Step }) {
  return (
    <div className="ap-step__head">
      {/* The number lives in the progress segments above and in the action
          bar below, so the heading is only the idea of the step. The optional
          flag is inside the heading on purpose: it belongs to the step's
          name, and a screen reader announcing "Paperwork, optional" is
          exactly the point. */}
      <h2 id={`${step.id}-h`} className="ap-step__title" tabIndex={-1}>
        {step.title}
        {step.optional && <span className="ap-step__flag">Optional</span>}
      </h2>
      <p className="ap-step__blurb">{step.blurb}</p>
    </div>
  )
}

export function ApplyForm({
  show, spaces, extras, uploads,
}: {
  show: Show; spaces: SpaceType[]; extras: AddOn[]
  /** Whether this deployment has Supabase Storage configured. False locally,
   *  where the photo field explains itself and the form still submits. */
  uploads: boolean
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
  // The photographs, for the same reason and one more: an upload that
  // survived a rejected submit must not have to happen twice on a phone.
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  // Load-in slots an indoor maker can make. Outdoor makers set up their own
  // tent on their own day, so the question never shows for them.
  const [pickedSlots, setPickedSlots] = useState<string[]>([])
  const [wantsCall, setWantsCall] = useState(false)
  const keep = (k: string) => ({ defaultValue: v[k] ?? '' })

  // Which step is on screen. This lives outside the <form>, so it survives
  // the remount that a rejected submit forces.
  const [step, setStep] = useState(1)

  // A snapshot of the text answers, read off the form on every change. It
  // drives the progress segments and the character count, nothing else: the
  // inputs stay uncontrolled, so typing never re-renders a value out from
  // under you.
  const formRef = useRef<HTMLFormElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const summaryRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLDivElement>(null)
  const [answered, setAnswered] = useState<Record<string, string>>({})

  const scan = useCallback(() => {
    const form = formRef.current
    if (!form) return
    const next: Record<string, string> = {}
    for (const [k, val] of new FormData(form).entries()) {
      if (typeof val === 'string' && val.trim() !== '') next[k] = val
    }
    setAnswered(next)
  }, [])

  useEffect(() => { scan() }, [scan, state.attempt, state.ok])

  /** Move to a step and put focus on its heading, so a keyboard or screen
   *  reader lands at the top of the new step rather than wherever the button
   *  that moved them happened to be. */
  const go = useCallback((n: number, focus = true) => {
    const next = Math.min(LAST, Math.max(1, n))
    setStep(next)
    if (!focus) return
    requestAnimationFrame(() => {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      cardRef.current?.scrollIntoView({
        block: 'start', behavior: smooth ? 'smooth' : 'auto',
      })
      document.getElementById(`${STEPS[next - 1]!.id}-h`)?.focus({ preventScroll: true })
    })
  }, [])

  /** An error summary line: open the step the field is on, then focus it. */
  const goToField = useCallback((name: string) => {
    setStep(STEP_OF[name] ?? LAST)
    requestAnimationFrame(() => {
      const el = document.getElementById(name)
      el?.scrollIntoView({ block: 'center' })
      ;(el as HTMLElement | null)?.focus({ preventScroll: true })
    })
  }, [])

  // A rejected submit has to land somewhere a screen reader and a thumb both
  // find. The summary is outside the keyed form so it survives the remount,
  // and the step underneath it is changed to the first one with a problem.
  useEffect(() => {
    if (!state.attempt) return
    if (state.ok) { doneRef.current?.focus(); return }
    const keys = Object.keys(state.errors ?? {})
    const first = keys.reduce((lo, k) => Math.min(lo, STEP_OF[k] ?? LAST), LAST + 1)
    if (first <= LAST) setStep(first)
    summaryRef.current?.focus()
  }, [state])

  const toggle = (list: string[], set: (n: string[]) => void, key: string) =>
    (checked: boolean) => set(checked ? [...list, key] : list.filter((k) => k !== key))

  const visible = spaces.filter((s) => track === 'both' || s.track === track)
  const slots = (show.loadInSlots ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  const showSlots = slots.length > 0 && track !== 'outdoor'
  // A null-track add-on is offered to everyone; the rest follow the track.
  const visibleExtras = extras.filter(
    (a) => a.track === null || track === 'both' || a.track === track,
  )
  // Only what is on screen is submitted, so only what is on screen counts.
  // The order here is the order the boxes are rendered in, which is the order
  // FormData reports them in, which is the order the action reads them in.
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
    // The photograph is deliberately absent from this list. It is optional,
    // and a progress marker that stays grey because you skipped an optional
    // field is a form nagging you.
    2: has('category') && description.trim().length >= 40 && has('priceLow') && has('priceHigh'),
    3: chosen.length > 0,
    4: has('sellerPermit') || occasional || answered.hasCoi === 'on',
    5: answered.agree === 'on' && (answered.signedName ?? '').trim().length >= 2,
  }
  // What is still unanswered somewhere else. The step you are looking at is
  // never on this list: its own fields are the thing in front of you.
  const open = STEPS.filter((s) => !s.optional && !stepDone[s.n] && s.n !== step)

  const problems = Object.entries(e)
  const rejected = Boolean(state.attempt) && !state.ok
    && (problems.length > 0 || Boolean(state.message))

  if (state.ok) {
    // Their /pages/thank-you, in their words.
    return (
      <div className="reading-width account-form rte ap-thanks" ref={doneRef} tabIndex={-1}>
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
        {/* Their old thank-you page asked every maker to email photographs to
            one of two addresses. The form takes one now, so that copy is only
            true on a deployment with no storage configured, and that is the
            only place it still runs. Where uploads work, this screen says
            nothing about photographs: the application is in, and the last
            word to a maker is not another task. */}
        {!uploads && (
          <p>
            <strong>One more thing.</strong> If you want the jury to open on
            an image, email one to{' '}
            <a href="mailto:hello@mermademarket.com">hello@mermademarket.com</a>{' '}
            (outside makers, to{' '}
            <a href="mailto:hillary@mermademarket.com">hillary@mermademarket.com</a>)
            with your shop name in the subject line.
          </p>
        )}
      </div>
    )
  }

  const nextStep = STEPS[step]

  return (
    <div className="reading-width account-form ap-card" ref={cardRef}>
      {/* Progress. Five segments, each a button to its step: state at a
          glance, and nothing between you and any part of the form. */}
      <nav className="ap-steps" aria-label="Application steps">
        <ol className="ap-steps__list">
          {STEPS.map((s) => {
            const st = s.n === step ? 'current'
              : s.optional ? 'optional'
                : stepDone[s.n] ? 'done' : 'todo'
            return (
              <li className="ap-steps__item" key={s.id}>
                <button
                  type="button"
                  className="ap-steps__btn"
                  data-state={st}
                  aria-current={s.n === step ? 'step' : undefined}
                  aria-label={
                    `Step ${s.n} of ${LAST}: ${s.title}`
                    + (s.optional ? ', optional' : stepDone[s.n] ? ', answered' : '')
                  }
                  onClick={() => go(s.n)}
                >
                  <span className="ap-steps__bar" aria-hidden="true" />
                  <span className="ap-steps__n" aria-hidden="true">{s.n}</span>
                  <span className="ap-steps__title" aria-hidden="true">{s.title}</span>
                </button>
              </li>
            )
          })}
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
                  <button
                    type="button" className="ap-errors__link"
                    onClick={() => goToField(k)}
                  >
                    {LABELS[k] ?? k}
                  </button>
                  : {msg}
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
        <section
          className="ap-step" id={STEPS[0]!.id} hidden={step !== 1}
          aria-labelledby={`${STEPS[0]!.id}-h`}
        >
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

        <section
          className="ap-step" id={STEPS[1]!.id} hidden={step !== 2}
          aria-labelledby={`${STEPS[1]!.id}-h`}
        >
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
              <textarea name="description" rows={5} maxLength={600} required {...keep('description')} />
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
            {/* Last on the step, and optional. It is the first thing the jury
                sees, so it is worth offering; it is also the thing most
                likely to stop a maker mid-form, so it asks once, in one
                line, and never blocks a submit. */}
            <PhotoField enabled={uploads} items={photos} setItems={setPhotos} />
          </div>
        </section>

        <section
          className="ap-step" id={STEPS[2]!.id} hidden={step !== 3}
          aria-labelledby={`${STEPS[2]!.id}-h`}
        >
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
                <option value="outdoor">Outside: a tent we set up, no commission</option>
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
                  Check everything you’d say yes to. The highest one you check
                  becomes your first choice, and the rest tell the jury what
                  else works. Outside makers can check more than one day.
                </p>
                {/* The hardest question on this form is what a space actually
                    looks like, and the answer is already on the site. A maker
                    who has seen the room picks a size with some confidence
                    instead of defaulting to the smallest one. New tab, because
                    leaving this page mid-application loses the form. */}
                <p className="note ap-lookbook">
                  Not sure which to pick?{' '}
                  {track !== 'outdoor' && (
                    <a href="/lookbook/indoor" target="_blank" rel="noopener">
                      See inside the room
                    </a>
                  )}
                  {track === 'both' && ' or '}
                  {track !== 'indoor' && (
                    <a href="/lookbook/outdoor" target="_blank" rel="noopener">
                      See the outdoor tents
                    </a>
                  )}
                  .
                </p>
                {visible.map((s) => {
                  const rank = chosen.indexOf(s)
                  return (
                    <label key={s.id} className="ap-option">
                      <input
                        type="checkbox" name="spaces" value={s.id}
                        checked={pickedSpaces.includes(s.id)}
                        onChange={(ev) => toggle(pickedSpaces, setPickedSpaces, s.id)(ev.target.checked)}
                      />
                      <span className="ap-option__body">
                        <span className="ap-option__name">
                          {s.label}
                          {rank >= 0 && (
                            <span
                              className={`ap-option__rank${rank > 0 ? ' ap-option__rank--alt' : ''}`}
                            >
                              {ordinal(rank + 1)} choice
                            </span>
                          )}
                        </span>
                        {/* The size, not the advice. Drew took suitability off
                            the picker: a maker choosing between six spaces
                            wants to know what fits, and "not suggested for
                            apparel" reads as a warning at the moment they are
                            trying to commit. Elise's advice is on
                            /makers/indoor and in the reference table below,
                            which is where somebody goes to read rather than
                            to choose. */}
                        {s.dimensions && (
                          <small className="ap-option__note">{s.dimensions}</small>
                        )}
                      </span>
                      <span className="ap-option__price num">{usd(s.priceCents)}</span>
                    </label>
                  )
                })}
                {e.spaces && (
                  <small className="form-error" id="spaces-error">{e.spaces}</small>
                )}
              </fieldset>
            </div>

            {showSlots && (
              <div className="column column--full">
                <fieldset className="ap-group" aria-describedby="slots-hint">
                  <legend className="ap-group__legend">Set-up time</legend>
                  <p className="note" id="slots-hint">
                    Load-in is staggered so a hundred shops are not carrying
                    tables through one door at once. Check every slot you could
                    make. Checking more than one helps us fit everybody in, and
                    we confirm your time with your acceptance.
                  </p>
                  {slots.map((slot) => (
                    <label key={slot} className="ap-option ap-option--tight">
                      <input
                        type="checkbox" name="loadInSlots" value={slot}
                        checked={pickedSlots.includes(slot)}
                        onChange={(ev) => toggle(pickedSlots, setPickedSlots, slot)(ev.target.checked)}
                      />
                      <span className="ap-option__body">
                        <span className="ap-option__name">{slot}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              </div>
            )}

            <div className="column column--full">
              <fieldset className="ap-group" aria-describedby="call-hint">
                <legend className="ap-group__legend">A hand with your space</legend>
                <p className="note" id="call-hint">
                  Before every show we run a short Zoom call on building a space
                  that sells: display, shelving, lighting, what works and what
                  we see go wrong. Mostly it is makers doing this for the first
                  time, and everyone is welcome. Dates go out with your
                  acceptance.
                </p>
                <label className="ap-option ap-option--tight">
                  <input
                    type="checkbox" name="wantsOnboardingCall" value="1"
                    checked={wantsCall}
                    onChange={(ev) => setWantsCall(ev.target.checked)}
                  />
                  <span className="ap-option__body">
                    <span className="ap-option__name">
                      Yes, put me on a call
                    </span>
                  </span>
                </label>
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
                  <p className="ap-tally__empty">
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
                    <p className="ap-tally__line ap-tally__total">
                      <span>
                        {chosenExtras.length > 0
                          ? 'If we can confirm all of it'
                          : 'Your first choice'}
                      </span>
                      <span className="num">{usd(totalCents)}</span>
                    </p>
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
        <section
          className="ap-step" id={STEPS[3]!.id} hidden={step !== 4}
          aria-labelledby={`${STEPS[3]!.id}-h`}
        >
          <StepHead step={STEPS[3]!} />
          <div className="flexible-layout flexible-layout--form">
            <div className="column column--full">
              <p className="ap-lede">
                If you’re accepted we’ll need this before load-in, and we’ll
                walk you through it then. Filling it in now just saves an
                email later.
              </p>
            </div>
            <Field
              name="sellerPermit" label="CA seller’s permit number (optional)"
              error={e.sellerPermit}
              hint="Leave it blank if you don’t have one. We’ll sort it out with you after acceptance."
            >
              {/* No inputMode: a permit number carries a hyphen, and a
                  numeric keypad on a phone has no key for it. */}
              {/* `type` is stated because the theme's field styling keys off
                  `input[type=text]`, and an input with no type attribute
                  rendered at its default size next to full-width neighbours. */}
              <input
                type="text" name="sellerPermit" disabled={occasional}
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

        <section
          className="ap-step" id={STEPS[4]!.id} hidden={step !== 5}
          aria-labelledby={`${STEPS[4]!.id}-h`}
        >
          <StepHead step={STEPS[4]!} />
          <div className="flexible-layout flexible-layout--form">
            <div className="column column--full">
              {/* Everything a maker is agreeing to, reachable from the place
                  they agree to it. All four open in a new tab so a half-filled
                  form is never lost to a click. */}
              <p className="ap-lede">
                Before you sign, the rules for your track:{' '}
                <Link href="/makers/indoor" target="_blank" rel="noreferrer">inside</Link> ·{' '}
                <Link href="/makers/outdoor" target="_blank" rel="noreferrer">outside</Link>.
                {' '}The full{' '}
                <Link href="/agreement" target="_blank" rel="noreferrer">vendor agreement</Link>
                {' '}and our{' '}
                <Link href="/terms" target="_blank" rel="noreferrer">terms and privacy</Link>.
              </p>
              <label className="check-option" htmlFor="agree">
                <input
                  type="checkbox" name="agree" id="agree"
                  defaultChecked={v.agree === 'on'} required
                  aria-describedby={e.agree ? 'agree-error' : undefined}
                  aria-invalid={e.agree ? 'true' : undefined}
                />
                <span>
                  I have read and accept the{' '}
                  <Link href="/agreement" target="_blank" rel="noreferrer">
                    Mermade Market vendor agreement
                  </Link>
                  {' '}(v2026.1).
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

            {/* Non-blocking. Nothing here stops a submit; the server is the
                authority. It just saves a maker a rejected attempt. */}
            {open.length > 0 && (
              <div className="column column--full">
                <div className="ap-open">
                  <p className="ap-open__h">Still open</p>
                  <ul>
                    {open.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button" className="ap-errors__link"
                          onClick={() => go(s.n)}
                        >
                          Step {s.n}: {s.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="column column--full">
              <p className="ap-submit__note">
                No fee to apply. We read every one and answer either way.
              </p>
            </div>
          </div>
        </section>

        {/* The next action, and the money, from every step. Sticks to the
            bottom of the screen on a phone. */}
        <div className="ap-nav">
          <p className="ap-nav__meta">
            <span className="ap-nav__step">Step {step} of {LAST}</span>
            {first && (
              <span className="ap-nav__total">
                Your choice <span className="num">{usd(totalCents)}</span>
              </span>
            )}
          </p>
          <div className="ap-nav__btns">
            {step > 1 && (
              <button
                type="button" className="btn btn--secondary ap-nav__back"
                onClick={() => go(step - 1)}
              >
                Back
              </button>
            )}
            {nextStep ? (
              <button
                type="button" className="btn ap-nav__next"
                onClick={() => go(step + 1)}
              >
                Next<span className="ap-nav__hint">: {nextStep.title}</span>
              </button>
            ) : (
              <button className="btn ap-nav__next" type="submit" disabled={pending}>
                {pending ? 'Sending…' : 'Submit application'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
