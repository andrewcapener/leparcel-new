import Link from 'next/link'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { bookings, inventoryBreaks, inventoryItems, spaceTypes, vendors } from '@/db/schema'
import { holdsSpace } from '@/server/modules/payments/booking-status'
import { multiBuyWords } from '@/server/modules/roster/inventory-export'
import { byCode } from '@/server/modules/roster/inventory-print'
import { AddForm, PriceForm, type Line } from './Forms'

export const dynamic = 'force-dynamic'
/* The save pushes every price to Shopify, which is several hundred calls. */
export const maxDuration = 300

/**
 * Fix a price while the show is open, from a phone.
 *
 * Drew, the night before doors: "vendors will come in and want to change
 * things, or we'll find a discrepancy here and there, and I won't have my
 * laptop."
 *
 * Everything else about inventory is built for a quiet week in October, and
 * is two screens: the roster to change the list, /admin/shopify to send it.
 * This is one screen with one button, because the person using it is standing
 * at a counter with somebody waiting.
 *
 * Indoor only. An outdoor maker takes her own money at her own tent, so there
 * is no price of hers for this to change.
 */

/* Dollars for a text box: no symbol, and the cents only when there are any,
   so the thing somebody edits reads the way they would have typed it. */
function boxDollars(cents: number): string {
  const whole = Math.trunc(cents / 100)
  const rest = Math.abs(cents) % 100
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, '0')}`
}

const css = `
.reg { max-width: 620px; margin: 0 auto }
.reg h1 { font-family: var(--font-c); font-weight: 600; text-transform: uppercase;
  letter-spacing: .04em; font-size: 23px; margin: 0 }
.reg .reg-lede { color: var(--ad-ink-3); margin: 6px 0 20px; font-size: var(--t-s) }
.reg .reg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px }
.reg .reg-grid a {
  display: block; border: 1px solid var(--ad-line); border-radius: 8px; padding: 10px 11px;
  background: var(--ad-card);
}
.reg .reg-grid b { display: block; font-family: var(--font-m); font-size: 14px }
.reg .reg-grid span { display: block; font-size: 11.5px; color: var(--ad-ink-3); margin-top: 2px }
.reg .reg-grid em { font-style: normal; color: var(--ad-warn) }

.reg .reg-hd { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 2px }
.reg .reg-id { font-family: var(--font-m); font-size: 15px; border: 1.5px solid var(--ad-ink);
  padding: 1px 7px; border-radius: 4px }
.reg .reg-back { display: inline-block; margin-bottom: 16px; font-size: var(--t-s);
  color: var(--ad-ink-3); text-decoration: underline }

.reg .reg-form { margin: 0 0 30px }
.reg .reg-lines { list-style: none; margin: 0 0 14px; padding: 0 }
.reg .reg-lines li {
  display: flex; align-items: center; gap: 12px; justify-content: space-between;
  padding: 9px 0; border-bottom: 1px solid var(--ad-line);
}
.reg .reg-lines label { flex: 1; min-width: 0 }
.reg .reg-item { display: block; font-size: 15px; line-height: 1.3 }
.reg .reg-multi { display: block; font-size: 11.5px; color: var(--ad-ink-3); margin-top: 2px }
.reg .reg-money { display: flex; align-items: center; gap: 3px; flex: 0 0 auto }
.reg .reg-money span { color: var(--ad-ink-3) }
/* 17px so iOS does not zoom the page when the box takes focus, and a target
   somebody can hit without looking. */
.reg .reg-money input {
  width: 84px; font-size: 17px; font-variant-numeric: tabular-nums;
  padding: 10px 10px; border: 1px solid var(--ad-line-2); border-radius: 8px;
  background: var(--ad-card); color: var(--ad-ink); text-align: right;
}
.reg .reg-why { display: block; font-size: var(--t-cap); text-transform: uppercase;
  letter-spacing: .08em; color: var(--ad-ink-3); margin: 0 0 14px }
