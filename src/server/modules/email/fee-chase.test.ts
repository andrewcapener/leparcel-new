import {
  chasePlan, chaseText, spacePhrase, pacificDay, owedCents, chaseIdempotencyKey,
  nextNineAmPacific, pacificWallToUtc, chaseBatchBody, CHASE_SUBJECT,
  type ChaseBooking,
} from './fee-chase'

/**
 * Who gets an email, and who does not.
 *
 * This is the test that matters on this file, because a wrong answer here is
 * not a bug on a screen, it is sixty makers being told something false about
 * their own money on the morning it is due.
 */

let failures = 0
function ok(what: string, cond: boolean, detail = '') {
  if (!cond) { console.error(`FAIL ${what}${detail ? `\n     ${detail}` : ''}`); failures++ }
}
const eq = (what: string, got: unknown, want: unknown) =>
  ok(what, Object.is(got, want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)

const base: ChaseBooking = {
  bookingId: 'b1', vendorCode: 'MM02', shopName: 'Bare Simplicity',
  contactName: 'Rosie Alcala', email: 'rosie@example.com',
  track: 'indoor', spaceLabel: '3x6', totalCents: 28000,
  status: 'awaiting_payment', payToken: 'tok1',
  /* 11:59pm Pacific on 23 Sept is 06:59 UTC on the 24th. Every date in this
     file is written in that shape on purpose. */
  paymentDueAt: '2026-09-24T06:59:00.000Z',
}
const b = (over: Partial<ChaseBooking>): ChaseBooking => ({ ...base, ...over })
const url = (t: string) => `https://mermademarket.com/pay/${t}`
const TODAY = '2026-09-23'
const plan = (rows: ChaseBooking[]) => chasePlan(rows, TODAY, url)

/* ── the timezone, which is the whole thing (rule 8) ── */

eq('11:59pm Pacific on the 23rd is the 23rd, not the 24th',
  pacificDay('2026-09-24T06:59:00.000Z'), '2026-09-23')
eq('one minute later is the 24th',
  pacificDay('2026-09-24T07:00:00.000Z'), '2026-09-24')
eq('midday Pacific is the same day', pacificDay('2026-09-23T19:00:00.000Z'), '2026-09-23')

/* ── who is chased ── */

{
  const p = plan([base])
  eq('an unpaid maker due today is chased', p.send.length, 1)
  eq('and nobody is held', p.held.length, 0)
}

for (const [status, why] of [
  ['confirmed', 'paid'],
  ['payment_processing', 'a transfer in flight'],
  ['forfeited', 'a released space'],
  ['cancelled', 'a cancelled booking'],
] as const) {
  const p = plan([b({ status })])
  eq(`${why} is never chased`, p.send.length, 0)
  eq(`${why} is held with a reason`, p.held.length, 1)
  ok(`${why} says why`, (p.held[0]?.because ?? '').length > 4)
}

{
  /* The three makers on full credits. An email demanding $0.00 by tonight or
     you lose your space is the one that gets screenshotted. */
  const p = plan([b({ totalCents: 0, shopName: 'On Board Organics' })])
  eq('a maker who owes nothing is not chased', p.send.length, 0)
  ok('and the reason says so', /nothing/i.test(p.held[0]?.because ?? ''))
}

{
  /* The four accepted yesterday afternoon, whose 48 hours run past tonight. */
  const p = plan([b({ paymentDueAt: '2026-09-24T20:31:00.000Z', shopName: 'Truly Kustom' })])
  eq('a maker whose deadline is tomorrow is not chased today', p.send.length, 0)
  ok('and the reason names the 48 hours', /48 hours/.test(p.held[0]?.because ?? ''))
}

{
  const p = plan([b({ paymentDueAt: '2026-09-23T06:59:00.000Z' })])
  eq('a deadline that already passed is not chased with "due today"', p.send.length, 0)
  ok('and the reason says it would be wrong', /passed/.test(p.held[0]?.because ?? ''))
}

for (const [field, value] of [['payToken', null], ['paymentDueAt', null]] as const) {
  const p = plan([b({ [field]: value } as Partial<ChaseBooking>)])
  eq(`a booking with no ${field} is held, not mailed`, p.send.length, 0)
  ok(`and it is flagged for a person`, /look/.test(p.held[0]?.because ?? ''))
}

{
  /* Nobody is ever silently dropped. Every row lands in exactly one list, so
     a maker missing from the send is a maker somebody can find and argue about. */
  const rows = [
    base,
    b({ bookingId: 'b2', status: 'confirmed' }),
    b({ bookingId: 'b3', totalCents: 0 }),
    b({ bookingId: 'b4', paymentDueAt: '2026-09-24T20:31:00.000Z' }),
    b({ bookingId: 'b5', payToken: null }),
  ]
  const p = plan(rows)
  eq('every booking is accounted for', p.send.length + p.held.length, rows.length)
  const seen = new Set([...p.send.map((s) => s.booking.bookingId),
    ...p.held.map((h) => h.booking.bookingId)])
  eq('and none of them twice', seen.size, rows.length)
}

/* ── the money ── */

{
  const p = plan([base, b({ bookingId: 'b2', totalCents: 34000 }),
    b({ bookingId: 'b3', status: 'confirmed', totalCents: 99900 })])
  eq('owed counts only who is being chased', owedCents(p), 62000)
}

/* ── the words ── */

eq('an indoor footprint reads as a sentence',
  spacePhrase('indoor', '3x6'), 'Your indoor space (3x6)')
eq('so does a JR space, which "your JR Space space" would not',
  spacePhrase('indoor', 'JR Space'), 'Your indoor space (JR Space)')
eq('an outdoor day does not say outdoor twice',
  spacePhrase('outdoor', 'Outdoor Saturday'), 'Your outdoor booth (Saturday)')

{
  const body = chaseText(base, url('tok1'))
  ok('it opens with their name', body.startsWith('Rosie Alcala,'))
  ok('it carries their own fee', body.includes('$280'))
  ok('it carries their own link', body.includes('https://mermademarket.com/pay/tok1'))
  ok('it says when', body.includes('due today by 11:59pm'))
  ok('it signs off as agreed', body.trimEnd().endsWith('Elise, Hillary and the Mermade Team'))
  /* docs/12-VOICE.md rule 2, and Drew asked for the signature dash gone too,
     so there is no dash anywhere in this one. Built from char codes because
     src/lib/dashes.test.ts rejects both the literal and the escape, in test
     files too, and it is right to. */
  const emDash = String.fromCharCode(8212)
  const enDash = String.fromCharCode(8211)
  ok('no em dash', !body.includes(emDash))
  ok('no en dash', !body.includes(enDash))
  ok('no exclamation point', !body.includes('!'))
}

{
  const fee = chaseText(b({ totalCents: 6000, spaceLabel: 'JR Space' }), url('t'))
  ok('a whole-dollar fee has no trailing cents', fee.includes('$60,') || fee.includes('$60 '))
  ok('and never renders as a float', !/\$60\.0000/.test(fee))
}

/* ── pressing twice ── */

eq('the same morning is the same key',
  chaseIdempotencyKey('show1', TODAY), chaseIdempotencyKey('show1', TODAY))
ok('a different day is a different key',
  chaseIdempotencyKey('show1', TODAY) !== chaseIdempotencyKey('show1', '2026-09-24'))

/* ── when it arrives ── */

{
  /* Pacific daylight time, UTC-7. 9am on the 23rd is 16:00Z. */
  eq('9am PDT is 16:00Z',
    pacificWallToUtc('2026-09-23', 9, 0).toISOString(), '2026-09-23T16:00:00.000Z')
  /* Standard time, UTC-8, after the November change. The show is in November,
     so this is not hypothetical. */
  eq('9am PST is 17:00Z',
    pacificWallToUtc('2026-11-14', 9, 0).toISOString(), '2026-11-14T17:00:00.000Z')
  eq('and 11:59pm PST is the next day in UTC',
    pacificWallToUtc('2026-11-14', 23, 59).toISOString(), '2026-11-15T07:59:00.000Z')
}

{
  /* Tuesday evening, the night Drew asked for this. */
  const tuesdayEvening = new Date('2026-09-23T02:00:00.000Z')
  eq('the next 9am from Tuesday evening is Tuesday morning Pacific',
    nextNineAmPacific(tuesdayEvening).toISOString(), '2026-09-23T16:00:00.000Z')
  ok('and it is in the future', nextNineAmPacific(tuesdayEvening) > tuesdayEvening)
}

{
  /* Ten past nine. The next one is tomorrow, never four minutes ago. */
  const justAfter = new Date('2026-09-23T16:10:00.000Z')
  eq('ten past nine rolls to tomorrow',
    nextNineAmPacific(justAfter).toISOString(), '2026-09-24T16:00:00.000Z')
}

for (const at of ['2026-01-15T20:00:00.000Z', '2026-03-08T12:00:00.000Z',
  '2026-11-01T09:00:00.000Z', '2026-07-04T23:00:00.000Z']) {
  const next = nextNineAmPacific(new Date(at))
  ok(`${at}: the next 9am is always ahead`, next.getTime() > new Date(at).getTime())
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit',
  }).format(next)
  eq(`${at}: and it really is 9am in Dana Point`, Number(hour) % 24, 9)
}

