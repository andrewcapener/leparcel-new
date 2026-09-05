'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { eq, and, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { activeShow, activeAddOns, pgCode } from '@/db/queries'
import {
  shows, vendors, applications, bookings, spaceTypes, auditLog,
  emailOutbox, subscribers, CATEGORIES, type ApplicationStatus,
} from '@/db/schema'
import { applicationWindow, fmtDate, fmtRange, laWallToIso } from '@/lib/dates'
import { usd } from '@/lib/money'

/* ═══════════════════════ helpers ═══════════════════════ */

async function log(
  entity: string, entityId: string, action: string,
  before: unknown, after: unknown, reason = '', actor = 'elise@mermademarket.com',
) {
  await db.insert(auditLog).values({
    id: randomUUID(), entity, entityId, action, actor,
    before: before ? JSON.stringify(before) : null,
    after: after ? JSON.stringify(after) : null,
    reason,
  })
}

/**
 * The prototype writes mail to a table instead of sending it, so you can read
 * exactly what a vendor would receive at /admin/outbox. Swap for Resend +
 * React Email at the same call site — nothing else changes.
 */
/**
 * Every message is recorded in the outbox (the audit trail behind
 * /admin/outbox), then delivered through Resend when RESEND_API_KEY is set.
 * Without the key nothing is sent and the row says 'logged', which is the
 * prototype behavior. A delivery failure never fails the caller's action:
 * the application is already saved, and the row records what happened.
 */
async function mail(
  toEmail: string, subject: string, body: string, template: string, replyTo?: string,
) {
  const id = randomUUID()
  await db.insert(emailOutbox).values({ id, toEmail, subject, body, template })

  const key = process.env.RESEND_API_KEY
  if (!key) return

  let status = 'sent'
  let detail = ''
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'Mermade Market <onboarding@resend.dev>',
        to: [toEmail],
        subject,
        text: body,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })
    if (!res.ok) {
      status = 'failed'
      detail = `HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`
    }
  } catch (err) {
    status = 'failed'
    detail = err instanceof Error ? err.message : String(err)
  }
  await db.update(emailOutbox)
    .set({ deliveryStatus: status, deliveryDetail: detail })
    .where(eq(emailOutbox.id, id))
  if (status === 'failed') console.error(`[mail] delivery failed for ${template}: ${detail}`)
}

export type FormState = {
  ok: boolean
  errors?: Record<string, string>
  message?: string
  /** Echoed back on failure so a rejected submit never wipes the form. */
  values?: Record<string, string>
  /** Increments per submission. The client keys the <form> on it so the
   *  uncontrolled inputs remount and pick up the echoed values. */
  attempt?: number
}

/* ═══════════════════════ newsletter ═══════════════════════ */

export async function subscribe(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  const parsed = z.string().email().safeParse(email)
  if (!parsed.success) return { ok: false, errors: { email: 'That doesn’t look like an email address.' } }

  try {
    await db.insert(subscribers).values({ id: randomUUID(), email, source: 'home' })
  } catch {
    // already subscribed — same success message, never leak list membership
  }
  return { ok: true, message: 'You’re on the list. We’ll write when the roster is set.' }
}

/* ═══════════════════════ contact ═══════════════════════ */

const MessageSchema = z.object({
  name: z.string().min(2, 'Required'),
  email: z.string().email('Enter a valid email address'),
  message: z.string().min(10, 'Tell us a little more').max(4000, '4000 characters max'),
  /** Which form it came from, so the subject line says so. */
  topic: z.string().optional(),
})

/**
 * The contact and collaborate forms. mermademarket.com runs a Shopify contact
 * form on both pages; this is the same three fields going to the same inbox.
 *
 * The message lands in the outbox table either way, so nothing is lost when
 * RESEND_API_KEY is unset or delivery fails, and Elise can read every enquiry
 * at /admin/outbox. Reply-to is the sender, so hitting reply works.
 */
