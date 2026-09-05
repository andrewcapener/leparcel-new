'use client'

import { useActionState, useState } from 'react'
import { submitApplication, type FormState } from '@/app/actions'
import { CATEGORIES, type Show, type SpaceType } from '@/db/schema'
import { usd } from '@/lib/money'

const initial: FormState = { ok: false }

function Field({
  name, label, hint, error, children,
}: {
  name: string; label: string; hint?: string; error?: string; children: React.ReactNode
}) {
  return (
    <label className="field" htmlFor={name}>
      <span className="lb">{label}</span>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="err">{error}</span>}
    </label>
  )
}

export function ApplyForm({ show, spaces }: { show: Show; spaces: SpaceType[] }) {
  const [state, action, pending] = useActionState(submitApplication, initial)
  const e = state.errors ?? {}
  // Echoed values from a rejected submit — see FormState.values, so a rejected
  // submit costs the applicant one field, not the whole form.
  const v = state.values ?? {}
  const [track, setTrack] = useState<'indoor' | 'outdoor' | 'both'>(
    (v.track as 'indoor' | 'outdoor' | 'both') ?? 'indoor',
  )
  const [occasional, setOccasional] = useState(v.occasionalSeller === 'on')
  const keep = (k: string) => ({ defaultValue: v[k] ?? '' })

  const visible = spaces.filter((s) => track === 'both' || s.track === track)

  if (state.ok) {
    return (
      <section className="apply">
        <div className="k">Received</div>
        <h2 style={{ marginTop: 18 }}>That’s in. We read every one.</h2>
        <p>
          You’ll get a confirmation email in a moment. The {show.name} roster is announced{' '}
          {new Date(show.rosterAnnouncedOn).toLocaleDateString('en-US', {
            timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric',
          })}
          , and we answer either way.
        </p>
      </section>
    )
  }

  return (
    <section className="sec" style={{ background: 'var(--paper-2)' }}>
      <div className="shead">
        <span className="k">Application</span>
        <h2>Tell us about your work</h2>
      </div>

      <form key={state.attempt ?? 0} action={action} style={{ maxWidth: 720 }} noValidate>
        {state.message && !state.ok && (
          <p className="err" style={{ marginBottom: 24, fontSize: 14 }}>{state.message}</p>
        )}

        {/* ── Step 1 · your shop ── */}
        <div className="k" style={{ marginBottom: 20 }}>01 · Your shop</div>
        <Field name="shopName" label="Shop or brand name" error={e.shopName}>
          <input className="inp" id="shopName" name="shopName" required {...keep("shopName")}/>
        </Field>
        <div className="row2">
          <Field name="contactName" label="Your name" error={e.contactName}>
            <input className="inp" id="contactName" name="contactName" required {...keep("contactName")}/>
          </Field>
          <Field name="email" label="Email" error={e.email}>
            <input className="inp" id="email" name="email" type="email" required {...keep("email")}/>
          </Field>
        </div>
        <div className="row2">
          <Field name="phone" label="Phone" error={e.phone}>
            <input className="inp" id="phone" name="phone" required {...keep("phone")}/>
          </Field>
          <Field
            name="instagram" label="Instagram" error={e.instagram}
            hint="It’s the main thing the jury looks at."
          >
            <input className="inp" id="instagram" name="instagram" placeholder="@yourshop" required {...keep("instagram")}/>
          </Field>
        </div>
        <div className="row2">
          <Field name="website" label="Website (optional)" error={e.website}>
            <input className="inp" id="website" name="website" {...keep("website")}/>
          </Field>
          <div className="row2">
            <Field name="city" label="City" error={e.city}>
              <input className="inp" id="city" name="city" required {...keep("city")}/>
            </Field>
            <Field name="state" label="State" error={e.state}>
              <input className="inp" id="state" name="state" {...{ defaultValue: v.state ?? "CA" }} required />
            </Field>
          </div>
        </div>

        {/* ── Step 2 · what you make ── */}
        <div className="k" style={{ margin: '38px 0 20px' }}>02 · What you make</div>
        <Field name="category" label="Primary category" error={e.category}>
          <select className="inp" id="category" name="category" required defaultValue={v.category ?? ''}>
            <option value="" disabled>Choose one</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field
          name="description" label="Describe your product" error={e.description}
          hint="600 characters max. What it is, how it's made, who makes it."
        >
          <textarea className="inp" id="description" name="description" maxLength={600} required {...keep("description")}/>
        </Field>
        <div className="row2">
          <Field name="priceLow" label="Lowest price ($)" error={e.priceLow}>
            <input className="inp" id="priceLow" name="priceLow" type="number" min={1} required {...keep("priceLow")}/>
          </Field>
          <Field name="priceHigh" label="Highest price ($)" error={e.priceHigh}>
            <input className="inp" id="priceHigh" name="priceHigh" type="number" min={1} required {...keep("priceHigh")}/>
          </Field>
        </div>
        <Field name="madeByYou" label="Is everything made by you?" error={e.madeByYou}>
          <select className="inp" id="madeByYou" name="madeByYou" required defaultValue={v.madeByYou ?? 'all'}>
            <option value="all">Yes, I make everything</option>
            <option value="mostly_sourced_components">Mostly, with sourced components</option>
            <option value="curate_resell">I curate and resell</option>
          </select>
        </Field>
        {/* Renegade and Patchwork both added the AI question in 2025.
            docs/01-PRODUCT-SPEC.md §3.1 — add it now, not later. */}
        <div className="row2">
          <Field name="usesAiArtwork" label="Any AI-generated artwork?" error={e.usesAiArtwork}>
            <select className="inp" id="usesAiArtwork" name="usesAiArtwork" defaultValue={v.usesAiArtwork ?? 'no'}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
          <Field name="isMlm" label="Are you an MLM / direct-sales brand?" error={e.isMlm}>
            <select className="inp" id="isMlm" name="isMlm" defaultValue={v.isMlm ?? 'no'}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </Field>
        </div>

        {/* ── Step 3 · track and space ── */}
        <div className="k" style={{ margin: '38px 0 20px' }}>03 · Which track</div>
        <Field name="track" label="Indoor, outdoor, or both" error={e.track}>
          <select
            className="inp" id="track" name="track" value={track}
            onChange={(ev) => setTrack(ev.target.value as typeof track)}
          >
            <option value="indoor">
              Indoor: consignment, {show.commissionBps / 100}% commission, you don’t attend
            </option>
            <option value="outdoor">Outdoor: your own tent, and you keep 100%</option>
            <option value="both">Both</option>
          </select>
        </Field>
        <div className="field">
          <span className="lb">Spaces</span>
          {visible.map((s) => (
            <label key={s.id} className="field" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
              <input type="checkbox" name="spaces" value={s.id} style={{ marginTop: 3 }} />
              <span style={{ fontSize: 14.5, lineHeight: 1.5 }}>
                {s.label} · {usd(s.priceCents)}
                {s.description && (
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-3)' }}>{s.description}</span>
                )}
              </span>
            </label>
          ))}
          <span className="hint">
            Check everything you&rsquo;d say yes to. Outdoor makers can check more than one day.
          </span>
          {e.spaces && <span className="err">{e.spaces}</span>}
        </div>

        {/* ── Step 4 · compliance ──
            OPTIONAL here on purpose. The CDTFA obligation attaches to renting
            space, not to reading an application, so the hard gate is at load-in
            (see /admin/roster). Asking here just gets us a head start on the
            vendors who already have their paperwork. */}
        <div className="k" style={{ margin: '38px 0 20px' }}>04 · Paperwork (optional)</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)', marginBottom: 24, maxWidth: '60ch' }}>
          None of this is required to apply, and none of it affects the jury.
          If you’re accepted we’ll need it before load-in. Answering now just
          means one less email in October.
        </p>
        <Field
          name="sellerPermit" label="CA seller’s permit number (if you have one)" error={e.sellerPermit}
          hint="Leave it blank if you don’t. We’ll sort it out with you after acceptance."
        >
          <input
            className="inp" id="sellerPermit" name="sellerPermit"
            disabled={occasional} aria-invalid={e.sellerPermit ? 'true' : undefined}
          {...keep("sellerPermit")}/>
        </Field>
        <label className="field" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <input
            type="checkbox" name="occasionalSeller"
            checked={occasional} onChange={(ev) => setOccasional(ev.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span style={{ fontSize: 14, lineHeight: 1.5 }}>
            I don’t have one. I think I qualify as an occasional seller (CDTFA 410-D)
          </span>
        </label>
        <label className="field" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <input type="checkbox" name="hasCoi" defaultChecked={v.hasCoi === 'on'} style={{ marginTop: 3 }} />
          <span style={{ fontSize: 14, lineHeight: 1.5 }}>
            I carry my own liability insurance (recommended, not required)
          </span>
        </label>

        {/* ── Step 5 · sign ── */}
        <div className="k" style={{ margin: '38px 0 20px' }}>05 · Agree &amp; submit</div>
        <label className="field" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <input type="checkbox" name="agree" defaultChecked={v.agree === 'on'} style={{ marginTop: 3 }} required />
          <span style={{ fontSize: 14, lineHeight: 1.5 }}>
            I’ve read and accept the Mermade Market vendor agreement (v2026.1).
            {e.agree && <span className="err">{e.agree}</span>}
          </span>
        </label>
        <Field
          name="signedName" label="Type your name to sign" error={e.signedName}
          hint="We record the terms version and timestamp with your signature."
        >
          <input className="inp" id="signedName" name="signedName" required {...keep("signedName")}/>
        </Field>

        <button className="btn" type="submit" disabled={pending} style={{ marginTop: 12 }}>
          {pending ? 'Sending…' : 'Submit application'}
        </button>
        <p className="fine" style={{ marginTop: 18, textAlign: 'left' }}>
          No fee to apply.
        </p>
      </form>
    </section>
  )
}
