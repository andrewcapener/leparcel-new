/**
 * Money moves here, so this is tested (CLAUDE.md rule 2).
 *
 * The property that matters: the total a maker is charged is always exactly
 * the sum of the lines they were shown. Randomised, because the failure this
 * guards against is a rounding or accumulation bug that only shows up on
 * particular combinations of add-ons.
 */
import { invoiceFor, paymentMatches, bookingPaymentKey, paymentDoor } from './invoice'

let failures = 0
const check = (name: string, ok: boolean) => {
  if (!ok) { failures++; console.error(`FAIL: ${name}`) }
}

/* 1 · The total is the sum of the lines. 50,000 randomised bookings. */
let mismatches = 0
let nonInteger = 0
for (let i = 0; i < 50_000; i++) {
  const spacePriceCents = Math.floor(Math.random() * 200_000)
  const n = Math.floor(Math.random() * 6)
  const addons = Array.from({ length: n }, (_, k) => ({
    name: `add-on ${k}`,
    priceCents: Math.floor(Math.random() * 20_000),
  }))
  const inv = invoiceFor({ spaceLabel: '10x10 indoor', spacePriceCents, addons })
  const summed = inv.lines.reduce((a, l) => a + l.amountCents, 0)
  if (summed !== inv.totalCents) mismatches++
  if (!Number.isInteger(inv.totalCents)) nonInteger++
  // Every add-on appears, and the space is always the first line.
  if (inv.lines.length !== addons.length + 1) mismatches++
  if (inv.lines[0]!.amountCents !== spacePriceCents) mismatches++
}
check('total always equals the sum of the lines shown', mismatches === 0)
check('total is always an integer number of cents', nonInteger === 0)

/* 2 · A booking with no add-ons costs exactly the space. */
const bare = invoiceFor({ spaceLabel: 'Outdoor 10x10', spacePriceCents: 45_000, addons: [] })
check('no add-ons means the space price, exactly', bare.totalCents === 45_000)
check('no add-ons means one line', bare.lines.length === 1)

/* 3 · Add-ons are added, not averaged or replaced. */
const withExtras = invoiceFor({
  spaceLabel: 'Indoor shelf', spacePriceCents: 30_000,
  addons: [{ name: 'Endcap', priceCents: 4_000 }, { name: 'Tent rental', priceCents: 10_000 }],
})
check('add-ons sum onto the space price', withExtras.totalCents === 44_000)

/* 4 · Only an exact match confirms a booking. A maker must never hold a space
 *     they underpaid for, and an overpayment is a person's problem, not a
 *     silent one. */
check('exact amount matches', paymentMatches(45_000, 45_000))
check('one cent short does not match', !paymentMatches(45_000, 44_999))
check('one cent over does not match', !paymentMatches(45_000, 45_001))
check('zero does not match a real fee', !paymentMatches(45_000, 0))
check('a float amount never matches', !paymentMatches(45_000, 45_000.5))
check('a float expectation never matches', !paymentMatches(450.5 as number, 450.5 as number))

/* 5 · The idempotency key is stable per booking, and distinct across
 *     bookings and versions (rule 4: a double-click must never double-pay). */
const a = bookingPaymentKey('bk_123')
check('the key is stable for the same booking', a === bookingPaymentKey('bk_123'))
check('a different booking gets a different key', a !== bookingPaymentKey('bk_124'))
check('bumping the version gets a different key', a !== bookingPaymentKey('bk_123', 'portal', 2))
check('the key names the booking', a.includes('bk_123'))

/* 5b · The door is part of the key, because it is part of the request. Stripe
 *      rejects a reused key whose parameters changed, and the two doors return
 *      a maker to two different pages. What must never double-pay is a double
 *      CLICK, and that is always the same door. */
check('the two doors do not share a key',
  bookingPaymentKey('bk_123', 'portal') !== bookingPaymentKey('bk_123', 'link'))
check('a double click on one door is one key',
  bookingPaymentKey('bk_123', 'link') === bookingPaymentKey('bk_123', 'link'))
check('the portal is the default, so nothing already issued changes shape',
  a === bookingPaymentKey('bk_123', 'portal'))
check('a pasted link is the link door', paymentDoor('/pay/abc123') === 'link')
check('the account is the portal', paymentDoor('/account') === 'portal')
/* Anything unrecognised is treated as the portal rather than inventing a
   third door, because a third door is a third live Checkout session. */
check('anything else is the portal', paymentDoor('/somewhere/else') === 'portal')

if (failures) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
console.log('booth invoice: the total is always the lines, and only an exact payment confirms')
export {}