export async function sendMessage(prev: FormState, fd: FormData): Promise<FormState> {
  const attempt = (prev.attempt ?? 0) + 1
  const raw = Object.fromEntries(fd.entries()) as Record<string, string>
  const parsed = MessageSchema.safeParse(raw)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const i of parsed.error.issues) errors[String(i.path[0])] = i.message
    return { ok: false, errors, values: raw, attempt, message: 'Have a look below.' }
  }
  const d = parsed.data
  const topic = d.topic === 'collaborate' ? 'Collaboration' : 'Contact form'

  await mail(
    process.env.CONTACT_TO ?? 'hello@mermademarket.com',
    `${topic}: ${d.name}`,
    `${d.name} <${d.email}>\n\n${d.message}`,
    'contact',
    d.email,
  )
  return {
    ok: true,
    message: 'Got it. Someone reads every one of these, usually within a day or two.',
  }
}

/* ═══════════════════════ application ═══════════════════════ */

const ApplicationSchema = z.object({
  shopName: z.string().min(2, 'Required'),
  contactName: z.string().min(2, 'Required'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().min(7, 'Required'),
  instagram: z.string().min(1, 'Required. It’s how we look at your work'),
  website: z.string().optional(),
  city: z.string().min(1, 'Required'),
  state: z.string().min(2, 'Required'),

  track: z.enum(['indoor', 'outdoor', 'both']),

  category: z.enum(CATEGORIES, { message: 'Choose a category' }),
  description: z.string().min(40, 'Tell us a little more (40 characters minimum)').max(600, '600 characters max'),
  priceLow: z.coerce.number().int().min(1, 'Required'),
  priceHigh: z.coerce.number().int().min(1, 'Required'),

  madeByYou: z.enum(['all', 'mostly_sourced_components', 'curate_resell']),
  usesAiArtwork: z.enum(['yes', 'no']),
  isMlm: z.enum(['yes', 'no']),

  sellerPermit: z.string().optional(),
  occasionalSeller: z.string().optional(),
  hasCoi: z.string().optional(),

  signedName: z.string().min(2, 'Type your name to sign'),
  agree: z.string().refine((v) => v === 'on', 'You must accept the vendor agreement'),
})
  .refine((d) => d.priceHigh >= d.priceLow, {
    message: 'High price must be at least the low price', path: ['priceHigh'],
  })
  // NOT blocking at application. See the note on the compliance gate below.
  //
  // Publication 111 says: "You may not rent space to sellers unless they give
  // you the written documentation described in this publication." Renting
  // space is the booth fee — not the application. Blocking an application on a
  // permit asks a maker to do paperwork before anyone has told them they're in,
  // and no comparable market does it (Renegade collects documents only after
  // acceptance; Patchwork tells vendors they need one and explicitly declines
  // to monitor it). Collect it here if they have it, require it before load-in.

export async function submitApplication(prev: FormState, fd: FormData): Promise<FormState> {
  const attempt = (prev.attempt ?? 0) + 1
  const show = await activeShow()
  if (!show) return { ok: false, attempt, message: 'No active show.' }

  if (applicationWindow(show.applicationsOpenAt, show.applicationsCloseAt) !== 'open') {
    return { ok: false, attempt, message: 'Applications are not open for this show.' }
  }

  const raw = Object.fromEntries(fd.entries())
  const strings = (o: Record<string, FormDataEntryValue>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)]))
  const parsed = ApplicationSchema.safeParse(raw)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? 'form')
      if (!errors[k]) errors[k] = issue.message
    }
    return { ok: false, attempt, errors, values: strings(raw), message: 'Some answers need another look.' }
  }
  const d = parsed.data

  // Every checked space, in display order. The first is the primary request:
  // it is what acceptance books; the rest are visible to the jury and staff.
  const requestedIds = fd.getAll('spaces').map(String).filter(Boolean)
  if (requestedIds.length === 0) {
    return {
      ok: false, attempt, values: strings(raw),
      errors: { spaces: 'Check at least one space' },
    }
  }
  const allSpaces = await db.query.spaceTypes.findMany({ where: eq(spaceTypes.showId, show.id) })
  const requested = requestedIds
    .map((id) => allSpaces.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
  if (requested.length !== requestedIds.length) {
    return {
      ok: false, attempt, values: strings(raw),
      errors: { spaces: 'One of those spaces is no longer offered' },
    }
  }
  const space = requested[0]!

  // Add-on requests. Validated against the catalog so a hand-built POST can't
  // invent an extra, but nothing is priced here: the money becomes real on
  // the booking, where the price is snapshotted (docs/03-DATA-MODEL.md §6).
  const offered = await activeAddOns(show.id)
  const requestedAddons = fd
    .getAll('addons')
    .map(String)
    .filter((code) => offered.some((a) => a.code === code))

  // Vendors persist across shows — find or create, never duplicate on email.
  const email = d.email.trim().toLowerCase()
  let vendor = await db.query.vendors.findFirst({ where: eq(vendors.email, email) })
  if (!vendor) {
    const id = randomUUID()
    await db.insert(vendors).values({
      id, shopName: d.shopName, contactName: d.contactName, email,
      phone: d.phone, website: d.website || null, instagram: d.instagram,
      city: d.city, state: d.state,
    })
    vendor = await db.query.vendors.findFirst({ where: eq(vendors.id, id) })!
  }

  // Just the id: this is an existence test, and selecting the whole row would
  // also select columns a database behind the code may not have yet.
  const [existing] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.showId, show.id), eq(applications.vendorId, vendor!.id)))
    .limit(1)
  if (existing) {
    return {
      ok: false, attempt, values: strings(raw),
      message: 'We already have an application from this email for this show.',
    }
  }

  const appId = randomUUID()
  const row = {
    id: appId, showId: show.id, vendorId: vendor!.id,
    track: d.track, spaceTypeId: space.id,
    requestedSpaceIds: JSON.stringify(requestedIds),
    category: d.category, description: d.description,
    priceLowCents: d.priceLow * 100, priceHighCents: d.priceHigh * 100,
    madeByYou: d.madeByYou,
    usesAiArtwork: d.usesAiArtwork === 'yes',
    isMlm: d.isMlm === 'yes',
    sellerPermit: d.sellerPermit?.trim() ?? '',
    occasionalSeller: d.occasionalSeller === 'on',
    hasCoi: d.hasCoi === 'on',
    status: 'new',
    signedName: d.signedName,
    termsVersion: '2026.1',
  }

  // A maker's application must never be lost to a database that is one
  // migration behind the deploy. Save it either way; the add-on requests are
  // the only thing a pre-0002 database cannot hold.
  //
  // The fallback is written out by hand because Drizzle puts a column's
  // declared default into the INSERT when the field is omitted, so dropping
  // the key from the object is not enough to keep the column out of the
  // statement.
  try {
    await db.insert(applications).values({
      ...row, requestedAddons: JSON.stringify(requestedAddons),
    })
  } catch (err) {
    if (pgCode(err) !== '42703') throw err
    console.warn('[db] applications predates migration 0002; add-on requests not saved')
    await db.execute(sql`
      insert into applications (
        id, show_id, vendor_id, track, space_type_id, requested_space_ids,
        category, description, price_low_cents, price_high_cents, made_by_you,
        uses_ai_artwork, is_mlm, seller_permit, occasional_seller, has_coi,
        status, signed_name, terms_version
      ) values (
        ${row.id}, ${row.showId}, ${row.vendorId}, ${row.track}, ${row.spaceTypeId},
        ${row.requestedSpaceIds}, ${row.category}, ${row.description},
        ${row.priceLowCents}, ${row.priceHighCents}, ${row.madeByYou},
        ${row.usesAiArtwork}, ${row.isMlm}, ${row.sellerPermit},
        ${row.occasionalSeller}, ${row.hasCoi}, ${row.status},
        ${row.signedName}, ${row.termsVersion}
      )`)
  }

  await log('application', appId, 'submitted', null, { status: 'new' }, '', email)

  // Honest expectation, from the Show record — never a hardcoded date.
  await mail(
    email,
    `We have your ${show.name} application`,
    `Your ${show.name} application is in.\n\n`
      + `Shop: ${d.shopName}\nCategory: ${d.category}\n`
      + `Space${requested.length > 1 ? 's' : ''}: ${requested.map((s) => `${s.label} ${usd(s.priceCents)}`).join(' · ')}\n\n`
      + `We read every application and answer either way. The roster is announced `
      + `${fmtDate(show.rosterAnnouncedOn)}.\n\n— Mermade Market`,
    'application_received',
  )

  revalidatePath('/admin/jury')
  return { ok: true, attempt, message: 'submitted' }
}

