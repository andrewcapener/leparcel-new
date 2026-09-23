import {
  deadlineChanges, deadlineMatters, losesTime, type DeadlineRow,
} from './align-deadline'

let failures = 0
function ok(what: string, cond: boolean, detail = '') {
  if (!cond) { console.error(`FAIL ${what}${detail ? `\n     ${detail}` : ''}`); failures++ }
}
const eq = (what: string, got: unknown, want: unknown) =>
  ok(what, Object.is(got, want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)

/** 11:59pm Pacific on 23 Sept. */
const TARGET = '2026-09-24T06:59:00.000Z'
/** What the four late additions carry: 1:31pm Pacific on the 24th. */
const LATE = '2026-09-24T20:31:00.000Z'

const row = (over: Partial<DeadlineRow>): DeadlineRow => ({
  bookingId: 'b1', vendorCode: 'MM02', shopName: 'Bare Simplicity',
  status: 'awaiting_payment', paymentDueAt: TARGET, ...over,
})

eq('an unpaid booking has a deadline that matters', deadlineMatters('awaiting_payment'), true)
for (const s of ['confirmed', 'payment_processing', 'forfeited', 'cancelled']) {
  eq(`${s} does not`, deadlineMatters(s), false)
}

{
  const changes = deadlineChanges([row({})], TARGET)
  eq('a booking already on the date is not a change', changes.length, 0)
}

{
  /* The four accepted on the afternoon of the 22nd. */
  const changes = deadlineChanges([row({ paymentDueAt: LATE, shopName: 'Truly Kustom' })], TARGET)
  eq('a later deadline is pulled back to the show date', changes.length, 1)
  eq('and it is recorded as taking time away', changes[0]!.gainsTime, false)
  eq('from', changes[0]!.from, LATE)
  eq('to', changes[0]!.to, TARGET)
}

{
  const earlier = '2026-09-23T06:59:00.000Z'
  const changes = deadlineChanges([row({ paymentDueAt: earlier })], TARGET)
  eq('an earlier deadline is pushed out', changes.length, 1)
  eq('and that gains them time', changes[0]!.gainsTime, true)
}

{
  const changes = deadlineChanges([row({ paymentDueAt: null })], TARGET)
  eq('a booking with no deadline gets one', changes.length, 1)
  eq('and nobody loses time by gaining a date', changes[0]!.gainsTime, true)
}

{
  /* Money that has already arrived. Rewriting the date would only make the
     audit trail harder to read. */
  const rows = ['confirmed', 'payment_processing', 'forfeited', 'cancelled']
    .map((status, i) => row({ bookingId: `b${i}`, status, paymentDueAt: LATE }))
  eq('paid and released bookings are never touched', deadlineChanges(rows, TARGET).length, 0)
}

{
  const rows: DeadlineRow[] = [
    row({ bookingId: 'a', paymentDueAt: TARGET }),
    row({ bookingId: 'b', paymentDueAt: LATE }),
    row({ bookingId: 'c', paymentDueAt: LATE }),
    row({ bookingId: 'd', paymentDueAt: '2026-09-23T06:59:00.000Z' }),
    row({ bookingId: 'e', status: 'confirmed', paymentDueAt: LATE }),
  ]
  const changes = deadlineChanges(rows, TARGET)
  eq('only what actually moves is listed', changes.length, 3)
  eq('and the ones that shorten a window are countable', losesTime(changes).length, 2)

  /* Pressing it twice is not eighty rewrites and eighty log entries. */
  const after = rows.map((r) =>
    changes.some((c) => c.bookingId === r.bookingId) ? { ...r, paymentDueAt: TARGET } : r)
  eq('a second pass has nothing to do', deadlineChanges(after, TARGET).length, 0)
}

if (failures > 0) { console.error(`\n${failures} failure(s).`); process.exit(1) }
console.log('align deadline: one date for everybody, and it says who loses time by it')