.reg .reg-why input, .reg .reg-why textarea {
  display: block; width: 100%; margin-top: 6px; font-size: 17px; font-family: inherit;
  padding: 10px 11px; border: 1px solid var(--ad-line-2); border-radius: 8px;
  background: var(--ad-card); color: var(--ad-ink); text-transform: none; letter-spacing: 0;
}
.reg .btn { width: 100%; padding: 14px; font-size: 16px; border-radius: 8px }
.reg .reg-ok, .reg .reg-bad { margin: 12px 0 0; font-size: var(--t-s); line-height: 1.45 }
.reg .reg-ok { color: var(--ad-ink-2) }
.reg .reg-bad { color: var(--ad-warn) }
.reg .reg-sec { font-family: var(--font-c); font-weight: 600; text-transform: uppercase;
  letter-spacing: .08em; font-size: var(--t-cap); color: var(--ad-ink-3);
  margin: 0 0 10px; padding-top: 22px; border-top: 1px solid var(--ad-line) }
.reg .reg-note { font-size: var(--t-s); color: var(--ad-ink-3); line-height: 1.5 }
`

export default async function RegisterDesk({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams
  const show = await activeShow()
  if (!show) throw new Error('No active show.')

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
    .where(eq(bookings.showId, show.id))

  const makers = rows
    .filter((r) => r.track !== 'outdoor' && holdsSpace(r.status))
    .sort((a, b) => byCode(a.code, b.code))

  const picked = code
    ? makers.find((m) => m.code.toUpperCase() === code.toUpperCase())
    : undefined

  /* The counts on the picker, so somebody looking for "the maker with no
     prices" can see which one that is without opening nine of them. */
  const counts = new Map<string, number>()
  if (!picked) {
    const all = await db
      .select({ bookingId: inventoryItems.bookingId })
      .from(inventoryItems)
      .where(isNull(inventoryItems.voidedAt))
    for (const r of all) counts.set(r.bookingId, (counts.get(r.bookingId) ?? 0) + 1)
  }

  let lines: Line[] = []
  if (picked) {
    const items = await db
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.bookingId, picked.bookingId), isNull(inventoryItems.voidedAt)))
      .orderBy(asc(inventoryItems.sortOrder), asc(inventoryItems.createdAt))

    const breaks = items.length
      ? await db.select().from(inventoryBreaks)
          .where(inArray(inventoryBreaks.itemId, items.map((i) => i.id)))
          .orderBy(asc(inventoryBreaks.qty))
      : []
    const breaksOf = new Map<string, { qty: number; cents: number }[]>()
    for (const b of breaks) {
      breaksOf.set(b.itemId, [...(breaksOf.get(b.itemId) ?? []), { qty: b.qty, cents: b.priceCents }])
    }

    lines = items.map((i) => ({
      id: i.id,
      label: i.label,
      price: boxDollars(i.priceCents),
      multiBuys: multiBuyWords(breaksOf.get(i.id) ?? []),
    }))
  }

  return (
    <div className="reg">
      {!picked ? (
        <>
          <h1>The register desk</h1>
          <p className="reg-lede">
            Change a price or add something, and the register has it in one press.
            Pick a maker.
          </p>
          <div className="reg-grid">
            {makers.map((m) => {
              const n = counts.get(m.bookingId) ?? 0
              return (
                <Link key={m.code} href={`/admin/register?code=${encodeURIComponent(m.code)}`}>
                  <b>{m.code}</b>
                  <span>{m.shop}</span>
                  <span>{n === 0 ? <em>no prices</em> : n === 1 ? '1 item' : `${n} items`}</span>
                </Link>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <Link className="reg-back" href="/admin/register">
            All makers
          </Link>
          <div className="reg-hd">
            <span className="reg-id">{picked.code}</span>
            <h1>{picked.shop}</h1>
          </div>
          <p className="reg-lede">
            {lines.length === 0
              ? 'Nothing on her list yet. Add it below.'
              : 'Change a price and press the button. Everything goes to the register together.'}
          </p>

          {lines.length > 0 ? <PriceForm bookingId={picked.bookingId} lines={lines} /> : null}

          <p className="reg-sec">Add something</p>
          <AddForm bookingId={picked.bookingId} />

          <p className="reg-note">
            To take something off the register, archive that product in Shopify.
            Removing it here would renumber her other lines and move their
            prices onto the wrong products.
          </p>
        </>
      )}
      <style>{css}</style>
    </div>
  )
}
