import { lineDiscountCents, makerSales, refundsByCode } from './from-sales'
import { statementTotals } from './math'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

/* ── what a line was discounted by ───────────────────────────────────── */

check('no discount', lineDiscountCents({ total_discount: '0.00' }) === 0)
check('a markdown on the line', lineDiscountCents({ total_discount: '1.00' }) === 100)
/* The order level discount Shopify has already prorated across the basket.
   Reading only total_discount keeps the house's commission on money the
   customer never handed over, which is the maker's cent and not ours. */
check('a share of an order discount', lineDiscountCents({
  total_discount: '0.00', discount_allocations: [{ amount: '1.15' }],
}) === 115)
check('both at once', lineDiscountCents({
  total_discount: '1.00', discount_allocations: [{ amount: '0.34' }],
}) === 134)
check('several allocations', lineDiscountCents({
  total_discount: '0.00', discount_allocations: [{ amount: '0.50' }, { amount: '0.25' }],
}) === 75)
check('missing fields are nothing', lineDiscountCents({}) === 0)

/* ── a refund belongs to whoever sold the thing ──────────────────────── */

const refunded = {
  refunds: [{
    refund_line_items: [
      { subtotal: '28.00', line_item: { vendor: 'MM8' } },
      { subtotal: '5.00', line_item: { vendor: 'mm9' } },
    ],
  }],
}
const rb = refundsByCode(refunded)
check('the seller is charged the refund', rb.get('MM8') === 2800)
check('codes are upper case', rb.get('MM9') === 500)
check('nobody else is touched', rb.size === 2)
check('no refunds is an empty map', refundsByCode({}).size === 0)

/* ── grouping a show into statements ─────────────────────────────────── */

const order = (id: number, at: string, lines: Array<[string, string, number, string]>,
  extra: Record<string, unknown> = {}) => ({
  id, created_at: at,
  line_items: lines.map(([vendor, price, quantity, sku]) => ({
    vendor, price, quantity, sku, total_discount: '0.00',
  })),
  ...extra,
})

const orders = [
  order(1, '2026-11-13T14:00:00-05:00', [['MM28', '120.00', 3, 'MM28-15']]),
  order(2, '2026-11-14T10:00:00-05:00', [
    ['MM28', '20.00', 1, 'MM28-2'],
    ['MM8', '28.00', 1, 'MM8-15'],
  ]),
  /* The same maker twice in one basket, which must count as one order. */
  order(3, '2026-11-15T11:00:00-05:00', [
    ['MM8', '25.00', 1, 'MM8-3'],
    ['MM8', '25.00', 1, 'MM8-3'],
  ], {
    refunds: [{ refund_line_items: [{ subtotal: '28.00', line_item: { vendor: 'MM8' } }] }],
  }),
  order(4, '2026-11-15T12:00:00-05:00', [['MM42', '5.00', 2, 'MM42-1']]),
]

const out = makerSales(orders, {
  bpsOf: new Map([['MM28', 2000], ['MM8', 2000]]),
  fallbackBps: 2000,
  labelOf: new Map([['MM8-15', 'Ceramic item'], ['MM28-15', 'Belt']]),
  houseCodes: new Set(['MM42']),
})

const mm28 = out.find((m) => m.code === 'MM28')!
const mm8 = out.find((m) => m.code === 'MM8')!
const mm42 = out.find((m) => m.code === 'MM42')!

check('ranked by gross', out[0].code === 'MM28')
check('quantity multiplies', mm28.input.grossCents === 36000 + 2000)
check('orders counted per maker', mm28.orders === 2)
/* One basket with two of her lines is one order, not two. */
check('one basket is one order', mm8.orders === 2)
check('items counted', mm8.input.itemsSold === 3)
check('gross summed', mm8.input.grossCents === 2800 + 5000)
check('her refund is hers', mm8.input.refundsCents === 2800)
check('and nobody else is charged it', mm28.input.refundsCents === 0)

/* The same product bought twice collapses to one row with a quantity. */
const three = mm8.lines.find((l) => l.sku === 'MM8-3')!
check('repeat sales of one product collapse', three.qty === 2 && three.grossCents === 5000)
check('labels are carried through', mm8.lines.find((l) => l.sku === 'MM8-15')!.label === 'Ceramic item')
check('an unknown sku still appears', three.label === '')
check('lines are ranked by money', mm8.lines[0].grossCents >= mm8.lines[1].grossCents)

check('first and last are the real bounds', mm8.firstAt < mm8.lastAt)

/* House stock has nobody to pay, so it takes no commission and the whole
   amount stays with the house. */
check('house goods carry no commission', mm42.input.commissionBps === 0)
const houseTotals = statementTotals(mm42.input)
check('and the split reflects that', houseTotals.commissionCents === 0)
check('so the payout is the lot', houseTotals.payoutCents === 1000)

/* ── the whole chain, end to end ─────────────────────────────────────── */

const t = statementTotals(mm8.input)
check('net sales is gross less refunds', t.netSalesCents === 7800 - 2800)
check('commission is on what was kept', t.commissionCents === 1000)
check('the maker gets the rest', t.netCents === 4000)
/* Rule 2, restated on real data: nothing is lost or invented between the
   gross and the payout. */
check('it all adds back up', t.commissionCents + t.netCents === t.netSalesCents)
check('nobody owes us here', t.owesUs === false)

/* A maker with no booking is priced at the show rate rather than dropped,
   because a sale attributed to nobody disappears. */
const orphan = makerSales([order(9, '2026-11-13T14:00:00-05:00', [['MM99', '10.00', 1, 'x']])],
  { bpsOf: new Map(), fallbackBps: 2000, labelOf: new Map() })
check('an unknown maker still gets a statement', orphan.length === 1)
check('at the show rate', orphan[0].input.commissionBps === 2000)

if (failures) {
  console.error(`${failures} failed`)
  process.exit(1)
}
console.log('statements from sales: every cent lands on the maker who earned it')
