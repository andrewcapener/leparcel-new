'use server'

import { createHash } from 'crypto'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import { parseAcceptSheet, type Planned } from '@/server/modules/roster/import'
import { applyPlan, planFor } from '@/server/modules/roster/apply'

/**
 * The two buttons behind /admin/import: look at what would happen, then do it.
 *
 * Both go through the same parse and the same plan, so the screen that was
 * approved and the run that follows cannot describe different things. The
 * only difference between them is whether anything is written.
 */

export type ImportSummary = {
  willBook: number
  already: number
  problems: number
  totalCents: number
  overridden: number
}

export type ImportState = {
  /** Echoed back so a rejected paste is not lost. */
  text: string
  /** Something to say above the results, or ''. */
  message: string
  /** Rows that could not even be read: no email, a duplicate, no heading. */
  problems: { line: number; detail: string }[]
  plan: Planned[]
  summary: ImportSummary | null
  /** Fingerprint of the text this plan was made from. The Accept button
   *  carries it back, so an edited textarea cannot be run on an old review. */
  digest: string
  /** Filled in only after a real run. */
  done: { booked: number; skipped: number; failed: { shop: string; detail: string }[] } | null
}

export const emptyImport: ImportState = {
  text: '', message: '', problems: [], plan: [], summary: null, digest: '', done: null,
}

/* Whitespace at the ends of lines changes nothing about what will be booked,
   so it must not invalidate a review the girls already read. */
const fingerprint = (text: string) =>
  createHash('sha256')
    .update(text.split(/\r?\n/).map((l) => l.trimEnd()).join('\n').trim())
    .digest('hex')
    .slice(0, 16)

export async function runImport(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const text = String(fd.get('sheet') ?? '')
  const apply = String(fd.get('mode') ?? '') === 'apply'
  const base: ImportState = { ...emptyImport, text }

  const show = await activeShow()
  if (!show) return { ...base, message: 'No active show.' }

  const parsed = parseAcceptSheet(text)
  if (parsed.rows.length === 0) {
    return { ...base, message: 'Nothing to import.', problems: parsed.problems }
  }

  const { plan, summary } = await planFor(db, show.id, parsed.rows)
  const digest = fingerprint(text)
  const reviewed: ImportState = { ...base, plan, summary, digest, problems: parsed.problems }

  if (!apply) {
    return {
      ...reviewed,
      message: `Nothing has been written. ${summary.willBook} would be booked.`,
    }
  }

  /* The gate. Pressing Accept is only ever allowed on the exact text that was
     read a moment ago; change one character and the review has to be redone. */
  if (String(fd.get('digest') ?? '') !== digest) {
    return {
      ...reviewed,
      message: 'The sheet changed since the dry run. Read the list again before accepting.',
    }
  }

  const who = await staffForSession((await cookies()).get(ADMIN_COOKIE)?.value)
  const done = await applyPlan(db, show.id, plan, `staff:${who?.name ?? 'staff'}`)

  revalidatePath('/admin')
  revalidatePath('/admin/roster')
  revalidatePath('/admin/jury')

  return {
    ...reviewed,
    done,
    message: done.failed.length
      ? `${done.booked} booked, ${done.failed.length} could not be.`
      : `${done.booked} booked. No email has been sent to anybody.`,
  }
}
