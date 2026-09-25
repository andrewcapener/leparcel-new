/**
 * The pure half of re-invoicing a maker.
 *
 * Every case here is one a person would otherwise find out about by reading an
 * email a maker already received: a balance shown as the original total, an
 * invoice whose rows do not add up to what the button charges, a date in the
 * past in a sentence that says "by", or a $10,000 line made by a slipped key.
 * The two 'use server' files next door are thin on purpose so that all of it
 * can be checked here.
 */
import { invoiceFor, type Invoice } from '@/server/modules/payments/invoice'
import { usd } from '@/lib/money'
import { hasFancyDash } from '@/lib/dashes'
import {
  NOTE_MAX, backTo, centsFromDollars, chargeNotice, cleanNote, dueLabel,
  invoiceFields, invoiceView, resendDeadline, resendNotice, resendProblem,
  resendSubject, addonNotice,
} from './resend-lines'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  if (!ok) { failures += 1; console.error(`  FAIL ${name}${detail ? `: ${detail}` : ''}`) }
}
const eq = (name: string, got: unknown, want: unknown) =>
  check(name, Object.is(got, want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)

/* ── the invoice a maker is being sent again ─────────────────────────────── */

/** An outdoor booth, one add-on, nothing paid. */
const fresh: Invoice = invoiceFor({
  spaceLabel: '10x10 outdoor booth',
  spacePriceCents: 45000,
  addons: [{ name: 'Tent rental', priceCents: 10000 }],
})

/** The case this whole feature exists for: paid, then Sunday was added. */
const partPaid: Invoice = invoiceFor({
  spaceLabel: '10x10 outdoor booth',
  spacePriceCents: 45000,
  addons: [],
  charges: [{ label: 'Sunday, second day', amountCents: 35000 }],
  paidCents: 45000,
})

eq('nothing paid: the total is the whole fee', dueLabel(fresh), '$550')
eq('part paid: the total is the balance', dueLabel(partPaid), '$350')

{
  const rows = invoiceFields(fresh)
  eq('an unpaid invoice shows its lines and nothing else', rows.length, 2)
  eq('the space comes first', rows[0].label, '10x10 outdoor booth')
  eq('priced in dollars', rows[0].value, '$450')
  check('and no paid row', !rows.some((r) => r.label === 'Already paid'))
}

{
  const rows = invoiceFields(partPaid)
  eq('a part paid invoice names what arrived', rows[2].label, 'Already paid')
  eq('as a subtraction', rows[2].value, '-$450')
  /* The template appends a strong Total row after these, so the rows shown
     have to add up to it. A maker who adds up the invoice and gets a different
     answer than the button charges has caught us being wrong. */
  const shown = rows
    .filter((r) => r.label !== 'What changed')
    .reduce((sum, r) => sum + Math.round(Number(r.value.replace(/[$,]/g, '')) * 100), 0)
  eq('and the rows add up to the total row', usd(shown), dueLabel(partPaid))
}

{
  const { lines, totalLabel } = invoiceView(partPaid, 'Added Sunday and a corner.')
  eq('a note leads, because it answers why this arrived', lines[0].label, 'What changed')
  eq('with the staff words', lines[0].value, 'Added Sunday and a corner.')
  eq('and the total is still the balance', totalLabel, '$350')
  eq('no note, no row', invoiceView(partPaid).lines[0].label, '10x10 outdoor booth')
}

/* A downgrade is a negative line, and it must read as one rather than as a
   charge. Hillary moved a maker from a 3x8 to a 3x6 after she had paid. */
{
  const credited = invoiceFor({
    spaceLabel: '3x8 indoor shelf',
    spacePriceCents: 24000,
    addons: [],
    charges: [{ label: 'Moved to a 3x6, difference back', amountCents: -6000 }],
    paidCents: 24000,
  })
  eq('an overpaid booking owes nothing', dueLabel(credited), '$0')
  eq('and the credit shows as a minus', invoiceFields(credited)[1].value, '-$60')
}

/* ── the subject line ───────────────────────────────────────────────────── */

eq('nothing paid reads as the fee',
  resendSubject('Winter Market', fresh), 'Your booth fee: Winter Market')
eq('part paid reads as a balance',
  resendSubject('Winter Market', partPaid), 'Your booth fee balance: Winter Market')

/* ── may we ask for money at all ────────────────────────────────────────── */

const token = 'a'.repeat(64)
const base = { status: 'awaiting_payment', amountDueCents: 55000, payToken: token, email: 'maker@example.com' }

eq('an unpaid booking is invoiced', resendProblem(base), null)
eq('so is a confirmed one that grew a second day',
  resendProblem({ ...base, status: 'confirmed' }), null)
/* The one that must never be invoiced: her money is already on its way, and a
   second ask is how somebody pays twice for the same space. */
eq('a transfer in flight is refused',
  resendProblem({ ...base, status: 'payment_processing' }), 'released')
eq('a released space is refused',
  resendProblem({ ...base, status: 'forfeited' }), 'released')
eq('a cancelled booking is refused',
  resendProblem({ ...base, status: 'cancelled' }), 'released')
eq('a settled booking is refused rather than mailed a $0 invoice',
  resendProblem({ ...base, amountDueCents: 0 }), 'settled')
eq('so is an overpaid one',
  resendProblem({ ...base, amountDueCents: -1000 }), 'settled')
eq('no pay token means the email would name no way to pay',
  resendProblem({ ...base, payToken: null }), 'nolink')
eq('and a stub token is no token', resendProblem({ ...base, payToken: 'short' }), 'nolink')
eq('no address, nothing to send to', resendProblem({ ...base, email: '' }), 'noaddress')

/* ── the date in the sentence ───────────────────────────────────────────── */

const now = '2026-10-03T19:00:00.000Z'
{
  /* Her own deadline, while it is still ahead of us. That is the date on the
     roster and the one the forfeit job reads. */
  const ahead = resendDeadline({
    dueAtIso: '2026-10-05T06:59:00.000Z', nowIso: now,
    fixedAt: '2026-09-23T06:59:00.000Z', windowHours: 48,
  })
  eq('a live deadline is the booking\'s own', ahead.basis, 'booking')
  check('rendered Pacific', ahead.label.includes('PT'), ahead.label)
  check('and is a date, not a timestamp', /October 4|October 5/.test(ahead.label), ahead.label)
}
{
  /* Past. The template says "pay to confirm your space by X", so this date
     cannot be the one that has gone: the show's own window is applied from
     now instead, and nothing on the booking is rewritten. */
  const stale = resendDeadline({
    dueAtIso: '2026-09-23T06:59:00.000Z', nowIso: now,
    fixedAt: '2026-09-23T06:59:00.000Z', windowHours: 48,
  })
  eq('a passed deadline falls back to the show window', stale.basis, 'window')
  check('which is ahead of now', !stale.label.includes('September'), stale.label)
}
eq('a booking with no deadline gets the window too',
  resendDeadline({ dueAtIso: null, nowIso: now, fixedAt: null, windowHours: 48 }).basis,
  'window')
eq('and so does a nonsense one',
  resendDeadline({ dueAtIso: 'soon', nowIso: now, fixedAt: null, windowHours: 48 }).basis,
  'window')

/* ── staff typing money ─────────────────────────────────────────────────── */

eq('plain dollars', centsFromDollars('350'), 35000)
eq('with a sign and a comma', centsFromDollars('$1,250.50'), 125050)
eq('a minus takes money off', centsFromDollars('-60'), -6000)
eq('two decimal places survive exactly', centsFromDollars('2.90'), 290)
/* The one a float multiply gets wrong: 2.9 * 100 is 289.99999999999994. */
eq('one decimal place is not rounded against anybody', centsFromDollars('2.9'), 290)
eq('empty is not zero', centsFromDollars(''), null)
eq('and neither is a space', centsFromDollars('   '), null)
eq('scientific notation is nonsense here', centsFromDollars('1e4'), null)
eq('so are words', centsFromDollars('four hundred'), null)
eq('so is half a cent', centsFromDollars('1.005'), null)
eq('so is a second dot', centsFromDollars('1.0.0'), null)
eq('so is a bare minus', centsFromDollars('-'), null)
eq('and so is a number nobody meant', centsFromDollars('9999999999'), null)

/* ── the staff note ─────────────────────────────────────────────────────── */

eq('a note is trimmed to one line',
  cleanNote('  Added Sunday\n  and a corner.  '), 'Added Sunday and a corner.')
/* Copy arrives by paste and from phones, which produce en dashes unasked.
   docs/12-VOICE.md rule 2 rules them out of anything a maker reads. */
/* Built rather than typed: src/lib/dashes.test.ts refuses the escape as well
   as the character, everywhere but the two files whose job is dashes. */
const EN = String.fromCharCode(0x2013)
check('and carries no fancy dash', !hasFancyDash(cleanNote(`Sunday ${EN} Monday`)))
eq('a range becomes words', cleanNote(`Sunday ${EN} Monday`), 'Sunday to Monday')
eq('a long note is capped', cleanNote('x'.repeat(NOTE_MAX + 50)).length, NOTE_MAX)
eq('nothing typed is nothing shown', cleanNote(''), '')

/* ── getting back to the screen she pressed from ─────────────────────────── */

eq('a filtered roster keeps its filter',
  backTo('/admin/roster?track=outdoor&fee=unpaid', 'resend', 'sent'),
  '/admin/roster?track=outdoor&fee=unpaid&resend=sent')
eq('a bare path gets a question mark',
  backTo('/admin/roster', 'resend', 'sent'), '/admin/roster?resend=sent')
eq('one maker\'s own page works the same',
  backTo('/admin/roster/abc123', 'charge', 'edited'),
  '/admin/roster/abc123?charge=edited')
/* `back` is a form field, so it is somebody else's input. */
eq('another site is refused',
  backTo('https://evil.example.com', 'resend', 'sent'), '/admin/roster?resend=sent')
eq('a protocol-relative url is refused',
  backTo('//evil.example.com', 'resend', 'sent'), '/admin/roster?resend=sent')
eq('a path outside the admin is refused',
  backTo('/account', 'resend', 'sent'), '/admin/roster?resend=sent')
eq('and so is nonsense', backTo('', 'resend', 'sent'), '/admin/roster?resend=sent')

/* ── what the screen says afterwards ────────────────────────────────────── */

const CODES = ['sent', 'logged', 'failed', 'settled', 'released', 'nolink', 'noaddress', 'missing']
for (const code of CODES) {
  const said = resendNotice(code)
  check(`${code} says something`, Boolean(said && said.length > 20), String(said))
  check(`${code} says it without a fancy dash`, !hasFancyDash(said ?? ''))
  check(`${code} has no exclamation point`, !(said ?? '').includes('!'))
}
eq('an unknown outcome renders nothing at all', resendNotice('wat'), null)

for (const code of ['edited', 'same', 'voided', 'mismatch', 'bad', 'missing']) {
  const said = chargeNotice(code)
  check(`charge ${code} says something`, Boolean(said && said.length > 20), String(said))
  check(`charge ${code} says it without a fancy dash`, !hasFancyDash(said ?? ''))
}
eq('and an unknown charge outcome renders nothing', chargeNotice('wat'), null)

/* Every refusal resendProblem can return has a notice, or a staff member
   presses a button, is refused, and is told nothing at all. */
for (const code of ['settled', 'released', 'nolink', 'noaddress'] as const) {
  check(`${code} is answered on screen`, Boolean(resendNotice(code)))
}

/* The one an add-on notice must never leave out. Taking the tent off does not
   move money on its own, and a screen that implies it did is how a maker ends
   up never refunded. */
check('taking an add-on off never implies a refund happened',
  (addonNotice('voided') ?? '').includes('does not refund'))
check('and every add-on notice is dash free and unexcited',
  ['voided', 'already', 'missing'].every((c) => {
    const t = addonNotice(c) ?? ''
    return t.length > 0 && !t.includes('!')
      && !t.includes(String.fromCharCode(0x2014)) && !t.includes(String.fromCharCode(0x2013))
  }))
check('an unknown add-on code says nothing at all',
  addonNotice('nonsense') === null)

if (failures > 0) {
  console.error(`\nresend lines: ${failures} failure(s)`)
  process.exit(1)
}
console.log('resend lines: the balance is what goes out, the rows add up, and a passed deadline never reaches a maker')