/* ── what Resend actually receives ── */

{
  const p = plan([base, b({ bookingId: 'b2', email: 'shea@example.com', totalCents: 34000 })])
  const at = '2026-09-23T16:00:00.000Z'
  const body = chaseBatchBody(p.send, 'Mermade Market <hello@mermademarket.com>',
    'hello@mermademarket.com', at)

  eq('one entry per maker', body.length, 2)
  eq('each carries exactly one address', JSON.stringify(body[0]!.to), '["rosie@example.com"]')
  ok('and never somebody else as well',
    body.every((e) => (e.to as string[]).length === 1))
  eq('every one is scheduled for the same instant',
    body.every((e) => e.scheduled_at === at), true)
  ok('the instant is ISO 8601, not a phrase',
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(String(body[0]!.scheduled_at)))
  eq('replies reach a person', body[0]!.reply_to, 'hello@mermademarket.com')
  eq('the subject is the agreed one', body[0]!.subject, CHASE_SUBJECT)
  ok('plain text only, no html part', !('html' in body[0]!))
  ok('each body is that maker own fee',
    String(body[0]!.text).includes('$280') && String(body[1]!.text).includes('$340'))
  ok('and their own link',
    String(body[0]!.text).includes('/pay/tok1'))
}

if (failures > 0) { console.error(`\n${failures} failure(s).`); process.exit(1) }
console.log('fee chase: nobody is chased for money they do not owe, on a day that is not theirs')
