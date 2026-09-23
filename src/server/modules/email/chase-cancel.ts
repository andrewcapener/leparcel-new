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
  /** How many handles we held, and where each came from. Reported on the
   *  screen, because "nothing happened" is the one answer a button must
   *  never give and the difference between no ids and no permission is the
   *  whole diagnosis. */
  fromOurRecords: number
  fromProvider: number
  /** Why the provider's list gave us nothing, when it gave us nothing. */
  listProblem: string
  /** Somebody had already stopped them elsewhere and our record caught up. */
  reconciled: boolean
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
): Promise<{ ids: string[]; problem: string; listed: boolean }> {
  let res: { status: number; text: string }
  try {
    res = await resend(`/emails?limit=${LIST_MAX}`, 'GET', key)
  } catch (err) {
    return { ids: [], listed: false, problem: err instanceof Error ? err.message : 'could not reach Resend' }
  }
  if (res.status === 401 || res.status === 403) {
    /* The likeliest cause by far, and the raw message does not say it. A
       Resend key can be issued with sending access only, which is enough to
       queue sixty five emails and not enough to list or cancel one of them.
       Nothing in the send path ever reveals that, so it surfaces here, on
       the night somebody needs to take an email back. */
    return {
      ids: [], listed: false,
      problem: `Resend refused (HTTP ${res.status}): ${res.text.slice(0, 120)}. `
        + 'That is almost certainly an API key with sending access only. A key like that can '
        + 'queue an email and cannot list or cancel one. Check it at resend.com under API '
        + 'Keys: it needs full access for this button to work.',
    }
  }
  if (res.status !== 200) {
    return {
      ids: [], listed: false,
      problem: `Resend would not list the account's emails (HTTP ${res.status}). `
        + `${res.text.slice(0, 160)}`,
    }
  }
  let data: Listed[] = []
  try {
    data = (JSON.parse(res.text) as { data?: Listed[] }).data ?? []
  } catch {
    return { ids: [], listed: false, problem: 'Resend answered the list with something that is not JSON.' }
  }
  if (data.length === 0) {
    return { ids: [], listed: true, problem: 'Resend listed no emails at all on this account.' }
  }

  const matched = data
    .filter((e) => {
      const at = e.scheduled_at ? new Date(e.scheduled_at).getTime() : 0
      if (!at || at <= now.getTime()) return false
      return recipients(e).some((t) => addresses.has(t))
    })
    .map((e) => e.id)
    .filter(Boolean)

  return {
    ids: matched,
    listed: true,
    problem: matched.length > 0 ? '' :
      `Resend listed ${data.length} emails and none of ours is still waiting to go.`,
  }
}

/**
 * The addresses on a listed message, whatever shape the field arrives in.
 *
 * `to` is documented as an array and has been seen as a bare string. Calling
 * .map on a string throws, the action dies, and the button looks like it did
 * nothing, which is exactly how this was found.
 */
function recipients(e: Listed | { to?: unknown }): string[] {
  const t = (e as { to?: unknown }).to
  if (Array.isArray(t)) return t.map((x) => String(x).trim().toLowerCase())
  if (typeof t === 'string') return [t.trim().toLowerCase()]
  return []
}

/** Cancel every scheduled chase that has not gone yet. */
export async function cancelScheduledChase(
  db: DbHandle, now = new Date(),
): Promise<CancelResult> {
  const key = process.env.RESEND_API_KEY
  const { ids, unknown, addresses, rowIds } = await scheduledChase(db, now)

  const base = { fromOurRecords: ids.length, fromProvider: 0, listProblem: '', reconciled: false }

  if (ids.length === 0 && unknown === 0) {
    return { ...base, cancelled: 0, alreadyGone: 0, failed: [], nothingToDo: true }
  }
  if (!key) {
    return {
      ...base, cancelled: 0, alreadyGone: 0, nothingToDo: false,
      failed: [{ id: '', detail: 'No Resend key on this deployment, so nothing can be cancelled.' }],
    }
  }

  const all = new Set(ids)
  let fromProvider = 0
  let listProblem = ''
  /* The provider answered and had nothing of ours waiting. That is an answer,
     not a failure: whatever we think is in flight is not. */
  let confirmedNoneWaiting = false
  if (unknown > 0) {
    const rec = await recoverIds(key, addresses, now)
    listProblem = rec.problem
    for (const id of rec.ids) { if (!all.has(id)) fromProvider++; all.add(id) }
    confirmedNoneWaiting = rec.listed && rec.ids.length === 0
  }

  let cancelled = 0
  let alreadyGone = 0
  const failed: { id: string; detail: string }[] = []

  for (const id of all) {
    const res = await resend(`/emails/${encodeURIComponent(id)}/cancel`, 'POST', key)
    if (res.status === 200) { cancelled++; continue }

    /* Already cancelled, by somebody in the provider's own dashboard. That is
       the goal, not a failure, and it counts as cancelled so our record stops
       claiming the message is on its way. Drew stopped the first batch by
       hand while this button was being fixed, and a database still insisting
       those sixty five were in flight would have left the whole roster
       unticked on the re-send with nothing on screen explaining it. */
    if (/cancel/i.test(res.text)) { cancelled++; continue }

    /* Gone. Not a failure either, but a genuinely different thing: an email
       that has been delivered cannot be recalled and must never be recorded
       as though it were. */
    if (res.status === 404 || /already sent|delivered|not scheduled/i.test(res.text)) {
      alreadyGone++
      continue
    }
    failed.push({ id, detail: `HTTP ${res.status}: ${res.text.slice(0, 160)}` })
  }

  /* Our record catches up in two cases: we cancelled something, or the
     provider told us plainly that nothing of ours is waiting. The second is
     what happens when somebody cancels in the dashboard, which is exactly
     what we tell people to do when this button cannot. Without it the screen
     would insist sixty five emails were in flight forever, and the re-send
     list would stay unticked with no explanation. */
  const reconciled = confirmedNoneWaiting && cancelled === 0 && failed.length === 0
  if ((cancelled > 0 || reconciled) && rowIds.length > 0) {
    await db.update(emailOutbox)
      .set({
        deliveryStatus: 'cancelled',
        deliveryDetail: reconciled
          ? `not scheduled at Resend, reconciled ${now.toISOString()}`
          : `cancelled ${now.toISOString()}`,
      })
      .where(inArray(emailOutbox.id, rowIds))
  }

  return {
    cancelled: reconciled ? rowIds.length : cancelled,
    alreadyGone, failed, nothingToDo: false,
    fromOurRecords: ids.length, fromProvider,
    listProblem: reconciled ? '' : listProblem,
    reconciled,
  }
}
