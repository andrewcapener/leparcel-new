/**
 * Money moves here, so this is tested (CLAUDE.md rule 2).
 *
 * The property that matters: the total a maker is charged is always exactly
 * the sum of the lines they were shown. Randomised, because the failure this
 * guards against is a rounding or accumulation bug that only shows up on
 * particular combinations of add-ons.
 */
import { invoiceFor, checkoutLines, paymentMatches, bookingPaymentKey, paymentDoor } from './invoice'

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

/* ── a booking that changed after it was paid ── */

{
  /* Awe Collective: $900 for Saturday and Sunday, paid in full, then adds
     Friday at $450. The bug this guards against is the checkout asking for
     $1,350 from somebody who already paid $900. */
  const inv = invoiceFor({
    spaceLabel: 'Outdoor Saturday', spacePriceCents: 90000, addons: [],
    charges: [{ label: 'Friday booth', amountCents: 45000 }],
    paidCents: 90000,
  })
  check('the invoice still totals everything', inv.totalCents === 135000)
  check('it remembers what arrived', inv.paidCents === 90000)
  check('and only asks for the difference', inv.amountDueCents === 45000)

  /* The page shows all three lines. Stripe gets one, because a negative line
     item does not exist and charging the full list would be theft. */
  const lines = checkoutLines(inv, 'Fall 2026')
  check('the maker still sees every line', inv.lines.length === 2)
  check('but the card form asks once', lines.length === 1)
  check('for exactly the balance', lines[0]!.amountCents === 45000)
  check('and says what it is', /balance/i.test(lines[0]!.label))
  check('never a negative line item', lines.every((l) => l.amountCents >= 0))
}

{
  /* Nothing paid yet: the itemised list, which is most of what makes an
     invoice feel like an invoice. */
  const inv = invoiceFor({
    spaceLabel: '3x6', spacePriceCents: 28000,
    addons: [{ name: 'Corner', priceCents: 4000 }], charges: [], paidCents: 0,
  })
  check('a fresh invoice asks for the whole thing', inv.amountDueCents === 32000)
  check('and shows it itemised', checkoutLines(inv, 'Fall 2026').length === 2)
}

{
  /* Downsized after paying. Owed money, never asked for a negative amount. */
  const inv = invoiceFor({
    spaceLabel: 'Outdoor Saturday', spacePriceCents: 50000, addons: [],
    charges: [{ label: 'Dropped Sunday', amountCents: -20000 }],
    paidCents: 50000,
  })
  check('the total comes down', inv.totalCents === 30000)
  check('and nothing more is due', inv.amountDueCents === 0)
  check('never a negative amount due', inv.amountDueCents >= 0)
}

{
  /* The exact-match rule still bites, now against the balance. A maker who
     pays the old full amount when only a balance is owed is a mismatch and
     lands on a person's desk rather than being waved through. */
  const inv = invoiceFor({
    spaceLabel: '3x6', spacePriceCents: 28000, addons: [],
    charges: [{ label: 'Corner', amountCents: 4000 }], paidCents: 28000,
  })
  check('the balance is what must match', paymentMatches(inv.amountDueCents, 4000))
  check('and the old total does not', !paymentMatches(inv.amountDueCents, 32000))
}

if (failures) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
console.log('booth invoice: the total is always the lines, and only an exact payment confirms')
export {}
