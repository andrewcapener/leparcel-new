'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { eq, and, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import {
  shows, vendors, applications, bookings, spaceTypes, auditLog,
  emailOutbox, subscribers, CATEGORIES, type ApplicationStatus,
} from '@/db/schema'
import { applicationWindow, fmtDate, fmtRange } from '@/lib/dates'
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
async function mail(toEmail: string, subject: string, body: string, template: string) {
  await db.insert(emailOutbox).values({ id: randomUUID(), toEmail, subject, body, template })
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
  spaceTypeId: z.string().min(1, 'Choose a space'),

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
  const show = await db.query.shows.findFirst({ where: eq(shows.isActive, true) })
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

  const space = await db.query.spaceTypes.findFirst({ where: eq(spaceTypes.id, d.spaceTypeId) })
  if (!space) {
    return {
      ok: false, attempt, values: strings(raw),
      errors: { spaceTypeId: 'That space is no longer offered' },
    }
  }

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

  const existing = await db.query.applications.findFirst({
    where: and(eq(applications.showId, show.id), eq(applications.vendorId, vendor!.id)),
  })
  if (existing) {
    return {
      ok: false, attempt, values: strings(raw),
      message: 'We already have an application from this email for this show.',
    }
  }

  const appId = randomUUID()
  await db.insert(applications).values({
    id: appId, showId: show.id, vendorId: vendor!.id,
    track: d.track, spaceTypeId: d.spaceTypeId,
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
  })

  await log('application', appId, 'submitted', null, { status: 'new' }, '', email)

  // Honest expectation, from the Show record — never a hardcoded date.
  await mail(
    email,
    `We have your ${show.name} application`,
    `Your ${show.name} application is in.\n\n`
      + `Shop: ${d.shopName}\nCategory: ${d.category}\n`
      + `Space: ${space.label} · ${usd(space.priceCents)}\n\n`
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
}
