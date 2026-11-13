import type { db as Db } from '@/db'
import { collectionsFor, makerLines, shopifyProducts, type MakerLines } from './products'

type DbHandle = typeof Db

/**
 * Send every indoor maker's prices to the register.
 *
 * Everybody and not just the maker who changed, because the push matches on
 * SKU and rewrites only what differs: sending one maker and sending all of
 * them produce the same store, and sending all of them cannot leave behind a
 * second edit somebody made while this one was in flight.
 *
 * Lives here rather than in a Server Action so the admin screen and the API
 * both reach the register the same way. Two code paths to Shopify is two
 * answers to "did it go", and the one that gets fixed is never the one in
 * use at the time.
 */

/**
 * Where the register lives, and the key to write to it.
 *
 * The URL has a default and only the key has to be set, which is how the
 * admin's own push has always read it. Requiring both here was a regression:
 * SHOPIFY_API_URL has never been set on this app because it never needed to
 * be, so every write through this module answered "the register is not
 * configured" while the screen next door worked fine.
 */
const wiring = () => {
  const url = (process.env.SHOPIFY_API_URL?.trim() || 'https://housework-api.vercel.app/api')
    .replace(/\/$/, '')
  const key = process.env.SHOPIFY_EXECUTE_KEY?.trim()
  return key ? { url, key } : null
}

export type PushResult = { ok: boolean; detail: string; counts?: Record<string, number> }

export async function pushAllPrices(db: DbHandle, showId: string): Promise<PushResult> {
  const w = wiring()
  if (!w) return { ok: false, detail: 'the register link is not configured on this app' }

  const products = shopifyProducts(await makerLines(db, showId))
  if (products.length === 0) return { ok: false, detail: 'there are no prices to send' }

  try {
    const res = await fetch(`${w.url}/shopify-products-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': w.key },
      body: JSON.stringify({ client: 'mermade', dryRun: false, products }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || data?.error) {
      return { ok: false, detail: String(data?.error ?? 'Shopify refused it') }
    }
    const c = (data?.counts ?? {}) as Record<string, number>
    return {
      ok: true,
      detail: `${c.update ?? 0} updated, ${c.create ?? 0} added`,
      counts: c,
    }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'could not reach the register' }
  }
}

/**
 * One collection per maker, so the register is organised by who made the
 * thing rather than by what it is.
 *
 * Same wiring and the same reasoning as the prices push: every maker every
 * time, because the push leaves an existing collection alone and only
 * creates what is missing, so sending one and sending all produce the same
 * store.
 *
 * It also repairs what is already there. A collection the register cannot
 * see, or one listing a maker's goods in no useful order, is fixed in place
 * rather than recreated: see the housework-api route, which sets the field
 * and then reads it back rather than believing the write.
 */
export async function pushCollections(db: DbHandle, showId: string): Promise<PushResult> {
  const w = wiring()
  if (!w) return { ok: false, detail: 'the register link is not configured on this app' }

  const makers = collectionsFor(await makerLines(db, showId))
  if (makers.length === 0) {
    return { ok: false, detail: 'no maker has filed a price yet, so there is nothing to group' }
  }

  try {
    const res = await fetch(`${w.url}/shopify-collections-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': w.key },
      body: JSON.stringify({ client: 'mermade', dryRun: false, makers }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || data?.error) {
      return { ok: false, detail: String(data?.error ?? 'Shopify refused it') }
    }
    const c = (data?.counts ?? {}) as Record<string, number>
    const failed = Array.isArray(data?.failed) ? data.failed.length : 0
    return {
      ok: failed === 0,
      detail: `${data?.created ?? 0} created, ${data?.fixed ?? 0} fixed, ${c.exists ?? 0} already right`
        + (failed ? `, ${failed} FAILED` : ''),
      counts: { ...c, created: Number(data?.created ?? 0), fixed: Number(data?.fixed ?? 0), failed },
    }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'could not reach the register' }
  }
}

/**
 * Goods Mermade sells itself, which are not a maker's goods.
 *
 * Drew, the night before: "create MM42 as a collection, it's us as admins."
 * The ribbon and the lifeguard hats on the front table are the market's own
 * stock, and modelling them as a maker would be wrong in a way that only
 * shows up in December: a booking snapshots commission_bps the moment it is
 * made and never changes it, so Mermade would spend the winter holding a
 * statement saying it owes itself eighty percent of its own ribbon.
 *
 * There is nobody to pay, so there is no booking. The goods exist in Shopify
 * under their own code and nowhere else, which is exactly right: they ring
 * up, they carry tax, they land on the day's takings, and no payout is ever
 * computed for them.
 *
 * The consequence is that nothing here is managed by the prices push, which
 * reads bookings. These products are written once and then left alone, so a
 * later price change to one of them is its own call rather than a side
 * effect of a maker's edit.
 */
export async function pushHouseGoods(maker: MakerLines): Promise<PushResult> {
  const w = wiring()
  if (!w) return { ok: false, detail: 'the register link is not configured on this app' }

  const products = shopifyProducts([maker])
  if (products.length === 0) return { ok: false, detail: 'nothing to send' }

  const send = async (path: string, body: unknown) => {
    const res = await fetch(`${w.url}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': w.key },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    return { ok: res.ok && !data?.error, data }
  }

  try {
    const goods = await send('shopify-products-push', {
      client: 'mermade', dryRun: false, products,
    })
    if (!goods.ok) {
      return { ok: false, detail: String(goods.data?.error ?? 'Shopify refused the products') }
    }

    /* The collection second, because its rule matches on vendor and there is
       nothing for it to gather until the products carry that vendor. */
    const group = await send('shopify-collections-push', {
      client: 'mermade', dryRun: false,
      makers: [{ code: maker.code, shop: maker.shop }],
    })
    const c = (goods.data?.counts ?? {}) as Record<string, number>
    if (!group.ok) {
      return {
        ok: false,
        detail: `${c.create ?? 0} products added, but the collection failed: `
          + String(group.data?.error ?? 'refused'),
        counts: c,
      }
    }
    return {
      ok: true,
      detail: `${c.create ?? 0} added, ${c.update ?? 0} updated; collection `
        + `${group.data?.created ?? 0} created, ${group.data?.fixed ?? 0} fixed`,
      counts: c,
    }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'could not reach the register' }
  }
}
