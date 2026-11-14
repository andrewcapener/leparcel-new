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

export type MakerTotal = {
  code: string
  grossCents: number
  commissionCents: number
  netCents: number
  units: number
  orders: number
}

/**
 * What each maker has sold, and what she is owed for it.
 *
 * The rate is hers, off her own booking, because commission_bps is
 * snapshotted when the booking is made and never changes (rule 6). Reading a
 * single rate off the Show record would be right today and wrong the first
 * time somebody is given different terms.
 */
export function byMaker(sales: Sale[], bpsOf: Map<string, number>, fallbackBps: number): MakerTotal[] {
  const gross = new Map<string, number>()
  const units = new Map<string, number>()
  const orders = new Map<string, Set<number>>()
  for (const s of sales) {
    for (const l of s.lines) {
      if (!l.code) continue
      gross.set(l.code, (gross.get(l.code) ?? 0) + l.cents)
      units.set(l.code, (units.get(l.code) ?? 0) + l.qty)
      orders.set(l.code, (orders.get(l.code) ?? new Set()).add(s.id))
    }
  }
  const out: MakerTotal[] = []
  gross.forEach((g, code) => {
    const bps = HOUSE_CODES.has(code) ? 0 : bpsOf.get(code) ?? fallbackBps
    const split = splitCommission(g, bps)
    out.push({
      code,
      grossCents: g,
      commissionCents: split.commissionCents,
      netCents: split.netCents,
      units: units.get(code) ?? 0,
      orders: orders.get(code)?.size ?? 0,
    })
  })
  return out.sort((a, b) => b.grossCents - a.grossCents || (a.code < b.code ? -1 : 1))
}

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
  goodsCents: number
  taxCents: number
  totalCents: number
  commissionCents: number
  netCents: number
  basketCents: number
}

/**
 * The headline figures.
 *
 * Commission is summed off each maker's own split rather than taken as a
 * percentage of the whole, so the number on the screen is the sum of the
 * numbers on the statements and cannot drift from them by a rounding cent.
 */
export function totals(sales: Sale[], makers: MakerTotal[]): Totals {
  const goods = sales.reduce((n, s) => n + s.goodsCents, 0)
  const tax = sales.reduce((n, s) => n + s.taxCents, 0)
  const total = sales.reduce((n, s) => n + s.totalCents, 0)
  const commission = makers.reduce((n, m) => n + m.commissionCents, 0)
  const net = makers.reduce((n, m) => n + m.netCents, 0)
  return {
    orders: sales.length,
    goodsCents: goods,
    taxCents: tax,
    totalCents: total,
    commissionCents: commission,
    netCents: net,
    basketCents: sales.length === 0 ? 0 : Math.round(goods / sales.length),
  }
}

/** "9am", "12pm", "5pm": how the hours read on the floor. */
export function hourLabel(h: number): string {
  if (h === 0) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}