/* ═══════════════════════ jury ═══════════════════════ */

/**
 * Accepting creates the Booking and snapshots commission_bps (CLAUDE.md rule 6).
 * Vendor codes are assigned here, sequentially per show, and are what the
 * register reads: MM07 + a price is the whole of the money model.
 */
export async function decide(fd: FormData): Promise<void> {
  const appId = String(fd.get('applicationId'))
  const next = String(fd.get('status')) as ApplicationStatus
  const reason = String(fd.get('reason') ?? '')

  const app = await db.query.applications.findFirst({ where: eq(applications.id, appId) })
  if (!app) return
  const show = await db.query.shows.findFirst({ where: eq(shows.id, app.showId) })
  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.id, app.vendorId) })
  if (!show || !vendor) return

  const before = { status: app.status }

  await db.update(applications).set({
    status: next,
    declineReason: next === 'declined' ? reason : null,
    decidedAt: ['accepted', 'declined', 'waitlist'].includes(next)
      ? new Date().toISOString() : null,
    decidedBy: 'elise@mermademarket.com',
  }).where(eq(applications.id, appId))

  await log('application', appId, 'status_change', before, { status: next }, reason)

  if (next === 'accepted') {
    const already = await db.query.bookings.findFirst({
      where: eq(bookings.applicationId, appId),
    })
    if (!already && app.spaceTypeId) {
      const space = await db.query.spaceTypes.findFirst({ where: eq(spaceTypes.id, app.spaceTypeId) })
      if (space) {
        // Sequential per-show vendor code. Reused across shows if the vendor has one.
        const [{ n }] = await db
          .select({ n: sql<number>`count(*)` })
          .from(bookings)
          .where(eq(bookings.showId, show.id))
        const code = vendor.vendorCode ?? `MM${String(n + 1).padStart(2, '0')}`
        if (!vendor.vendorCode) {
          await db.update(vendors).set({ vendorCode: code }).where(eq(vendors.id, vendor.id))
        }

        const due = new Date(Date.now() + show.paymentWindowHours * 3600_000).toISOString()
        const bookingId = randomUUID()
        await db.insert(bookings).values({
          id: bookingId, showId: show.id, vendorId: vendor.id, applicationId: appId,
          spaceTypeId: space.id, vendorCode: code,
          priceCents: space.priceCents,
          commissionBps: show.commissionBps,   // immutable snapshot
          status: 'awaiting_payment', paymentDueAt: due,
        })
        await log('booking', bookingId, 'created', null,
          { priceCents: space.priceCents, commissionBps: show.commissionBps, code })

        await mail(
          vendor.email,
          `You’re in: ${show.name}`,
          `${vendor.contactName}, you’re in.\n\n`
            + `${show.name} · ${fmtRange(show.startsOn, show.endsOn)} · ${show.venueName}\n`
            + `Your vendor code is ${code}. Tag every item ${code} plus the price. That's all the register needs.\n\n`
            + `Space: ${space.label}\nBooth fee: ${usd(space.priceCents)}\n`
            + `${app.track === 'indoor' ? `Commission: ${show.commissionBps / 100}% on indoor sales\n` : ''}`
            + `\nPay to confirm within ${show.paymentWindowHours} hours. After that the space returns to the pool.\n\n— Mermade Market`,
          'accepted',
        )
      }
    }
  }

  if (next === 'declined') {
    await mail(
      vendor.email,
      `Your ${show.name} application`,
      `${vendor.contactName}, thank you for applying to ${show.name}.\n\n`
        + `We're not able to offer you a space this season.\n\n`
        + (reason ? `${reason}\n\n` : '')
        + `We only take one to three makers per category and had far more strong applications than spaces. `
        + `Please apply again next season.\n\n— Mermade Market`,
      'declined',
    )
  }

  if (next === 'waitlist') {
    await mail(
      vendor.email,
      `Waitlisted for ${show.name}`,
      `${vendor.contactName}, you're on the waitlist for ${show.name}.\n\n`
        + `Spaces open up when accepted vendors don't pay in time, and we offer them in order. `
        + `We'll email either way by ${fmtDate(show.rosterAnnouncedOn)}.\n\n— Mermade Market`,
      'waitlisted',
    )
  }

  revalidatePath('/admin/jury')
  revalidatePath('/admin/roster')
  revalidatePath(`/admin/applications/${appId}`)
  revalidatePath('/')
}

