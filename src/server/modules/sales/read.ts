import { splitCommission } from '@/lib/money'

/**
 * What the register has taken, read back from Shopify.
 *
 * Drew, mid Saturday: "can you put together a live tracking dashboard."
 * Until now the answer to "how are we doing" was somebody asking me and me
 * reading the orders out, which is fine once and useless at a counter.
 *
 * Shopify is the source of truth here, and deliberately so. The sale happens
 * at the till and nowhere else, so the only honest account of what has been
 * taken is the one the till kept. Nothing in this file writes anything.
 */

/**
 * Cents from Shopify's decimal strings, without going through a float.
 *
 * "82.00" is 8200 and "4.10" is 410. Number("4.10") * 100 is
 * 409.99999999999994, which floors to 409 and shorts a maker a cent on every
 * line, every day, in a direction nobody notices until the statement.
 * (CLAUDE.md rule 1.)
 */
export function centsFromDecimal(raw: string | number | null | undefined): number {
  const s = String(raw ?? '').trim()
  if (!s) return 0
  const m = /^(-?)(\d*)(?:\.(\d{0,}))?$/.exec(s)
  if (!m) return 0
  const sign = m[1] === '-' ? -1 : 1
  const whole = m[2] === '' ? 0 : Number(m[2])
  /* Shopify sends two decimal places. A third would be a rounding decision
     and this is not the place to make one, so it is truncated rather than
     guessed at. */
  const frac = (m[3] ?? '').padEnd(2, '0').slice(0, 2)
  return sign * (whole * 100 + Number(frac))
}

/** One line of one order, reduced to the two things that matter. */
export type SaleLine = {
  /** The Mermade ID off the product's vendor field. */
  code: string
  cents: number
  qty: number
  sku: string
}

export type Sale = {
  id: number
  name: string
  /** ISO, as Shopify gave it, with its offset. */
  at: string
  goodsCents: number
  taxCents: number
  totalCents: number
  lines: SaleLine[]
}

/* The market's own goods carry no commission, because there is nobody to pay.
   See shopify/push.ts: MM42 exists in Shopify and on no booking. */
export const HOUSE_CODES = new Set(['MM42'])

export function readSale(o: Record<string, unknown>): Sale {
  const items = (o.line_items ?? []) as Array<Record<string, unknown>>
  return {
    id: Number(o.id),
    name: String(o.name ?? ''),
    at: String(o.created_at ?? ''),
    goodsCents: centsFromDecimal(o.subtotal_price as string),
    taxCents: centsFromDecimal(o.total_tax as string),
    totalCents: centsFromDecimal(o.total_price as string),
    lines: items.map((li) => ({
      code: String(li.vendor ?? '').toUpperCase(),
      cents: centsFromDecimal(li.price as string) * Number(li.quantity ?? 1),
      qty: Number(li.quantity ?? 1),
      sku: String(li.sku ?? ''),
    })),
  }
}

/**
 * The Pacific day and hour a sale happened in.
 *
 * Stored UTC, rendered Pacific (CLAUDE.md rule 8). This is the whole reason
 * the dashboard cannot just read the timestamp's own date: Shopify sends
 * Eastern, so a four o'clock sale in Dana Point is already tomorrow by one
 * reading and today by another.
 */
export const TZ = 'America/Los_Angeles'

export function pacific(iso: string): { day: string; hour: number } {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  /* hourCycle h23 gives "24" for midnight in some runtimes. */
  const hour = Number(get('hour')) % 24
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hour }
}

/* byMaker and MakerTotal used to live here, and they were a second opinion
   about money. They split commission off GROSS, so the sales screen and the
   statements screen disagreed by $19.41 of commission and $77.61 of payable
   on one show: discounts and refunds come off BEFORE the house takes its
   share, and only the statements path knew it.
   
   There is one definition of what a maker earned and it is
   statements/from-sales.ts plus statementTotals. Nothing else computes it,
   which is rule 2 and is why that rule exists. */

export type HourSlice = { hour: number; orders: number; goodsCents: number }

export function byHour(sales: Sale[]): HourSlice[] {
  const n = new Map<number, { orders: number; goodsCents: number }>()
  for (const s of sales) {
    const { hour } = pacific(s.at)
    const b = n.get(hour) ?? { orders: 0, goodsCents: 0 }
    b.orders += 1
    b.goodsCents += s.goodsCents
    n.set(hour, b)
  }
  return [...n.entries()]
    .map(([hour, v]) => ({ hour, ...v }))
    .sort((a, b) => a.hour - b.hour)
}

export type DaySlice = { day: string; orders: number; goodsCents: number; totalCents: number }

export function byDay(sales: Sale[]): DaySlice[] {
  const n = new Map<string, DaySlice>()
  for (const s of sales) {
    const { day } = pacific(s.at)
    const b = n.get(day) ?? { day, orders: 0, goodsCents: 0, totalCents: 0 }
    b.orders += 1
    b.goodsCents += s.goodsCents
    b.totalCents += s.totalCents
    n.set(day, b)
  }
  return [...n.values()].sort((a, b) => (a.day < b.day ? -1 : 1))
}

export type Totals = {
  orders: number
  /** What the customer was charged for goods, after any discount. */
  goodsCents: number
  taxCents: number
  totalCents: number
  basketCents: number
}

/**
 * What the till took: orders, goods, tax and the total charged.
 *
 * Deliberately no commission and no maker share. Those are statement
 * figures, they depend on refunds this function cannot see, and computing
 * them here is how the two screens came to disagree.
 */
export function totals(sales: Sale[]): Totals {
  const goods = sales.reduce((n, s) => n + s.goodsCents, 0)
  return {
    orders: sales.length,
    goodsCents: goods,
    taxCents: sales.reduce((n, s) => n + s.taxCents, 0),
    totalCents: sales.reduce((n, s) => n + s.totalCents, 0),
    basketCents: sales.length === 0 ? 0 : Math.round(goods / sales.length),
  }
}

/** "9am", "12pm", "5pm": how the hours read on the floor. */
export function hourLabel(h: number): string {
  if (h === 0) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}
