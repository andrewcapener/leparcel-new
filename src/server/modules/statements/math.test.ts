import {
  statementTotals, payoutBlockers, payoutIdempotencyKey, type Adjustment,
} from './math'

let failures = 0
const check = (n: string, ok: boolean, d = '') => {
  if (!ok) { failures++; console.error(`FAIL: ${n} ${d}`) }
}

const totals = (over: Partial<Parameters<typeof statementTotals>[0]> = {}) =>
  statementTotals({
    grossCents: 0, discountsCents: 0, refundsCents: 0,
    commissionBps: 2000, adjustments: [], itemsSold: 0, ...over,
  })

/* ── the invariant the whole thing exists for ────────────────────────────
   CLAUDE.md rule 2: commission + net + deductions === gross, exactly, for
   randomized inputs. Stated here as the two identities it decomposes into,
   because a single equation hides which half broke. */

for (let i = 0; i < 200_000; i++) {
  const gross = Math.floor(Math.random() * 5_000_00)
  const discounts = Math.floor(Math.random() * Math.max(1, gross / 4))
  const refunds = Math.floor(Math.random() * Math.max(1, gross / 4))
  const bps = Math.floor(Math.random() * 10_001)
  const adj: Adjustment[] = []
  const n = Math.floor(Math.random() * 4)
  for (let k = 0; k < n; k++) {
    adj.push({
      code: 'x', description: 'x',
      amountCents: Math.floor(Math.random() * 20_00) - 10_00,
    })
  }
  const t = totals({ grossCents: gross, discountsCents: discounts, refundsCents: refunds, commissionBps: bps, adjustments: adj })

  check('net sales is gross less what never stuck',
    t.netSalesCents === gross - discounts - refunds)
  /* The house's share and the maker's share account for every cent of the
     net sales. No cent is created and none goes missing. */
  check('commission and net conserve net sales',
    t.commissionCents + t.netCents === t.netSalesCents,
    `${t.commissionCents}+${t.netCents}!=${t.netSalesCents}`)
  check('the payout is the maker share plus what was added by hand',
    t.payoutCents === t.netCents + t.creditsCents + t.deductionsCents)
  check('every figure is an integer',
    [t.netSalesCents, t.commissionCents, t.netCents, t.deductionsCents,
      t.creditsCents, t.payoutCents].every(Number.isInteger))
  check('deductions are never positive', t.deductionsCents <= 0)
  check('credits are never negative', t.creditsCents >= 0)
}

/* ── the real rate on real amounts ───────────────────────────────────── */

{
  const t = totals({ grossCents: 1_240_00, commissionBps: 2000, itemsSold: 61 })
  check('20% of $1,240 is $248', t.commissionCents === 248_00, String(t.commissionCents))
  check('the maker gets $992', t.payoutCents === 992_00, String(t.payoutCents))
}

/* Commission is taken AFTER discounts and refunds, because Mermade does not
   earn a share of money it never kept. */
{
  const t = totals({ grossCents: 100_00, discountsCents: 10_00, refundsCents: 20_00 })
  check('net sales drop first', t.netSalesCents === 70_00)
  check('commission is on what stuck', t.commissionCents === 14_00, String(t.commissionCents))
  check('and so is the payout', t.payoutCents === 56_00, String(t.payoutCents))
}

/* The half cent goes to the house, same rule as splitCommission. */
{
  const t = totals({ grossCents: 5, commissionBps: 5000 })
  check('rounding favours the house', t.commissionCents === 3 && t.netCents === 2)
}

/* ── adjustments ─────────────────────────────────────────────────────── */

{
  const t = totals({
    grossCents: 500_00,
    adjustments: [
      { code: 'label', description: 'relabelling', amountCents: -25_00 },
      { code: 'goodwill', description: 'goodwill', amountCents: 10_00 },
    ],
  })
  check('deductions are summed as negative', t.deductionsCents === -25_00)
  check('credits are summed as positive', t.creditsCents === 10_00)
  check('the payout carries both', t.payoutCents === 400_00 - 25_00 + 10_00, String(t.payoutCents))
}

/* A maker can finish a show owing money. Flagged, never clamped: clamping to
   zero would quietly forgive a debt that nobody would ever see again. */
{
  const t = totals({
    grossCents: 20_00,
    adjustments: [{ code: 'replacement', description: 'broken stock', amountCents: -100_00 }],
  })
  check('a negative payout is reported, not hidden', t.payoutCents === 16_00 - 100_00)
  check('and flagged for a person', t.owesUs === true)
}
check('an ordinary statement does not read as a debt', totals({ grossCents: 100_00 }).owesUs === false)

/* ── floats never get near it ────────────────────────────────────────── */
for (const bad of [
  () => totals({ grossCents: 10.5 }),
  () => totals({ discountsCents: 0.1 }),
  () => totals({ adjustments: [{ code: 'x', description: 'x', amountCents: 1.5 }] }),
]) {
  let threw = false
  try { bad() } catch { threw = true }
  check('a float is refused outright', threw)
}

/* ── what stops a payout ─────────────────────────────────────────────── */

const ok = { totals: totals({ grossCents: 100_00 }), payoutsReady: true, complianceClear: true, status: 'ready' }
check('a clean statement has nothing blocking it', payoutBlockers(ok).length === 0)
check('Stripe not ready blocks it',
  payoutBlockers({ ...ok, payoutsReady: false }).some((r) => r.includes('Stripe')))
check('paperwork blocks it',
  payoutBlockers({ ...ok, complianceClear: false }).some((r) => r.includes('paperwork')))
check('a voided statement blocks it',
  payoutBlockers({ ...ok, status: 'void' }).some((r) => r.includes('voided')))
check('an already paid statement blocks it',
  payoutBlockers({ ...ok, status: 'paid' }).some((r) => r.includes('Already')))
check('nothing to send blocks it',
  payoutBlockers({ ...ok, totals: totals({ grossCents: 0 }) }).some((r) => r.includes('Nothing')))
check('every blocker gives a reason', payoutBlockers({ ...ok, payoutsReady: false, complianceClear: false })
  .every((r) => r.length > 10))

/* ── one key, one payment ────────────────────────────────────────────── */
check('the key is the documented shape',
  payoutIdempotencyKey('abc', 1) === 'payout:abc:v1')
check('a new version is a new key',
  payoutIdempotencyKey('abc', 1) !== payoutIdempotencyKey('abc', 2))
check('a different statement is a different key',
  payoutIdempotencyKey('abc', 1) !== payoutIdempotencyKey('abd', 1))

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('statements: every cent is accounted for, and a debt is never silently forgiven')