/** Simulates the vendor paying the booth fee in the portal. */
export async function markPaid(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId'))
  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
  if (!b || b.status !== 'awaiting_payment') return

  await db.update(bookings)
    .set({ status: 'confirmed', paidAt: new Date().toISOString() })
    .where(eq(bookings.id, bookingId))
  await db.update(vendors)
    .set({ showsAttended: sql`${vendors.showsAttended} + 1` })
    .where(eq(vendors.id, b.vendorId))

  await log('booking', bookingId, 'paid',
    { status: 'awaiting_payment' }, { status: 'confirmed' }, 'booth fee received')

  revalidatePath('/admin/roster')
  revalidatePath('/')
}

/** Saves jury scores without changing status. */
export async function saveScores(fd: FormData): Promise<void> {
  const appId = String(fd.get('applicationId'))
  const n = (k: string) => {
    const v = fd.get(k)
    return v === null || v === '' ? null : Number(v)
  }
  await db.update(applications).set({
    scoreQuality: n('scoreQuality'),
    scoreOriginality: n('scoreOriginality'),
    scoreBrand: n('scoreBrand'),
    scoreFit: n('scoreFit'),
    juryNotes: String(fd.get('juryNotes') ?? ''),
  }).where(eq(applications.id, appId))
  revalidatePath('/admin/jury')
  revalidatePath(`/admin/applications/${appId}`)
}

