import { randomUUID, timingSafeEqual } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import {
  auditLog, bookings, inventoryBreaks, inventoryItems, shows, spaceTypes, vendors,
} from '@/db/schema'
import { bookends, splitDay } from '@/lib/schedule'
import { holdsSpace } from '@/server/modules/payments/booking-status'
import { applyPriceEdits, priceProblem } from '@/server/modules/inventory/edit'
import { priceFromDollars, readPastedList } from '@/server/modules/inventory/lines'
import { findLine, type ApiLine } from '@/server/modules/inventory/register-api'
import { byCode } from '@/server/modules/roster/inventory-print'
import { multiBuyWords } from '@/server/modules/roster/inventory-export'
import { pushAllPrices, pushCollections } from '@/server/modules/shopify/push'

/**
 * Change a price at the show without opening the admin.
 *
 * Drew, the night before doors: "I just don't want to log into the admin
 * dashboard, I'd rather prompt you here." The register desk screen answers
 * the no-laptop half of that and not the rest: it still needs a person to
 * sign in and tap, and the person asking is going to be holding a till.
 *
 * So this is the same three operations behind one key. It is NOT a general
 * admin API and must never become one. It reads and writes inventory for the
 * active show's indoor makers and nothing else: no roster, no payments, no
 * applications, no PII. If something here ever needs a vendor's address or a
 * payout, it belongs behind the staff sign-in instead.
 *
 * POST /api/register        x-register-key: <key>
 *   { "do": "makers" }
 *   { "do": "hours" }
 *   { "do": "collections" }
 *   { "do": "sethours", "text": "Friday 13 November, noon to 6pm \u00b7 ..." }
 *   { "do": "lines",  "code": "MM28" }
 *   { "do": "price",  "code": "MM28", "match": "tote", "fromPrice": "5", "toPrice": "6" }
 *   { "do": "add",    "code": "MM28", "list": "Earrings $18\nRings $12, 2 for $20" }
 *
 * Every write goes to the database first and the register second, for the
 * reason in inventory/edit.ts: a payout is computed from what Mermade says a
 * maker's goods cost, so an edit made only at the till is a sale that cannot
 * be reconciled against any price list afterwards.
 */

export const dynamic = 'force-dynamic'
/* A write pushes every price to Shopify, which is several hundred calls. */
export const maxDuration = 300

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } })

/**
 * The key, compared without leaking its length or how far a guess got.
 *
 * Not the admin password and not the Shopify key: its own secret, so it can
 * be rotated the morning after the show without signing anybody out or
 * breaking the push.
 */
function authorised(req: NextRequest): boolean {
  const want = process.env.REGISTER_KEY?.trim()
  if (!want || want.length < 24) return false
  const got = (req.headers.get('x-register-key') ?? '').trim()
  if (got.length !== want.length) return false
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(want))
  } catch {
    return false
  }
}

const money = (cents: number) => {
  const whole = Math.trunc(cents / 100)
  const rest = Math.abs(cents) % 100
  return rest === 0 ? `$${whole}` : `$${whole}.${String(rest).padStart(2, '0')}`
}

