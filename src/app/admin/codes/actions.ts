'use server'

import { randomUUID } from 'crypto'
import { eq, sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { auditLog, bookings, spaceTypes, vendors } from '@/db/schema'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import {
  parseCodeSheet, planCodes, appliable, bumps, summariseCodes, codeNotice,
  type Holder,
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

/**
 * EVERY booking at this show, with the number it carries today.
 *
 * Every one, and the joins are left joins for that reason. The unique index
 * is on (show_id, vendor_code) across all of them, so a booking this query
 * cannot see still owns its number, and a renumber that cannot see it will
 * hand that number to somebody else and be refused.
 *
 * It was an inner join on space_types, added only to read the track for a
 * sentence on the screen, and any booking whose space type had gone fell out
 * of the plan while staying very much in the index. A missing shop name
 * costs a word on a screen; a missing row costs the whole press.
 */
async function holders(showId: string): Promise<Holder[]> {
  const rows = await db
    .select({
      bookingId: bookings.id,
      vendorId: bookings.vendorId,
      email: vendors.email,
      shopName: vendors.shopName,
      code: bookings.vendorCode,
      status: bookings.status,
      track: spaceTypes.track,
    })
    .from(bookings)
    .leftJoin(vendors, eq(bookings.vendorId, vendors.id))
    .leftJoin(spaceTypes, eq(bookings.spaceTypeId, spaceTypes.id))
    .where(eq(bookings.showId, showId))

  return rows.map((r) => ({
    bookingId: r.bookingId,
    vendorId: r.vendorId,
    email: r.email ?? '',
    shopName: r.shopName ?? 'A maker',
    code: r.code ?? '',
    status: r.status ?? '',
    track: r.track ?? '',
  }))
}

/**
 * What the screen renders: sentences, not objects.
 *
 * It used to hand the whole plan back to the browser, every row carrying
 * the maker behind it, and the pasted sheet with it, and React posts the
 * last state back with the next press. Drew's sheet is a thousand lines of
 * spreadsheet padding, so that went over the wire three times on every
 * button, and the apply threw before it reached anything worth logging.
 *
 * So the state is now flat strings and the sheet stays where he typed it,
 * in the textarea, posted once per press by the form it lives in.
 */
export type PlanRow = {
  shop: string
  email: string
  now: string
  becomes: string
  what: string
  acts: boolean
}

export type CheckState = {
  rows: PlanRow[]
  notice: string
  problems: string[]
  /** How many would actually be written, for the second button. */
  todo: number
  /** Set once something has been written. */
  done?: number
  /** Set when it went wrong, and then nothing was written. */
  error?: string
} | null

const sentence = (p: ReturnType<typeof planCodes>[number]): string => {
  /* Said out loud whenever the address in the sheet found nobody and the
     shop name found somebody, with the address actually on file, so the
     match is a person's decision rather than ours. */
  const named = 'onFile' in p && p.onFile
    ? ` Matched by shop name: the address we hold for them is ${p.onFile}, not the one in the sheet.`
    : ''
  switch (p.kind) {
    case 'change': return `Will change.${named}`
    case 'same': return 'Already right.'
    case 'bumped':
      return `Will change.${named} ${p.moves.holder.shopName} holds ${p.row.code}`
        + `${p.moves.holder.track === 'outdoor' ? ' outdoors' : ''} and is not in the`
        + ` sheet, so they move up to ${p.moves.to}.`
    case 'shared':
      return 'Two makers share this address, so we cannot tell which one this'
        + ' number belongs to. Give them separate addresses on the roster first.'
    case 'nomaker':
      return 'Nobody with this address holds a space at this show.'
  }
}

const nowOf = (p: ReturnType<typeof planCodes>[number]): string => {
  switch (p.kind) {
    case 'change': return p.from
    case 'bumped': return p.from
    case 'same': return p.holder.code
    case 'shared': return p.holders.map((h) => h.code).join(' and ')
    default: return ''
  }
}

/**
 * One door for both buttons.
 *
 * `intent` says which was pressed, so the sheet is posted once from the
 * textarea it is typed into rather than copied into a second hidden field.
 */
export async function runCodes(_prev: CheckState, fd: FormData): Promise<CheckState> {
  /* Nothing in here may throw. A server action that throws puts the admin on
     the error screen with a reference number and no way to tell whether the
     press went through, which is exactly where Drew ended up twice. */
  try {
    const text = String(fd.get('sheet') ?? '')
    const apply = String(fd.get('intent') ?? '') === 'apply'

    const show = await activeShow()
    if (!show) return { rows: [], notice: '', problems: ['No show is open.'], todo: 0 }

    const { rows, problems } = parseCodeSheet(text)
    let plan = planCodes(rows, await holders(show.id))
    let done: number | undefined

    if (apply) {
      const doing = appliable(plan)
      const moved = bumps(plan)

      /* Work out the roster as it would stand afterwards and check it, before
         asking the database to. Every booking at this show, carrying its new
         number if it has one and its old one otherwise, has to be unique:
         that is exactly what the index enforces, so if two of them match the
         press fails whatever else is true.
         
         Checked here so the answer names the number and the two makers,
         rather than arriving as a constraint name, and so nothing is
         attempted that cannot work. */
      const all = await holders(show.id)
      const newCode = new Map<string, string>()
      for (const p of doing) newCode.set(p.holder.bookingId, p.row.code)
      for (const m of moved) newCode.set(m.holder.bookingId, m.to)

      const owner = new Map<string, string>()
      const clash: string[] = []
      for (const h of all) {
        const code = (newCode.get(h.bookingId) ?? h.code).toUpperCase()
        if (!code) continue
        const already = owner.get(code)
        if (already) clash.push(`${code} would be both ${already} and ${h.shopName}.`)
        else owner.set(code, h.shopName)
      }
      if (clash.length > 0) {
        return {
          rows: [], notice: '', problems: clash, todo: 0,
          error: 'Nothing was changed. Two makers would end up on the same'
            + ' number, so the sheet needs a look first.',
        }
      }

      if (doing.length > 0) {
        await writeCodes(show.id, doing, moved)
        /* Re-read, so the screen shows the result rather than the intention:
           everything just written reads back as already right. */
        plan = planCodes(rows, await holders(show.id))
      }
      done = doing.length
    }

    const view = plan.map((p): PlanRow => ({
      shop: p.row.shop || p.row.email,
      email: p.row.email,
      now: nowOf(p),
      becomes: p.row.code,
      what: sentence(p),
      acts: p.kind === 'change' || p.kind === 'bumped',
    }))

    return {
      rows: view,
      notice: codeNotice(summariseCodes(plan)),
      problems: problems.map((x) => (x.line > 0 ? `Line ${x.line}: ${x.detail}` : x.detail)),
      todo: appliable(plan).length,
      done,
    }
  } catch (err) {
    console.error('[codes] run:', err)
    return {
      rows: [], notice: '', problems: [], todo: 0,
      error: `Nothing was changed. ${describe(err)}`,
    }
  }
}

/**
 * The database's own words, including the part that names the row.
 *
 * postgres.js puts "Key (show_id, vendor_code)=(..., MM12) already exists."
 * on `detail`, and that one line says which number two makers were about to
 * share. The message alone says only that it happened.
 */
function describe(err: unknown): string {
  const e = err as { message?: unknown; detail?: unknown }
  const message = typeof e?.message === 'string' ? e.message : 'Unknown error.'
  const detail = typeof e?.detail === 'string' ? ` ${e.detail}` : ''
  return `${message}${detail}`.slice(0, 400)
}

/**
 * Write it, all of it or none of it.
 *
 * Three statements rather than three hundred: a row at a time was forty odd
 * makers across two tables in two passes, every one its own round trip to a
 * database in another building.
 *
 * The parking pass exists because bookings carries a unique index on
 * (show_id, vendor_code) and a renumbering is full of chains: one maker
 * moves onto a number another is still holding until they move. Everybody
 * moving is parked on a value nothing can collide with, and only then given
 * their real number.
 */
async function writeCodes(
  showId: string,
  doing: ReturnType<typeof appliable>,
  moved: ReturnType<typeof bumps>,
): Promise<void> {
  const who = await staffActor()
  const writes = [
    ...doing.map((p) => ({ holder: p.holder, code: p.row.code })),
    ...moved.map((m) => ({ holder: m.holder, code: m.to })),
  ]
  const record = [
    ...doing.map((p) => ({ booking: p.holder.bookingId, from: p.from, to: p.row.code })),
    /* The makers moved up are part of the same act. Their numbers changed
       and nobody asked them, so they belong in the same row of the log. */
    ...moved.map((m) => ({ booking: m.holder.bookingId, from: m.from, to: m.to })),
  ]

  await db.transaction(async (tx) => {
    const ids = writes.map((w) => sql`${w.holder.bookingId}::text`)
    await tx.execute(sql`
      UPDATE bookings SET vendor_code = 'moving:' || id
      WHERE id IN (${sql.join(ids, sql`, `)})`)

    const byBooking = writes.map((w) => sql`(${w.holder.bookingId}::text, ${w.code}::text)`)
    await tx.execute(sql`
      UPDATE bookings SET vendor_code = v.code
      FROM (VALUES ${sql.join(byBooking, sql`, `)}) AS v(id, code)
      WHERE bookings.id = v.id`)

    const byVendor = writes.map((w) => sql`(${w.holder.vendorId}::text, ${w.code}::text)`)
    await tx.execute(sql`
      UPDATE vendors SET vendor_code = v.code
      FROM (VALUES ${sql.join(byVendor, sql`, `)}) AS v(id, code)
      WHERE vendors.id = v.id`)

    await tx.insert(auditLog).values({
      id: randomUUID(),
      entity: 'show',
      entityId: showId,
      action: 'vendor_codes_reassigned',
      actor: who,
      before: JSON.stringify(record.map((r) => ({ booking: r.booking, code: r.from }))),
      after: JSON.stringify(record.map((r) => ({ booking: r.booking, code: r.to }))),
      reason: 'maker numbers reassigned from the roster sheet',
    })
  })

  revalidatePath('/admin/roster')
  revalidatePath('/admin/codes')
}