/* ═══════════════════════ show settings ═══════════════════════ */

const ShowSettingsSchema = z.object({
  venueName: z.string().min(2, 'Required'),
  venueAddress: z.string().min(5, 'Required'),
  hoursNote: z.string().min(1, 'Required'),
  loadInNote: z.string().max(200, 'Keep it to a line').default(''),
  takedownNote: z.string().max(200, 'Keep it to a line').default(''),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Required'),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Required'),
  applicationsOpenAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Required'),
  applicationsCloseAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Required'),
  rosterAnnouncedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Required'),
  commissionPct: z.coerce.number().min(0, 'Not negative').max(50, 'That is over half'),
  paymentWindowHours: z.coerce.number().int('Whole hours').min(1).max(240, 'Ten days at most'),
  indoorCapacity: z.coerce.number().int().min(0),
  outdoorCapacity: z.coerce.number().int().min(0),
})
  .refine((d) => d.endsOn >= d.startsOn, { message: 'The show cannot end before it starts', path: ['endsOn'] })
  .refine((d) => d.applicationsCloseAt > d.applicationsOpenAt, {
    message: 'Applications cannot close before they open', path: ['applicationsCloseAt'],
  })

/**
 * Edits the active Show record: the single source for every date, price, and
 * rate the site renders (CLAUDE.md rule 6). Inputs are Pacific wall times;
 * storage carries the explicit PT offset (rule 8). Changes are audit-logged
 * (rule 3); commission edits never touch existing bookings, whose
 * commission_bps is snapshotted and immutable.
 */
