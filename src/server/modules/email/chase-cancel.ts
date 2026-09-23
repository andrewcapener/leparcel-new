import { and, eq, inArray } from 'drizzle-orm'
import { emailOutbox } from '@/db/schema'
import type { db as Db } from '@/db'
import { CHASE_TEMPLATE } from './chase-send'

type DbHandle = typeof Db
const TIMEOUT_MS = 20_000
const LIST_MAX = 100

/**
 * Stop a chase that has been scheduled but has not gone out yet.
 *
 * Drew scheduled sixty five, then read one and wanted the greeting changed.
 * A scheduled send is the one kind of email you can still take back, so this
 * is the screen that takes it back, and the whole reason to prefer Resend's
 * own scheduling over waking something up at nine: the batch sits somewhere
 * it can be reached until the moment it goes.
 *
 * Cancelling is one call per message and needs the provider's id for each.
 * Those are stored now, but the batch that prompted this predates the column,
 * so ids are recovered from the provider's own list when our record is empty.
 * That path is deliberately narrow: only messages this account has scheduled
 * for the future, and only to addresses we have a chase row for. Cancelling
 * somebody else's scheduled mail because it happened to be in the same
 * account would be its own disaster.
 */

export type CancelResult = {
  cancelled: number
  alreadyGone: number
  failed: { id: string; detail: string }[]
  /** Nothing was scheduled, so nothing was there to stop. */
  nothingToDo: boolean
}

type Listed = { id: string; to: string[]; scheduled_at?: string | null; last_event?: string }

async function resend(path: string, method: 'GET' | 'POST', key: string) {
  const res = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  return { status: res.status, text: await res.text() }
}

/**
 * Which messages are still waiting to go.
 *
 * Our own rows first, because they are the truth about what we sent and to
 * whom. The provider's list is only consulted to fill in ids we never kept.
 */
export async function scheduledChase(
  db: DbHandle, now = new Date(),
): Promise<{ ids: string[]; unknown: number; addresses: Set<string>; rowIds: string[] }> {
  const rows = await db
    .select({
      id: emailOutbox.id, to: emailOutbox.toEmail, providerId: emailOutbox.providerId,
      status: emailOutbox.deliveryStatus, detail: emailOutbox.deliveryDetail,
    })
    .from(emailOutbox)
    .where(and(
      eq(emailOutbox.template, CHASE_TEMPLATE),
      eq(emailOutbox.deliveryStatus, 'sent'),
    ))

  /* Only the ones whose arrival is still ahead of us. A chase that has
     already landed cannot be unsent and must not be reported as cancellable. */
  const pending = rows.filter((r) => {
    const m = r.detail.match(/scheduled for (\S+)/)
    return m ? new Date(m[1]!).getTime() > now.getTime() : false
  })

  return {
    ids: pending.map((r) => r.providerId ?? '').filter(Boolean),
    unknown: pending.filter((r) => !r.providerId).length,
    addresses: new Set(pending.map((r) => r.to.toLowerCase())),
    /* Our own row ids, so only the messages that were actually pending are
       marked cancelled. Marking every sent chase row would rewrite the
       history of batches that have already landed. */
    rowIds: pending.map((r) => r.id),
  }
}

/**
 * Ask the provider which of its scheduled messages are ours.
 *
 * Used only for messages sent before their ids were stored. Matching is on
 * the address AND on the message still being scheduled for the future, so
 * nothing outside this chase is ever touched.
 */
export async function recoverIds(
  key: string, addresses: Set<string>, now = new Date(),
): Promise<string[]> {
  const res = await resend(`/emails?limit=${LIST_MAX}`, 'GET', key)
  if (res.status !== 200) return []
  let data: Listed[] = []
  try {
    data = (JSON.parse(res.text) as { data?: Listed[] }).data ?? []
  } catch { return [] }

  return data
    .filter((e) => {
      const at = e.scheduled_at ? new Date(e.scheduled_at).getTime() : 0
      if (!at || at <= now.getTime()) return false
      const to = (e.to ?? []).map((t) => String(t).toLowerCase())
      return to.some((t) => addresses.has(t))
    })
    .map((e) => e.id)
    .filter(Boolean)
}

/** Cancel every scheduled chase that has not gone yet. */
export async function cancelScheduledChase(
  db: DbHandle, now = new Date(),
): Promise<CancelResult> {
  const key = process.env.RESEND_API_KEY
  const { ids, unknown, addresses, rowIds } = await scheduledChase(db, now)

  if (ids.length === 0 && unknown === 0) {
    return { cancelled: 0, alreadyGone: 0, failed: [], nothingToDo: true }
  }
  if (!key) {
    return {
      cancelled: 0, alreadyGone: 0, nothingToDo: false,
      failed: [{ id: '', detail: 'No Resend key on this deployment, so nothing can be cancelled.' }],
    }
  }

  const all = new Set(ids)
  if (unknown > 0) for (const id of await recoverIds(key, addresses, now)) all.add(id)

  let cancelled = 0
  let alreadyGone = 0
  const failed: { id: string; detail: string }[] = []

  for (const id of all) {
    const res = await resend(`/emails/${encodeURIComponent(id)}/cancel`, 'POST', key)
    if (res.status === 200) { cancelled++; continue }
    /* Already sent, or already cancelled. Not a failure: the goal was that it
       does not go out again, and one that has gone cannot be recalled. */
    if (res.status === 404 || /already|not scheduled/i.test(res.text)) { alreadyGone++; continue }
    failed.push({ id, detail: `HTTP ${res.status}: ${res.text.slice(0, 160)}` })
  }

  if (cancelled > 0 && rowIds.length > 0) {
    await db.update(emailOutbox)
      .set({ deliveryStatus: 'cancelled', deliveryDetail: `cancelled ${now.toISOString()}` })
      .where(inArray(emailOutbox.id, rowIds))
  }

  return { cancelled, alreadyGone, failed, nothingToDo: false }
}
