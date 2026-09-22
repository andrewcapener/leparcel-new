'use client'

import { useActionState } from 'react'
import { updateShow, type FormState } from '@/app/actions'
import type { Show } from '@/db/schema'
import { isoToLaWall } from '@/lib/dates'

const initial: FormState = { ok: false }

function Field({
  name, label, hint, error, children,
}: {
  name: string; label: string; hint?: string; error?: string; children: React.ReactNode
}) {
  return (
    <label className="adm-field" htmlFor={name}>
      <span className="lb">{label}</span>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="err">{error}</span>}
    </label>
  )
}

/**
 * One block of the form: a legend, a line saying which public surfaces the
 * block drives, a hairline, then the fields. Grouped rather than flat because
 * someone changing a date should not have to read past the commission rate to
 * find it, and because a real fieldset is what a screen reader needs to
 * announce "Dates and hours, Show starts" instead of just "Show starts".
 */
function Block({
  legend, why, children,
}: {
  legend: string; why: string; children: React.ReactNode
}) {
  return (
    <fieldset className="adm-fs">
      <legend className="k">{legend}</legend>
      <p className="why">{why}</p>
      {children}
    </fieldset>
  )
}

export function SettingsForm({ show }: { show: Show }) {
  const [state, action, pending] = useActionState(updateShow, initial)
  const e = state.errors ?? {}
  const v = state.values ?? {}
  const keep = (k: string, fallback: string) => ({ defaultValue: v[k] ?? fallback })
  const problems = Object.keys(e).length

  return (
    <form key={state.attempt ?? 0} action={action} style={{ maxWidth: 720 }} noValidate>
      <Block
        legend="Venue"
        why="The home page venue block, the site footer, /schedule, /apply, and the address written into the add to calendar file."
      >
        <div className="adm-row2">
          <Field
            name="venueName" label="Venue name" error={e.venueName}
            hint="Rendered after “Dana Point” in the footer and the masthead line."
          >
            <input className="inp" id="venueName" name="venueName" required {...keep('venueName', show.venueName)} />
          </Field>
          <Field
            name="venueAddress" label="Address" error={e.venueAddress}
            hint="One line, as it should read on a phone map."
          >
            <input className="inp" id="venueAddress" name="venueAddress" required {...keep('venueAddress', show.venueAddress)} />
          </Field>
        </div>
      </Block>

      <Block
        legend="Dates and hours · all times Pacific"
        why="The hero dates, the masthead banner, /schedule, the calendar file, and the run of show on both maker pages."
      >
        <div className="adm-row2">
          <Field
            name="startsOn" label="Show starts" error={e.startsOn}
            hint="First public hour of the show, not load-in."
          >
            <input className="inp" id="startsOn" name="startsOn" type="datetime-local" required {...keep('startsOn', isoToLaWall(show.startsOn))} />
          </Field>
          <Field
            name="endsOn" label="Show ends" error={e.endsOn}
            hint="Last public hour. The hero renders the two as one range."
          >
            <input className="inp" id="endsOn" name="endsOn" type="datetime-local" required {...keep('endsOn', isoToLaWall(show.endsOn))} />
          </Field>
        </div>
        <Field
          name="hoursNote" label="Hours, as shown to shoppers" error={e.hoursNote}
          hint="One day per segment, separated by “ · ”. Five pages split on that separator, so keep it."
        >
          <input className="inp" id="hoursNote" name="hoursNote" required {...keep('hoursNote', show.hoursNote)} />
        </Field>
        <div className="adm-row2">
          <Field
            name="loadInNote" label="Load-in inside, as shown to makers" error={e.loadInNote}
            hint="The evening before the doors open. Appears on /makers/indoor, on /apply above the set-up times, and in the signed agreement. Prose, e.g. “Thursday 12 November, 1-7pm”."
          >
            <input className="inp" id="loadInNote" name="loadInNote" {...keep('loadInNote', show.loadInNote)} />
          </Field>
          <Field
            name="outdoorLoadInNote" label="Load-in outside, as shown to makers"
            error={e.outdoorLoadInNote}
            hint="Outside sets up the morning of the day they booked, so it gets its own line. Prose, e.g. “7am on your day”. The page adds the time the market opens, so do not type that here."
          >
            <input
              className="inp" id="outdoorLoadInNote" name="outdoorLoadInNote"
              {...keep('outdoorLoadInNote', show.outdoorLoadInNote)}
            />
          </Field>
          <Field
            name="takedownNote" label="Take-down, as shown to makers" error={e.takedownNote}
            hint="Same three pages. Left blank, they read “announced with your acceptance”."
          >
            <input className="inp" id="takedownNote" name="takedownNote" {...keep('takedownNote', show.takedownNote)} />
          </Field>
          <Field
            name="loadInSlots" label="Set-up time slots" error={e.loadInSlots}
            hint="Comma separated, e.g. “1-3pm, 3-5pm, 5-7pm”. Indoor makers pick from these on the application and staff build the arrival schedule from the answers. Left blank, the question is not asked."
          >
            <input className="inp" id="loadInSlots" name="loadInSlots" {...keep('loadInSlots', show.loadInSlots)} />
          </Field>
        </div>
      </Block>

      <Block
        legend="The application window"
        why="The banner across the top of every public page, whether /apply accepts a submission, and the date the confirmation email promises an answer by."
      >
        <div className="adm-row2">
          <Field
            name="applicationsOpenAt" label="Applications open" error={e.applicationsOpenAt}
            hint="Before this, /apply shows the date instead of the form."
          >
            <input className="inp" id="applicationsOpenAt" name="applicationsOpenAt" type="datetime-local" required {...keep('applicationsOpenAt', isoToLaWall(show.applicationsOpenAt))} />
          </Field>
          <Field
            name="applicationsCloseAt" label="Applications close" error={e.applicationsCloseAt}
            hint="Set the minute, not the day: 23:59 Pacific is what makers are told."
          >
            <input className="inp" id="applicationsCloseAt" name="applicationsCloseAt" type="datetime-local" required {...keep('applicationsCloseAt', isoToLaWall(show.applicationsCloseAt))} />
          </Field>
        </div>
        <Field
          name="rosterAnnouncedOn" label="Roster announced" error={e.rosterAnnouncedOn}
          hint="The promise on /apply, in the application form, on the roster page, and in every waitlist email."
        >
          <input className="inp" id="rosterAnnouncedOn" name="rosterAnnouncedOn" type="datetime-local" required {...keep('rosterAnnouncedOn', isoToLaWall(show.rosterAnnouncedOn))} />
        </Field>
      </Block>

      <Block
        legend="Money and capacity"
        why="The rate on /makers/indoor and on the application, the deadline in the acceptance email, and the space counts on both maker pages, /faq and the jury header."
      >
        <div className="adm-row2">
          <Field
            name="commissionPct" label="Commission (%)" error={e.commissionPct}
            hint="Applies to future acceptances only. Existing bookings keep the rate they were promised."
          >
            <input className="inp num" id="commissionPct" name="commissionPct" type="number" step="0.25" min="0" max="50" required {...keep('commissionPct', String(show.commissionBps / 100))} />
          </Field>
          {/* The deadline everybody is actually given, so it reads before
              the fallback rather than under it. Drew looked for it on 21
              Sept, found the hours box first, and reported that the only
              choices were 48 hours or a time. */}
          <Field
            name="paymentDueOn" label="Booth fees due by" error={e.paymentDueOn}
            hint="One date for every maker, at 11:59pm Pacific. Pick a date and this is the deadline."
          >
            <input className="inp" id="paymentDueOn" name="paymentDueOn" type="date"
              {...keep('paymentDueOn', show.paymentDueAt ? show.paymentDueAt.slice(0, 10) : '')} />
          </Field>
          <Field
            name="paymentWindowHours" label="Least time anyone gets (hours)" error={e.paymentWindowHours}
            hint="A floor under the date above, so a maker accepted the night before it still gets this long. With no date set, this is the whole deadline, counted from each acceptance."
          >
            <input className="inp num" id="paymentWindowHours" name="paymentWindowHours" type="number" min="1" max="240" required {...keep('paymentWindowHours', String(show.paymentWindowHours))} />
          </Field>
        </div>
        <div className="adm-row2">
          <Field
            name="paymentMethods" label="How makers pay the booth fee" error={e.paymentMethods}
            hint="Bank transfer costs us 0.8% capped at $5; card costs 2.9% + 30c, so on a $450 booth that is $5 against $13.35. Bank transfer takes about four business days to arrive, so with bank only the window above becomes a deadline to START a transfer, not to have paid. A maker who starts one keeps their space while it clears."
          >
            <select id="paymentMethods" name="paymentMethods" className="inp" required {...keep('paymentMethods', show.paymentMethods)}>
              <option value="card_and_bank">Card or bank transfer</option>
              <option value="bank_only">Bank transfer only (cheapest, slowest)</option>
              <option value="card_only">Card only</option>
            </select>
          </Field>
          <Field
            name="decisionEmails" label="Email makers when you decide" error={e.decisionEmails}
            hint="Off means accepting, declining, waitlisting or releasing a space sends nothing: you write the email yourself and paste the maker's payment link from the roster. It does not affect the receipt a maker gets when they apply, or the sign-in link they ask for. Off is the safe default, because turning it on mails everybody you decide on from that moment."
          >
            <select id="decisionEmails" name="decisionEmails" className="inp" required {...keep('decisionEmails', show.decisionEmails)}>
              <option value="off">Off, we send our own</option>
              <option value="on">On, send automatically</option>
            </select>
          </Field>
          <Field
            name="paymentEmail" label="Email the booth fee when you accept" error={e.paymentEmail}
            hint="Separate from the acceptance email above, and safe to run alongside a welcome you write yourself. It says nothing about the jury: the space, the fee, the deadline and a button that opens their invoice with no sign-in. Sent once per booking."
          >
            <select id="paymentEmail" name="paymentEmail" className="inp" required {...keep('paymentEmail', show.paymentEmail)}>
              <option value="off">Off</option>
              <option value="on">On, send the fee automatically</option>
            </select>
          </Field>
          <Field
            name="payoutSetup" label="Ask indoor makers to set up payouts" error={e.payoutSetup}
            hint="How a maker gets PAID, which is a different Stripe account from the one that takes their booth fee. Leave this off until Connect is enabled on the Stripe account and the fee window has closed: it cannot work before the first, and during the second it competes with the ask that has a deadline. Turning it on puts the setup on every indoor maker's account page. Outdoor makers are never asked, because they take their own money."
          >
            <select id="payoutSetup" name="payoutSetup" className="inp" required {...keep('payoutSetup', show.payoutSetup)}>
              <option value="off">Off, not yet</option>
              <option value="on">On, ask indoor makers</option>
            </select>
          </Field>
        </div>
        <div className="adm-row2">
          <Field
            name="venmoHandle" label="Venmo handle" error={e.venmoHandle}
            hint="Shown on a maker's own payment page, never in an email, and that is the point: a handle in an email is the exact shape of the scam that takes a booth fee off forty makers. Leave empty and Venmo is not offered. These payments do not confirm themselves, so somebody has to press Mark paid on the roster. The maker's MM code is prefilled into the payment note so you are matching a code, not a name."
          >
            <input className="inp" id="venmoHandle" name="venmoHandle" type="text"
              placeholder="@MermadeMarket" {...keep('venmoHandle', show.venmoHandle)} />
          </Field>
          <Field
            name="zelleContact" label="Zelle email or phone" error={e.zelleContact}
            hint="Same rules as Venmo, with one extra warning: Zelle is instant and cannot be reversed, and it has no dispute process. A maker who sends to the wrong contact has lost the money for good. Leave empty and Zelle is not offered."
          >
            <input className="inp" id="zelleContact" name="zelleContact" type="text"
              placeholder="949-672-8019" {...keep('zelleContact', show.zelleContact)} />
          </Field>
          <Field
            name="zelleName" label="Zelle registered name" error={e.zelleName}
            hint={'Exactly as your bank\u2019s own Zelle code shows it, which is not always the market\u2019s name: ours reads "MERMADE MARKET LLC Accounts". Only used to draw the scannable code, and a wrong one would show a maker a recipient that does not match us. Leave empty and the Zelle contact still shows without a code.'}
          >
            <input className="inp" id="zelleName" name="zelleName" type="text"
              placeholder="MERMADE MARKET LLC Accounts" {...keep('zelleName', show.zelleName)} />
          </Field>
        </div>
        <div className="adm-row2">
          <Field
            name="onboardingSlotsIndoor" label="Onboarding call times, indoor" error={e.onboardingSlotsIndoor}
            hint={'One option per line, exactly as a maker should read it. "Not needed" is a fine option and marks the row answered. Leave this empty and indoor makers are never asked, which is what you want until the times exist.'}
          >
            <textarea className="inp" id="onboardingSlotsIndoor" name="onboardingSlotsIndoor"
              style={{ minHeight: 96 }} {...keep('onboardingSlotsIndoor', show.onboardingSlotsIndoor)} />
          </Field>
          <Field
            name="onboardingSlotsOutdoor" label="Onboarding call times, outdoor" error={e.onboardingSlotsOutdoor}
            hint="The outdoor list is separate because the times are. Same rules: one per line, empty means nobody outdoor is asked."
          >
            <textarea className="inp" id="onboardingSlotsOutdoor" name="onboardingSlotsOutdoor"
              style={{ minHeight: 96 }} {...keep('onboardingSlotsOutdoor', show.onboardingSlotsOutdoor)} />
          </Field>
        </div>
        <div className="adm-row2">
          <Field
            name="inventoryDueAt" label="Item list due" error={e.inventoryDueAt}
            hint="Indoor makers only: Mermade rings those sales, so Mermade needs the catalogue, and an outdoor maker runs their own register. Leave empty and the row still appears without a date. The upload itself is not built yet; this is the date it promises."
          >
            <input className="inp" id="inventoryDueAt" name="inventoryDueAt" type="date"
              {...keep('inventoryDueAt', show.inventoryDueAt ? isoToLaWall(show.inventoryDueAt).slice(0, 10) : '')} />
          </Field>
        </div>
        <div className="adm-row2">
          <Field
            name="indoorCapacity" label="Indoor capacity" error={e.indoorCapacity}
            hint="Spaces on the floor. The jury header counts committed bookings against this."
          >
            <input className="inp num" id="indoorCapacity" name="indoorCapacity" type="number" min="0" required {...keep('indoorCapacity', String(show.indoorCapacity))} />
          </Field>
          <Field
            name="outdoorCapacity" label="Outdoor capacity" error={e.outdoorCapacity}
            hint="Tents in the lot, counted the same way."
          >
            <input className="inp num" id="outdoorCapacity" name="outdoorCapacity" type="number" min="0" required {...keep('outdoorCapacity', String(show.outdoorCapacity))} />
          </Field>
        </div>
      </Block>

      {/* The bar rides the bottom of the window, so Save is reachable from any
          block and the result of the last save is where the eye already is. */}
      <div className="adm-save">
        <button className="adm-btn" type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save settings'}
        </button>
        <p className="msg" data-ok={state.ok ? '1' : '0'} role="status" aria-live="polite">
          {state.message
            ? (state.ok ? `${state.message} The public site updates immediately.` : state.message)
            : problems > 0
              ? `${problems} ${problems === 1 ? 'field needs' : 'fields need'} a look.`
              : ''}
        </p>
        <span className="drive">Saved changes are audit-logged</span>
      </div>
    </form>
  )
}