export async function updateShow(prev: FormState, fd: FormData): Promise<FormState> {
  const attempt = (prev.attempt ?? 0) + 1
  const show = await activeShow()
  if (!show) return { ok: false, attempt, message: 'No active show.' }

  const raw = Object.fromEntries(fd.entries())
  const values = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)]))
  const parsed = ShowSettingsSchema.safeParse(raw)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message
    return { ok: false, attempt, errors, values }
  }
  const d = parsed.data

  const next = {
    venueName: d.venueName,
    venueAddress: d.venueAddress,
    hoursNote: d.hoursNote,
    loadInNote: d.loadInNote,
    takedownNote: d.takedownNote,
    startsOn: laWallToIso(d.startsOn),
    endsOn: laWallToIso(d.endsOn),
    applicationsOpenAt: laWallToIso(d.applicationsOpenAt),
    applicationsCloseAt: laWallToIso(d.applicationsCloseAt),
    rosterAnnouncedOn: laWallToIso(d.rosterAnnouncedOn),
    commissionBps: Math.round(d.commissionPct * 100),
    paymentWindowHours: d.paymentWindowHours,
    indoorCapacity: d.indoorCapacity,
    outdoorCapacity: d.outdoorCapacity,
  }

  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  for (const k of Object.keys(next) as Array<keyof typeof next>) {
    if (show[k] !== next[k]) { before[k] = show[k]; after[k] = next[k] }
  }
  if (Object.keys(after).length === 0) {
    return { ok: true, attempt, message: 'Nothing changed.' }
  }

  await db.update(shows).set(next).where(eq(shows.id, show.id))
  await log('show', show.id, 'settings_change', before, after, '', 'staff')

  revalidatePath('/')
  revalidatePath('/apply')
  revalidatePath('/admin/show')
  revalidatePath('/makers/indoor')
  revalidatePath('/makers/outdoor')
  revalidatePath('/schedule')
  return { ok: true, attempt, message: 'Saved.' }
}

/**
 * Edits one space type: label, description, price, capacity. Codes and
 * tracks are fixed identities. Price edits affect future quotes only;
 * accepted bookings carry their snapshotted price (CLAUDE.md rule 6).
 */
export async function updateSpace(fd: FormData): Promise<void> {
  const id = String(fd.get('id'))
  const space = await db.query.spaceTypes.findFirst({ where: eq(spaceTypes.id, id) })
  if (!space) return

  const priceDollars = Number(fd.get('price'))
  const capacity = Number(fd.get('capacity'))
  const label = String(fd.get('label') ?? '').trim()
  const description = String(fd.get('description') ?? '').trim()
  if (!label || !Number.isFinite(priceDollars) || priceDollars < 0
    || !Number.isInteger(capacity) || capacity < 0) return

  const next = {
    label,
    description,
    priceCents: Math.round(priceDollars * 100),
    capacity,
  }
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  for (const k of Object.keys(next) as Array<keyof typeof next>) {
    if (space[k] !== next[k]) { before[k] = space[k]; after[k] = next[k] }
  }
  if (Object.keys(after).length === 0) return

  await db.update(spaceTypes).set(next).where(eq(spaceTypes.id, id))
  await log('space_type', id, 'settings_change', before, after, '', 'staff')
  revalidatePath('/admin/show')
  revalidatePath('/apply')
  revalidatePath('/')
  revalidatePath('/makers/indoor')
  revalidatePath('/makers/outdoor')
}
