import {
  byDay, byHour, centsFromDecimal, hourLabel, pacific, readSale, totals, type Sale,
} from './read'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

/* ── money comes out of a string, never through a float ───────────────── */

check('whole dollars', centsFromDecimal('82.00') === 8200)
check('odd cents', centsFromDecimal('6.36') === 636)
/* The one that fails under Number(x) * 100: 4.10 * 100 is
   409.99999999999994, which floors to 409 and shorts a maker a cent on
   every line of every day. */
check('the float trap', centsFromDecimal('4.10') === 410)
check('another float trap', centsFromDecimal('1.15') === 115)
check('no decimal point', centsFromDecimal('25') === 2500)
check('one decimal place', centsFromDecimal('25.5') === 2550)
check('thousands', centsFromDecimal('1234.56') === 123456)
check('a refund is negative', centsFromDecimal('-12.50') === -1250)
check('nothing is nothing', centsFromDecimal('') === 0)
check('null is nothing', centsFromDecimal(null) === 0)
check('rubbish is nothing', centsFromDecimal('abc') === 0)

/* ── a sale, as Shopify sends it ──────────────────────────────────────── */

const raw = {
  id: 1, name: '#6142', created_at: '2026-11-13T14:29:07-05:00',
  subtotal_price: '82.00', total_tax: '6.36', total_price: '88.36',
  line_items: [
    { vendor: 'mm9', price: '82.00', quantity: 1, sku: 'MM9-4' },
  ],
}
const s = readSale(raw)
check('goods', s.goodsCents === 8200)
check('tax', s.taxCents === 636)
check('total', s.totalCents === 8836)
check('the code is upper case', s.lines[0].code === 'MM9')
/* Two of a thing is twice the money, and the line price is the price of one. */
const two = readSale({ ...raw, line_items: [{ vendor: 'MM9', price: '82.00', quantity: 3, sku: 'x' }] })
check('quantity multiplies', two.lines[0].cents === 24600)

/* ── Pacific, not whatever the timestamp says ─────────────────────────── */

/* Shopify sends Eastern. 14:29 Eastern is 11:29 in Dana Point, same day. */
check('eastern afternoon is pacific morning', pacific('2026-11-13T14:29:07-05:00').hour === 11)
check('and the same day', pacific('2026-11-13T14:29:07-05:00').day === '2026-11-13')
/* The one that matters at the end of a show day: 1am UTC on the 14th is
   still Friday evening on the floor, and must not land on Saturday. */
check('late evening stays on its own day', pacific('2026-11-14T01:30:00Z').day === '2026-11-13')
check('and reads as evening', pacific('2026-11-14T01:30:00Z').hour === 17)
check('midnight reads as zero', pacific('2026-11-13T08:00:00Z').hour === 0)

check('9am', hourLabel(9) === '9am')
check('noon is not 0pm', hourLabel(12) === '12pm')
check('midnight is not 0am', hourLabel(0) === '12am')
check('afternoon', hourLabel(17) === '5pm')

/* What each maker is owed is NOT tested here any more, because it is not
   computed here any more. It lives in statements/from-sales.ts with its own
   tests: two opinions about commission is how this screen came to disagree
   with the statements by $77.61 of payable. */

/* ── the headline ─────────────────────────────────────────────────────── */

const mk = (id: number, at: string, lines: Array<[string, string, number]>): Sale => ({
  id,
  name: `#${id}`,
  at,
  goodsCents: lines.reduce((n, [, p, q]) => n + centsFromDecimal(p) * q, 0),
  taxCents: 0,
  totalCents: lines.reduce((n, [, p, q]) => n + centsFromDecimal(p) * q, 0),
  lines: lines.map(([code, p, q]) => ({
    code, cents: centsFromDecimal(p) * q, qty: q, sku: '',
  })),
})

const sales: Sale[] = [
  mk(1, '2026-11-13T14:00:00-05:00', [['MM28', '120.00', 3]]),
  mk(2, '2026-11-13T15:00:00-05:00', [['MM28', '20.00', 1], ['MM9', '82.00', 1]]),
  mk(3, '2026-11-14T13:00:00-05:00', [['MM42', '5.00', 2]]),
]

const t = totals(sales)
check('orders counted', t.orders === 3)
check('goods summed', t.goodsCents === 38000 + 8200 + 1000)
check('tax is summed', t.taxCents === 0)
check('basket is an integer', Number.isInteger(t.basketCents))
check('an empty day does not divide by zero', totals([]).basketCents === 0)

/* ── days and hours ───────────────────────────────────────────────────── */

const days = byDay(sales)
check('two days', days.length === 2)
check('days are in order', days[0].day === '2026-11-13' && days[1].day === '2026-11-14')
check('a day sums its orders', days[0].orders === 2)

const hours = byHour(sales.filter((x) => pacific(x.at).day === '2026-11-13'))
check('hours are in order', hours[0].hour < hours[1].hour)
check('11am and noon', hours.map((h) => h.hour).join() === '11,12')

if (failures) {
  console.error(`${failures} failed`)
  process.exit(1)
}
console.log('sales: money leaves the decimal string intact, and the day it lands on is Pacific')
