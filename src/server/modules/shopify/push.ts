import type { db as Db } from '@/db'
import { makerLines, shopifyProducts } from './products'

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

const wiring = () => {
  const url = process.env.SHOPIFY_API_URL?.replace(/\/$/, '')
  const key = process.env.SHOPIFY_EXECUTE_KEY
  return url && key ? { url, key } : null
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
