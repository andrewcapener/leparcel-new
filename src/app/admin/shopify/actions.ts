'use server'

import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { auditLog } from '@/db/schema'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import { collectionsFor, makerLines, shopifyProducts } from '@/server/modules/shopify/products'
import type { PushState } from './state'

/** Who pressed it (rule 3). A name, never an address. */
async function staffActor(): Promise<string> {
  try {
    const who = await staffForSession((await cookies()).get(ADMIN_COOKIE)?.value)
    return `staff:${who?.name ?? 'staff'}`
  } catch {
    return 'staff:staff'
  }
}

/**
 * Where the Shopify routes live, and the key that opens them.
 *
 * Both have to be set here for the buttons to do anything. Unset is not an
 * error state worth hiding: the page says so, and the payload is still shown
 * and still downloadable, so somebody can do it by hand from another machine.
 */
function wiring(): { url: string; key: string } | null {
  const url = process.env.SHOPIFY_API_URL?.trim() || 'https://housework-api.vercel.app/api'
  const key = process.env.SHOPIFY_EXECUTE_KEY?.trim() || ''
  return key ? { url: url.replace(/\/$/, ''), key } : null
}

async function call(path: string, body: unknown): Promise<{ ok: boolean; data: any }> {
  const w = wiring()
  if (!w) return { ok: false, data: { error: 'SHOPIFY_EXECUTE_KEY is not set on this app.' } }
  try {
    const res = await fetch(`${w.url}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': w.key },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    return { ok: res.ok && !data?.error, data }
  } catch (err) {
    return { ok: false, data: { error: err instanceof Error ? err.message : 'Could not reach the API' } }
  }
}

/**
 * Send this season's prices to the register.
 *
 * Dry run unless the form says otherwise, which is the same bargain the
 * numbers screen and the roster importer make: read what it would do, then do
 * it. The thing being rewritten is the catalogue a till reads on Friday
 * morning, so nobody should find out what it changed by watching it change.
 */
export async function pushProducts(prev: PushState, fd: FormData): Promise<PushState> {
  const show = await activeShow()
  if (!show) return { ...prev, error: 'No active show.' }
  const apply = String(fd.get('intent') ?? '') === 'apply'

  const makers = await makerLines(db, show.id)
  const products = shopifyProducts(makers)
  if (products.length === 0) {
    return { ...prev, error: 'No indoor maker has filed a price yet, so there is nothing to send.' }
  }

  const r = await call('shopify-products-push', {
    client: 'mermade', dryRun: !apply, products,
  })
  if (!r.ok) return { ...prev, error: String(r.data?.error ?? 'Shopify refused it'), result: r.data }

  if (apply) {
    await db.insert(auditLog).values({
      id: randomUUID(),
      entity: 'show',
      entityId: show.id,
      action: 'shopify_products_pushed',
      actor: await staffActor(),
      before: null,
      after: JSON.stringify({ sent: products.length, counts: r.data?.counts ?? null }),
      reason: 'price lists sent to the register',
    })
  }
  return { ...prev, error: null, applied: apply, result: r.data, sent: products.length }
}

/** One collection per maker who has something to sell. Dry run by default. */
export async function pushCollections(prev: PushState, fd: FormData): Promise<PushState> {
  const show = await activeShow()
  if (!show) return { ...prev, error: 'No active show.' }
  const apply = String(fd.get('intent') ?? '') === 'apply'

  const makers = collectionsFor(await makerLines(db, show.id))
  if (makers.length === 0) {
    return { ...prev, error: 'No indoor maker has filed a price yet, so there is nothing to group.' }
  }

  const r = await call('shopify-collections-push', {
    client: 'mermade', dryRun: !apply, makers,
  })
  if (!r.ok) return { ...prev, error: String(r.data?.error ?? 'Shopify refused it'), result: r.data }

  if (apply) {
    await db.insert(auditLog).values({
      id: randomUUID(),
      entity: 'show',
      entityId: show.id,
      action: 'shopify_collections_pushed',
      actor: await staffActor(),
      before: null,
      after: JSON.stringify({ makers: makers.length, counts: r.data?.counts ?? null }),
      reason: 'a collection per maker on the register',
    })
  }
  return { ...prev, error: null, applied: apply, result: r.data, sent: makers.length }
}

/**
 * Take an older season out of the register.
 *
 * Archives, never deletes, and the cut-off is this show's own first day
 * rather than a date typed into a form: anything created before this show was
 * being built belongs to a show that is over.
 */
export async function archiveOld(prev: PushState, fd: FormData): Promise<PushState> {
  const show = await activeShow()
  if (!show) return { ...prev, error: 'No active show.' }
  const apply = String(fd.get('intent') ?? '') === 'apply'

  const before = String(fd.get('createdBefore') ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(before)) {
    return { ...prev, error: 'Give a date as YYYY-MM-DD.' }
  }

  const r = await call('shopify-products-archive', {
    client: 'mermade', dryRun: !apply, createdBefore: before,
  })
  if (!r.ok) return { ...prev, error: String(r.data?.error ?? 'Shopify refused it'), result: r.data }

  if (apply) {
    await db.insert(auditLog).values({
      id: randomUUID(),
      entity: 'show',
      entityId: show.id,
      action: 'shopify_products_archived',
      actor: await staffActor(),
      before: null,
      after: JSON.stringify({ createdBefore: before, done: r.data?.done ?? null }),
      reason: 'an older season taken out of the register',
    })
  }
  return { ...prev, error: null, applied: apply, result: r.data, sent: r.data?.done ?? r.data?.wouldArchive ?? 0 }
}