/** Indoor makers still holding a space, which is everyone this can touch. */
async function makersOf(showId: string) {
  const rows = await db
    .select({
      bookingId: bookings.id,
      status: bookings.status,
      code: bookings.vendorCode,
      shop: vendors.shopName,
      track: spaceTypes.track,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .innerJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
    .where(eq(bookings.showId, showId))

  return rows
    .filter((r) => r.track !== 'outdoor' && holdsSpace(r.status))
    .sort((a, b) => byCode(a.code, b.code))
}

async function linesOf(bookingId: string): Promise<Array<ApiLine & { multiBuys: string }>> {
  const items = await db
    .select()
    .from(inventoryItems)
    .where(and(eq(inventoryItems.bookingId, bookingId), isNull(inventoryItems.voidedAt)))
    .orderBy(asc(inventoryItems.sortOrder), asc(inventoryItems.createdAt))
  if (items.length === 0) return []

  const breaks = await db
    .select()
    .from(inventoryBreaks)
    .where(inArray(inventoryBreaks.itemId, items.map((i) => i.id)))
    .orderBy(asc(inventoryBreaks.qty))

  const breaksOf = new Map<string, { qty: number; cents: number }[]>()
  for (const b of breaks) {
    breaksOf.set(b.itemId, [...(breaksOf.get(b.itemId) ?? []), { qty: b.qty, cents: b.priceCents }])
  }
  return items.map((i) => ({
    id: i.id,
    label: i.label,
    priceCents: i.priceCents,
    multiBuys: multiBuyWords(breaksOf.get(i.id) ?? []),
  }))
}

const shown = (l: ApiLine & { multiBuys: string }) => ({
  id: l.id,
  item: l.label,
  price: money(l.priceCents),
  multiBuys: l.multiBuys || undefined,
})

export async function POST(req: NextRequest) {
  if (!authorised(req)) return json({ error: 'Unauthorized' }, 401)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const show = await activeShow()
  if (!show) return json({ error: 'No active show' }, 500)

  const act = String(body.do ?? '').trim().toLowerCase()
  const code = String(body.code ?? '').trim().toUpperCase()
  const makers = await makersOf(show.id)

  /**
   * When the doors open, which is the one thing on the public site that
   * moves on the day.
   *
   * Drew, the night before: the outdoor makers build their tents through
   * Friday morning, so the whole of Friday now starts at noon rather than
   * nine. That time is on the Show record and not in the code (rule 6), and
   * it is read by the home page and the schedule page both, so one edit
   * moves every published mention of it.
   *
   * Still a long way from a general admin API: this is one text field of one
   * record, it is public information, and it carries no money and no PII.
   */
  /* A collection per maker on the register. Safe to run at any time: it
     creates what is missing and repairs what is wrong, and leaves the rest
     alone. */
  if (act === 'collections') {
    const r = await pushCollections(db, show.id)
    return json({ register: r.detail, counts: r.counts ?? null }, r.ok ? 200 : 502)
  }

  if (act === 'hours') {
    const [row] = await db.select({ hoursNote: shows.hoursNote })
      .from(shows).where(eq(shows.id, show.id)).limit(1)
    return json({ show: show.name, hours: row?.hoursNote ?? '' })
  }

  if (act === 'sethours') {
    const text = String(body.text ?? '').trim().replace(/\s+/g, ' ')
    if (!text) return json({ error: 'text required' }, 400)
    if (text.length > 500) return json({ error: 'that is too long to be a list of days' }, 400)

    /* Checked against the same reader the pages use, because a line this
       cannot parse renders as a day with no hours beside it, and nobody
       looks at the schedule page again before a show opens. */
    const parts = text.split(' \u00b7 ').map((d) => d.trim()).filter(Boolean)
    if (parts.length === 0) return json({ error: 'no days in that' }, 400)
    const bad: string[] = []
    for (const part of parts) {
      const { day, hours } = splitDay(part)
      if (!day.trim() || !hours.trim()) { bad.push(`${part}: no hours after the comma`); continue }
      const { opens, closes } = bookends(hours)
      if (!opens || !closes) bad.push(`${part}: could not read an opening and a closing time`)
    }
    if (bad.length) return json({ error: 'that would not render', problems: bad }, 400)

    const [before] = await db.select({ hoursNote: shows.hoursNote })
      .from(shows).where(eq(shows.id, show.id)).limit(1)
    if ((before?.hoursNote ?? '') === text) {
      return json({ note: 'The hours already read exactly that.', hours: text, changed: 0 })
    }

    await db.update(shows).set({ hoursNote: text }).where(eq(shows.id, show.id))
    await db.insert(auditLog).values({
      id: randomUUID(),
      entity: 'show',
      entityId: show.id,
      action: 'hours_changed',
      actor: 'claude:register-api',
      before: JSON.stringify({ hoursNote: before?.hoursNote ?? '' }),
      after: JSON.stringify({ hoursNote: text }),
      reason: String(body.reason ?? '').trim() || 'changed at the show',
    })
    return json({
      changed: 1,
      was: before?.hoursNote ?? '',
      now: text,
      note: 'The home page and the schedule page both read this.',
    })
  }

  if (act === 'makers') {
    const counts = await db
      .select({ bookingId: inventoryItems.bookingId })
      .from(inventoryItems)
      .where(isNull(inventoryItems.voidedAt))
    const n = new Map<string, number>()
    for (const r of counts) n.set(r.bookingId, (n.get(r.bookingId) ?? 0) + 1)
    return json({
      show: show.name,
      makers: makers.map((m) => ({ code: m.code, shop: m.shop, items: n.get(m.bookingId) ?? 0 })),
    })
  }

  const maker = makers.find((m) => m.code.toUpperCase() === code)
  if (!maker) {
    return json({ error: code ? `No indoor maker here is ${code}` : 'code required' }, 400)
  }

  if (act === 'lines') {
    const lines = await linesOf(maker.bookingId)
    return json({ code: maker.code, shop: maker.shop, lines: lines.map(shown) })
  }

  if (act === 'price') {
    const toRaw = String(body.toPrice ?? '').trim()
    if (!toRaw) return json({ error: 'toPrice required' }, 400)
    const to = priceFromDollars(toRaw)
    if ('bad' in to) return json({ error: `toPrice: ${to.bad}` }, 400)
    const bad = priceProblem(to.cents)
    if (bad) return json({ error: `toPrice: ${bad}` }, 400)

    let fromCents: number | undefined
    const fromRaw = String(body.fromPrice ?? '').trim()
    if (fromRaw) {
      const from = priceFromDollars(fromRaw)
      if ('bad' in from) return json({ error: `fromPrice: ${from.bad}` }, 400)
      fromCents = from.cents
    }

    const lines = await linesOf(maker.bookingId)
    const found = findLine(lines, {
      itemId: body.itemId ? String(body.itemId) : undefined,
      match: body.match ? String(body.match) : undefined,
      fromCents,
    })
    if ('bad' in found) {
      return json({
        error: found.bad,
        /* So the caller can name one exactly on the next try rather than
           asking a person to go and read the screen. */
        lines: (found.candidates ?? lines).map((c) =>
          shown(c as ApiLine & { multiBuys: string })),
      }, 409)
    }

    const line = found.line
    if (line.priceCents === to.cents) {
      return json({ note: `${line.label || 'That line'} is already ${money(to.cents)}.`, changed: 0 })
    }

    const changed = await applyPriceEdits(
      db,
      [{ itemId: line.id, label: line.label, fromCents: line.priceCents, toCents: to.cents }],
      'claude:register-api',
      String(body.reason ?? '').trim() || 'changed at the show',
    )
    if (changed === 0) {
      return json({ error: 'That line changed while this was in flight. Ask for the lines again.' }, 409)
    }

    const push = await pushAllPrices(db, show.id)
    return json({
      changed,
      was: money(line.priceCents),
      now: money(to.cents),
      item: line.label,
      code: maker.code,
      register: push.ok ? push.detail : `NOT SENT: ${push.detail}`,
    }, push.ok ? 200 : 502)
  }

  if (act === 'add') {
    const read = readPastedList(String(body.list ?? ''))
    if (read.lines.length === 0) {
      return json({ error: 'Nothing read from that. One a line, like "Earrings $18".' }, 400)
    }
    for (const l of read.lines) {
      const problem = priceProblem(l.priceCents)
      if (problem) return json({ error: `${l.label || 'That line'}: ${problem}` }, 400)
    }

    /* Appended, never inserted: the SKUs the push builds are positional, so
       a line in the middle renumbers every line under it. */
    const [{ n }] = await db
      .select({ n: sql<number>`coalesce(max(${inventoryItems.sortOrder}), 0)` })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.bookingId, maker.bookingId), isNull(inventoryItems.voidedAt)))

    const made = read.lines.map((line, i) => ({
      row: {
        id: randomUUID(),
        bookingId: maker.bookingId,
        label: line.label,
        priceCents: line.priceCents,
        sortOrder: Number(n) + 1 + i,
        createdBy: 'claude:register-api',
      },
      breaks: line.breaks,
    }))

    await db.insert(inventoryItems).values(made.map((m) => m.row))
    for (const m of made) {
      if (m.breaks.length === 0) continue
      await db.insert(inventoryBreaks).values(m.breaks.map((b, i) => ({
        id: randomUUID(),
        itemId: m.row.id,
        qty: b.qty,
        priceCents: b.cents,
        sortOrder: i,
      })))
    }

    await db.insert(auditLog).values({
      id: randomUUID(),
      entity: 'booking',
      entityId: maker.bookingId,
      action: 'inventory_added_at_show',
      actor: 'claude:register-api',
      before: null,
      after: JSON.stringify({ lines: made.length }),
      reason: String(body.reason ?? '').trim() || 'added at the show',
    })

    const push = await pushAllPrices(db, show.id)
    return json({
      added: made.length,
      code: maker.code,
      lines: made.map((m) => ({ item: m.row.label, price: money(m.row.priceCents) })),
      register: push.ok ? push.detail : `NOT SENT: ${push.detail}`,
    }, push.ok ? 200 : 502)
  }

  return json({ error: 'do must be makers, hours, sethours, collections, lines, price or add' }, 400)
}
