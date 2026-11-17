import { readSale, type Sale } from './read'

/**
 * Every order the register has taken, out of Shopify.
 *
 * Read only, and through the same wiring the pushes use, so the dashboard
 * cannot see a store the pushes cannot write to.
 */

const wiring = () => {
  const url = (process.env.SHOPIFY_API_URL?.trim() || 'https://housework-api.vercel.app/api')
    .replace(/\/$/, '')
  const key = process.env.SHOPIFY_EXECUTE_KEY?.trim()
  return key ? { url, key } : null
}

export type SalesRead =
  | {
      ok: true
      sales: Sale[]
      /**
       * The orders exactly as Shopify sent them.
       *
       * A Sale is a summary and a statement cannot be built from one: the
       * prorated discount allocations and the refund lines are both thrown
       * away on the way in, and those are the two things that decide what a
       * maker is actually owed.
       */
      orders: Array<Record<string, unknown>>
      /** SKU to the maker's own name for it, for statements. */
      labels: Map<string, string>
      at: string
    }
  | { ok: false; detail: string }

/** Every product's own description, by SKU, so a statement can name a line. */
async function fetchLabels(w: { url: string; key: string }): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  let pageInfo = ''
  let pages = 0
  do {
    const q = pageInfo
      ? `limit=250&page_info=${encodeURIComponent(pageInfo)}`
      : 'limit=250&fields=id,body_html,variants'
    const res = await fetch(
      `${w.url}/shopify-admin?client=mermade&path=products.json&${q}`,
      { headers: { 'x-api-key': w.key }, cache: 'no-store' },
    )
    const data = await res.json().catch(() => null)
    if (!res.ok || data?.error) break
    for (const p of data?.data?.products ?? []) {
      const label = String(p.body_html ?? '').trim()
      for (const v of p.variants ?? []) {
        if (v?.sku) out.set(String(v.sku), label)
      }
    }
    pageInfo = String(data?.nextPageInfo ?? '')
    pages += 1
  } while (pageInfo && pages < 8)
  return out
}

export async function fetchSales(): Promise<SalesRead> {
  const w = wiring()
  if (!w) return { ok: false, detail: 'the register link is not configured on this app' }

  const sales: Sale[] = []
  const raw: Array<Record<string, unknown>> = []
  let pageInfo = ''
  let pages = 0

  try {
    do {
      /* status=any on the first page only: Shopify refuses it alongside
         page_info, with an error that reads like a bad request rather than
         like a pagination rule. */
      const q = pageInfo
        ? `limit=250&page_info=${encodeURIComponent(pageInfo)}`
        : 'limit=250&status=any'
      const res = await fetch(
        `${w.url}/shopify-admin?client=mermade&path=orders.json&${q}`,
        { headers: { 'x-api-key': w.key }, cache: 'no-store' },
      )
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.error) {
        return { ok: false, detail: String(data?.error ?? 'Shopify refused the read') }
      }
      for (const o of data?.data?.orders ?? []) {
        sales.push(readSale(o))
        raw.push(o)
      }
      pageInfo = String(data?.nextPageInfo ?? '')
      pages += 1
    } while (pageInfo && pages < 12)

    /* Shopify can hand the same order back across a page boundary when one
       is written while the pages are being walked, and a show day writes one
       every twenty seconds. */
    const seen = new Set<number>()
    const once = sales.filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    const seenRaw = new Set<number>()
    const rawOnce = raw.filter((o) => {
      const id = Number(o.id)
      if (seenRaw.has(id)) return false
      seenRaw.add(id)
      return true
    })
    return {
      ok: true,
      sales: once,
      orders: rawOnce,
      labels: await fetchLabels(w),
      at: new Date().toISOString(),
    }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'could not reach the register' }
  }
}
