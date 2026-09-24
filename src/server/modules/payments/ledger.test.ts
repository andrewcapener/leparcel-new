import {
  ledgerFor, standing, standingWords, amountToCollect, chargeProblem,
  type ChargeLine,
} from './ledger'

/**
 * The arithmetic that decides what a maker is asked to pay.
 *
 * Property-tested as well as worked through by hand, because this is the file
 * that turns "she wants to add Sunday" into a number on somebody's card, and
 * the failure mode is charging a real person the wrong amount.
 */

let failures = 0
function ok(what: string, cond: boolean, detail = '') {
  if (!cond) { console.error(`FAIL ${what}${detail ? `\n     ${detail}` : ''}`); failures++ }
}
const eq = (what: string, got: unknown, want: unknown) =>
  ok(what, Object.is(got, want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)

const line = (amountCents: number, over: Partial<ChargeLine> = {}): ChargeLine => ({
  id: Math.random().toString(36).slice(2), description: 'a line', amountCents, ...over,
})

/* ── the worked cases, in the words they arrived in ── */

{
  /* Awe Collective: $900 for Saturday and Sunday, paid. Now wants Friday. */
  const l = ledgerFor({
    priceCents: 90000, addonsCents: 0, amountPaidCents: 90000,
    charges: [line(45000, { description: 'Friday booth' })],
  })
  eq('the total grows by the day', l.totalCents, 135000)
  eq('what arrived is untouched', l.paidCents, 90000)
  eq('and the difference is what is owed', l.balanceCents, 45000)
  eq('which is what the pay page asks for', amountToCollect(l), 45000)
  eq('they are part paid, not unpaid', standing(l), 'owes_more')
  eq('and the screen says so', standingWords(l), 'Part paid')
}

{
  /* Emily Davis Ceramics, the other direction: a 3x8 corrected to a 3x6
     before she paid. */
  const l = ledgerFor({
    priceCents: 34000, addonsCents: 0, amountPaidCents: null,
    charges: [line(-6000, { description: '3x6 rather than 3x8' })],
  })
  eq('a negative line comes off the total', l.totalCents, 28000)
  eq('and she owes the smaller number', l.balanceCents, 28000)
  eq('nothing has arrived, so she simply owes', standing(l), 'owes')
}

{
  /* Paid, then downsized. A person decides what happens to the difference,
     and this file refuses to decide for them. */
  const l = ledgerFor({
    priceCents: 50000, addonsCents: 0, amountPaidCents: 50000,
    charges: [line(-10000, { description: 'dropped Sunday' })],
  })
  eq('the balance goes negative', l.balanceCents, -10000)
  eq('which is overpaid', standing(l), 'overpaid')
  eq('and the pay page asks for nothing', amountToCollect(l), 0)
}

{
  const l = ledgerFor({ priceCents: 28000, addonsCents: 0, amountPaidCents: 28000, charges: [] })
  eq('paid exactly is settled', standing(l), 'settled')
  eq('and reads as paid', standingWords(l), 'Paid in full')
}

{
  /* Brighton Made and the three credit makers: nothing to pay, and never to
     be shown as though they are late. */
  const l = ledgerFor({ priceCents: 0, addonsCents: 0, amountPaidCents: null, charges: [] })
  eq('a free space is settled', standing(l), 'settled')
  eq('and says so in its own words', standingWords(l), 'Nothing to pay')
  eq('with nothing to collect', amountToCollect(l), 0)
}

/* ── voiding, which is how a line is removed ── */

{
  const kept = line(45000, { id: 'a', description: 'Sunday' })
  const gone = line(4000, { id: 'b', description: 'endcap', voidedAt: '2026-09-24T18:00:00Z' })
  const l = ledgerFor({ priceCents: 50000, addonsCents: 0, amountPaidCents: 0, charges: [kept, gone] })
  eq('a voided line does not count', l.totalCents, 95000)
  eq('but it is still there to read back', l.voided.length, 1)
  eq('and the active ones are separate', l.active.length, 1)
  eq('the voided line keeps its words', l.voided[0]!.description, 'endcap')
}

/* ── the invariant, on randomised inputs (rule 2) ── */

{
  let worst = ''
  let bad = 0
  for (let i = 0; i < 200_000; i++) {
    const price = Math.floor(Math.random() * 200_000) - 50_000
    const addons = Math.floor(Math.random() * 20_000)
    const n = Math.floor(Math.random() * 6)
    const charges: ChargeLine[] = []
    for (let k = 0; k < n; k++) {
      const amt = Math.floor(Math.random() * 120_000) - 60_000
      charges.push(line(amt, { voidedAt: Math.random() < 0.25 ? '2026-01-01' : null }))
    }
    const paid = Math.random() < 0.4 ? null : Math.floor(Math.random() * 200_000)
    const l = ledgerFor({ priceCents: price, addonsCents: addons, charges, amountPaidCents: paid })

    const byHand = l.active.reduce((s, c) => s + c.amountCents, price + addons)
    if (l.totalCents !== byHand
      || l.balanceCents !== l.totalCents - l.paidCents
      || !Number.isInteger(l.totalCents)
      || !Number.isInteger(l.balanceCents)
      || amountToCollect(l) < 0) {
      bad++
      if (!worst) worst = JSON.stringify({ price, addons, charges, paid, l })
    }
  }
  ok('200,000 random ledgers: the lines always add up to the total, exactly',
    bad === 0, worst.slice(0, 300))
}

/* ── what a person is allowed to type ── */

eq('a line needs words', chargeProblem('', 5000) !== null, true)
eq('a line for nothing is refused', chargeProblem('Sunday', 0) !== null, true)
eq('a sane line is fine', chargeProblem('Sunday booth', 45000), null)
eq('so is a negative one', chargeProblem('Dropped Sunday', -45000), null)
eq('a fat finger is caught', chargeProblem('Sunday', 5_000_000) !== null, true)
eq('and a fractional cent is not a number of cents', chargeProblem('Sunday', 12.5) !== null, true)

if (failures > 0) { console.error(`\n${failures} failure(s).`); process.exit(1) }
console.log('ledger: the lines always add up, and a part paid maker is never read as unpaid')
