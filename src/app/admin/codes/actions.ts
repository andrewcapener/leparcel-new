'use server'

import { randomUUID } from 'crypto'
import { eq, inArray } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { auditLog, bookings, vendors } from '@/db/schema'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import {
  parseCodeSheet, planCodes, appliable, type CodePlan, type Holder,
} from '@/server/modules/roster/codes'

/** Who pressed it (rule 3). A name, never an address. */
async function staffActor(): Promise<string> {
  try {
    const who = await staffForSession((await cookies()).get(ADMIN_COOKIE)?.value)
    return `staff:${who?.name ?? 'staff'}`
  } catch {
    return 'staff:staff'
  }
}

/** Everybody holding a space at this show, with the number they carry today. */
async function holders(showId: string): Promise<Holder[]> {
  return db
    .select({
      bookingId: bookings.id,
      vendorId: bookings.vendorId,
      email: vendors.email,
      shopName: vendors.shopName,
      code: bookings.vendorCode,
    })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .where(eq(bookings.showId, showId))
}

export type CheckState = {
  text: string
  plan: CodePlan[]
  problems: { line: number; detail: string }[]
  done?: { changed: number }
} | null

/**
 * Read the paste and say what it would do. Writes nothing.
 *
 * Separate from applying it on purpose: a Mermade ID is what a Venmo note is
 * matched by, so moving forty of them is moving the thing that identifies
 * forty people's money, and that gets read before it gets pressed.
 */
export async function checkCodes(_prev: CheckState, fd: FormData): Promise<CheckState> {
  const text = String(fd.get('sheet') ?? '')
  const show = await activeShow()
  if (!show) return { text, plan: [], problems: [{ line: 0, detail: 'No show is open.' }] }

  const { rows, problems } = parseCodeSheet(text)
  return { text, plan: planCodes(rows, await holders(show.id)), problems }
}

/**
 * Write the ones that were safe to write, and only those.
 *
 * The plan is rebuilt here from the same paste rather than trusted from the
 * screen, so a stale tab cannot apply a number to a maker whose space was
 * released since it loaded, and nothing a browser posts decides who gets
 * which code.
 *
 * The code lives in two places, the vendor and the booking, and they are
 * written together. A booking whose vendorCode disagrees with its vendor is
 * how a maker is called one thing on the roster and another on her invoice.
 */
export async function applyCodes(_prev: CheckState, fd: FormData): Promise<CheckState> {
  const text = String(fd.get('sheet') ?? '')
  const show = await activeShow()
  if (!show) return { text, plan: [], problems: [{ line: 0, detail: 'No show is open.' }] }

  const { rows, problems } = parseCodeSheet(text)
  const plan = planCodes(rows, await holders(show.id))
  const doing = appliable(plan)
  if (doing.length === 0) return { text, plan, problems, done: { changed: 0 } }

  const who = await staffActor()
  const before = doing.map((p) => ({
    booking: p.holder.bookingId, shop: p.holder.shopName, from: p.from, to: p.row.code,
  }))

  for (const p of doing) {
    await db.update(bookings)
      .set({ vendorCode: p.row.code })
      .where(eq(bookings.id, p.holder.bookingId))
    await db.update(vendors)
      .set({ vendorCode: p.row.code })
      .where(eq(vendors.id, p.holder.vendorId))
  }

  /* One row for the press rather than forty. This is a single editorial act
     by a named person: the girls renumbered the room, and that is the
     question somebody asks in February. The before and after of every maker
     is in it (rule 3). */
  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'show',
    entityId: show.id,
    action: 'vendor_codes_reassigned',
    actor: who,
    before: JSON.stringify(before.map((b) => ({ booking: b.booking, code: b.from }))),
    after: JSON.stringify(before.map((b) => ({ booking: b.booking, code: b.to }))),
    reason: 'maker numbers reassigned from the roster sheet',
  })

  revalidatePath('/admin/roster')
  revalidatePath('/admin/codes')

  /* Re-planned against what is now true, so the screen shows the result
     rather than the intention: everything just written reads back as
     "already right". */
  const after = planCodes(rows, await holders(show.id))
  return { text, plan: after, problems, done: { changed: doing.length } }
}
