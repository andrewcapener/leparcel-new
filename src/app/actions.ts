'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { eq, and, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { activeShow, activeAddOns, activeSpaceTypes, pgCode } from '@/db/queries'
import {
  shows, vendors, applications, bookings, bookingAddons, spaceTypes, addOns,
  auditLog, emailOutbox, subscribers, CATEGORIES, type ApplicationStatus,
} from '@/db/schema'
import { applicationWindow, fmtDate, fmtRange, laWallToIso } from '@/lib/dates'
import { usd } from '@/lib/money'
import { plainDashes } from '@/lib/dashes'
import { syncApplication } from '@/server/modules/sheets/sync'
import { gatherRow } from '@/server/modules/sheets/gather'
import { SHEET_HEADERS, sheetValues } from '@/server/modules/sheets/row'
import { staffNoticeHtml } from '@/server/modules/email/staff-notice'
import { applicationReceivedHtml } from '@/server/modules/email/application-received'
import { CONTACT_EMAIL } from '@/lib/agreement'
import { parsePhotoKeys } from '@/server/modules/uploads/photos'
import { photoUploadsEnabled } from '@/server/modules/uploads/config'
import { siteUrl } from '@/lib/site-url'
import { signInLinkHtml, signInLinkText } from '@/server/modules/email/sign-in-link'
import {
  LINK_TTL_MS, makerAuthConfigured, normalizeEmail, signLinkToken,
} from '@/lib/makerAuth'
import { publicPhotoUrl, verifyPhotoKeys } from '@/server/modules/uploads/storage'

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
/**
 * Who mail comes from when EMAIL_FROM is not set.
 *
 * This used to fall back to Resend's onboarding sandbox, which only ever
 * delivers to the Resend account owner: every acceptance and every contact
 * reply would have gone nowhere and looked sent. The real address is the one
 * makers already write to, so it is the default rather than a variable
 * somebody has to remember. Resend still has to have mermademarket.com
 * verified for it to leave the building; /api/health says whether it does.
 */
const DEFAULT_EMAIL_FROM = 'Mermade Market <hello@mermademarket.com>'

async function mail(
  toEmail: string, subject: string, body: string, template: string, replyTo?: string,
  html?: string,
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
        from: process.env.EMAIL_FROM ?? DEFAULT_EMAIL_FROM,
        to: [toEmail],
        subject,
        // Both parts, always. The text one is what arrives when a client
        // refuses HTML, what a screen reader reads happily, and what the
        // outbox stores. The HTML one is what the team opens.
        text: body,
        ...(html ? { html } : {}),
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
  // One form, two places. The footer's line is about the show; the apply
  // page's is about the application window opening. The confirmation has to
  // be true in both, so it promises neither specifically.
  return { ok: true, message: 'You’re on the list. We’ll write when there’s news.' }
}

/* ═══════════════════════ contact ═══════════════════════ */

const MessageSchema = z.object({
  name: z.string().min(2, 'Required'),
  email: z.string().email('Enter a valid email address').max(200, 'That address is too long'),
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

/* ═══════════════════════ maker sign-in ═══════════════════════ */

const SignInSchema = z.object({ email: z.string().email('Enter the email you applied with') })

/**
 * Email a maker a link that signs them in.
 *
 * The reply is the same sentence whether or not the address is one of ours.
 * A sign-in form that says "no account with that email" is a form that will
 * tell anyone who asks which of a hundred makers applied, and the roster is
 * not public until the roster is public. So: we always say we have sent it,
 * and we only actually send when there is a maker to send to.
 */
export async function requestSignInLink(prev: FormState, fd: FormData): Promise<FormState> {
  const attempt = (prev.attempt ?? 0) + 1
  const raw = Object.fromEntries(fd.entries()) as Record<string, string>
  const parsed = SignInSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false, attempt, values: raw,
      errors: { email: parsed.error.issues[0]?.message ?? 'Enter a valid email address' },
    }
  }

  const said = {
    ok: true as const,
    message: 'Check your email. If that address has applied to a Mermade show, a link is on its way.',
  }
  if (!makerAuthConfigured()) return said

  const email = normalizeEmail(parsed.data.email)
  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.email, email) })
  if (!vendor) return said

  const url = `${siteUrl()}/account/enter?token=${encodeURIComponent(await signLinkToken(email))}`
  const minutes = Math.round(LINK_TTL_MS / 60_000)
  await mail(
    email,
    'Your Mermade sign-in link',
    signInLinkText({ url, minutes }),
    'maker_sign_in',
    undefined,
    signInLinkHtml({ url, shopName: vendor.shopName, minutes }),
  )
  return said
}

/* ═══════════════════════ application ═══════════════════════ */

const ApplicationSchema = z.object({
  shopName: z.string().min(2, 'Required').max(120, 'Keep it under 120 characters'),
  contactName: z.string().min(2, 'Required').max(120, 'Keep it under 120 characters'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().min(7, 'Required').max(40, 'Keep it under 40 characters'),
  instagram: z.string().min(1, 'Required. It’s how we look at your work').max(60, 'Keep it under 60 characters'),
  website: z.string().max(300, 'That address is too long').optional(),
  city: z.string().min(1, 'Required').max(80, 'Keep it under 80 characters'),
  state: z.string().min(2, 'Required').max(40, 'Keep it under 40 characters'),

  track: z.enum(['indoor', 'outdoor', 'both']),

  category: z.enum(CATEGORIES, { message: 'Choose a category' }),
  description: z.string().min(40, 'Tell us a little more (40 characters minimum)').max(600, '600 characters max'),
  // Whole dollars. Without the explicit messages a maker who typed 12.50 got
  // "Expected integer, received float", which is Zod talking to a developer.
  priceLow: z.coerce.number({ message: 'Whole dollars, no cents' })
    .int('Whole dollars, no cents').min(1, 'Required'),
  priceHigh: z.coerce.number({ message: 'Whole dollars, no cents' })
    .int('Whole dollars, no cents').min(1, 'Required'),

  madeByYou: z.enum(['all', 'mostly_sourced_components', 'curate_resell']),
  usesAiArtwork: z.enum(['yes', 'no']),
  isMlm: z.enum(['yes', 'no']),

  permitStatus: z.enum(['have', 'occasional', 'unsure']).optional().or(z.literal('')),
  sellerPermit: z.string().optional(),
  occasionalSeller: z.string().optional(),
  hasCoi: z.string().optional(),

  signedName: z.string().min(2, 'Type your name to sign').max(120, 'Keep it under 120 characters'),
  // An unchecked checkbox posts no key, so the type error fired before the
  // refine could and the maker was told "Vendor agreement: Required".
  agree: z.string({ message: 'You must accept the vendor agreement' })
    .refine((v) => v === 'on', 'You must accept the vendor agreement'),
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
  // Active only, and the error below is already worded for it. This validated
  // against every space the show has ever had, so a withdrawn one could still
  // be submitted by anyone who kept the page open or built the POST by hand.
  const allSpaces = await activeSpaceTypes(show.id)
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
  // Set-up slots, indoor only. Checked against what the Show record actually
  // offers, so a hand-made POST cannot store a slot that does not exist.
  const offeredSlots = (show.loadInSlots ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  const loadInSlots = fd.getAll('loadInSlots')
    .map(String)
    .filter((v) => offeredSlots.includes(v))

  const requestedAddons = fd
    .getAll('addons')
    .map(String)
    .filter((code) => offered.some((a) => a.code === code))

  // Vendors persist across shows — find or create, never duplicate on email.
  //
  // And then UPDATE. Mermade runs two shows a year, so a large share of any
  // season's applicants are returning makers, and the form asks them for their
  // shop name, contact, phone, Instagram, website, city and state every time.
  // Without this branch every one of those answers was read, validated, shown
  // back to them on the review step, and then silently dropped on the floor,
  // because the vendor row already existed. A maker who had renamed the shop,
  // moved, or changed a handle was juried on last season's record while their
  // screen said "Thank you for applying". The application is the most recent
  // thing they have told us; it wins.
  const email = d.email.trim().toLowerCase()
  const details = {
    shopName: d.shopName, contactName: d.contactName,
    phone: d.phone, website: d.website || null, instagram: d.instagram,
    city: d.city, state: d.state,
  }
  let vendor = await db.query.vendors.findFirst({ where: eq(vendors.email, email) })
  if (!vendor) {
    const id = randomUUID()
    await db.insert(vendors).values({ id, email, ...details })
    vendor = await db.query.vendors.findFirst({ where: eq(vendors.id, id) })!
  } else {
    const before = {
      shopName: vendor.shopName, contactName: vendor.contactName,
      phone: vendor.phone, website: vendor.website, instagram: vendor.instagram,
      city: vendor.city, state: vendor.state,
    }
    const changed = Object.entries(details)
      .filter(([k, v]) => before[k as keyof typeof before] !== v)
      .map(([k]) => k)
    if (changed.length > 0) {
      await db.update(vendors).set(details).where(eq(vendors.id, vendor.id))
      // Audit-logged because it is a mutation of a record the jury and every
      // export read from, made by a form rather than by a person in the admin.
      await log(
        'vendor', vendor.id, 'vendor.updated_by_application',
        before, details, `changed on application: ${changed.join(', ')}`, email,
      )
      vendor = { ...vendor, ...details }
    }
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
      message: 'We already have an application from this email for this show. If that was you just now, it is in and there is nothing else to do.',
    }
  }

  /* ── the photograph ───────────────────────────────────────────────────
   *
   * Optional, and one. The application has to be as easy as it can be, so
   * nothing here can refuse a submission: Instagram and Website are required
   * fields on this form and are how the jury has always looked at a maker's
   * work, and a photograph is a shortcut, not the only signal.
   *
   * The browser has already put the bytes in Supabase Storage through a
   * signed URL. What arrives here is a storage key, and it is not believed:
   *
   *   1. parsePhotoKeys drops anything that is not a key this application
   *      could have minted, so a hand-built POST cannot walk out of the
   *      prefix or point at another bucket.
   *   2. verifyPhotoKeys reads the first bytes of the object out of the
   *      bucket and decides what it really is. The content type the client
   *      declared at upload is a claim; the magic bytes are the fact.
   *
   * A key that fails either check is dropped rather than turned into a reason
   * to refuse the application. The drop is on the audit row, which is where
   * an unexplained missing image gets explained.
   *
   * With no storage configured (local development) there is nothing to
   * collect. The field says so and the application is otherwise unaffected.
   */
  const uploadsOn = photoUploadsEnabled()
  let photoUrls: string[] = []
  let droppedPhotos: string[] = []
  if (uploadsOn) {
    const keys = parsePhotoKeys(String(fd.get('photos') ?? ''))
    if (keys.length > 0) {
      const checked = await verifyPhotoKeys(keys)
      droppedPhotos = checked.bad.map((b) => b.reason)
      photoUrls = checked.good
        .map((k) => publicPhotoUrl(k))
        .filter((u): u is string => Boolean(u))
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
    // Only meaningful for someone selling outside, and null rather than
    // empty so a report can tell "indoor, not asked" from "asked, skipped".
    permitStatus: d.track === 'indoor' || !d.permitStatus ? null : d.permitStatus,
    sellerPermit: d.sellerPermit?.trim() ?? '',
    occasionalSeller: d.occasionalSeller === 'on',
    hasCoi: d.hasCoi === 'on',
    // The public URLs, in the maker's order, first one leading. The jury card
    // and the review screen put these straight into an <img src>, so this
    // column holds a URL and not a key (src/server/modules/uploads/config.ts
    // has the public-bucket reasoning).
    photos: JSON.stringify(photoUrls),
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
      loadInSlots: JSON.stringify(row.track === 'outdoor' ? [] : loadInSlots),
      wantsOnboardingCall: fd.get('wantsOnboardingCall') === '1',
    })
  } catch (err) {
    if (pgCode(err) !== '42703') throw err
    console.warn('[db] applications predates migration 0002; add-on requests not saved')
    await db.execute(sql`
      insert into applications (
        id, show_id, vendor_id, track, space_type_id, requested_space_ids,
        category, description, price_low_cents, price_high_cents, made_by_you,
        uses_ai_artwork, is_mlm, seller_permit, occasional_seller, has_coi,
        photos, status, signed_name, terms_version
      ) values (
        ${row.id}, ${row.showId}, ${row.vendorId}, ${row.track}, ${row.spaceTypeId},
        ${row.requestedSpaceIds}, ${row.category}, ${row.description},
        ${row.priceLowCents}, ${row.priceHighCents}, ${row.madeByYou},
        ${row.usesAiArtwork}, ${row.isMlm}, ${row.sellerPermit},
        ${row.occasionalSeller}, ${row.hasCoi}, ${row.photos}, ${row.status},
        ${row.signedName}, ${row.termsVersion}
      )`)
  }

  await log(
    'application', appId, 'submitted', null,
    // Counts and reasons, never a maker's filename and never a URL with
    // anything identifying in it. A dropped photograph is the one thing about
    // this row that somebody may have to explain later.
    {
      status: 'new',
      photos: photoUrls.length,
      ...(droppedPhotos.length > 0 ? { photosDropped: droppedPhotos } : {}),
    },
    '', email,
  )

  // Honest expectation, from the Show record — never a hardcoded date.
  const receiptFields = [
    { label: 'Shop', value: d.shopName, strong: true },
    { label: 'Category', value: d.category },
    { label: requested.length > 1 ? 'Spaces you asked for' : 'Space you asked for',
      value: requested.map((s) => `${s.label} ${usd(s.priceCents)}`).join(' · ') },
  ]
  await mail(
    email,
    `We have your ${show.name} application`,
    `Your ${show.name} application is in.\n\n`
      + receiptFields.map((f) => `${f.label}: ${f.value}`).join('\n')
      + `\n\nWe read every application and answer either way. The roster is announced `
      + `${fmtDate(show.rosterAnnouncedOn)}.\n\nMermade Market`,
    'application_received',
    undefined,
    applicationReceivedHtml({
      shopName: d.shopName,
      showName: show.name,
      fields: receiptFields,
      rosterDate: fmtDate(show.rosterAnnouncedOn),
      contactEmail: CONTACT_EMAIL,
    }),
  )

  // Mermade's own copy, and the third place this application now exists.
  await notifyStaff(appId, show.name)

  // The Google Sheet the team reads applications in. Last, after the row is
  // committed and after the maker has their confirmation, because it must
  // never delay either: it queues the application in sheet_syncs, tries once,
  // and returns. It cannot throw, a failure leaves the row pending for
  // `npx tsx scripts/sync-sheets.ts`, and with no Sheet configured it is a
  // silent no-op. src/server/modules/sheets/.
  await syncApplication(db, appId)

  revalidatePath('/admin/jury')
  return { ok: true, attempt, message: 'submitted' }
}

/**
 * Tell Mermade a maker applied, and carry the whole application in the body.
 *
 * Two jobs in one message. The first is that somebody knows: until now a
 * submission landed in the database, sent the maker a receipt, and told nobody
 * at Mermade at all.
 *
 * The second is durability. Drew asked for the application to exist in several
 * places so it can never be lost, and an email in an inbox is a genuinely
 * independent copy: different company, different storage, outside anything a
 * bad migration or a dropped table here can reach. So this sends every field
 * rather than a "you have a new application" ping, which means a row can be
 * reconstructed by hand from the message alone. It is the same field list the
 * Sheet uses, so there is one definition of what an application is.
 *
 * Reply-to is the maker, so answering the notification answers them.
 *
 * Never throws. The application is already committed by the time this runs,
 * and a mail failure must not turn a saved application into an error on screen.
 */
async function notifyStaff(applicationId: string, showName: string): Promise<void> {
  const to = process.env.STAFF_NOTIFY_TO?.trim()
    || process.env.CONTACT_TO?.trim()
    || 'hello@mermademarket.com'
  try {
    const row = await gatherRow(db, applicationId)
    if (!row) return
    const values = sheetValues(row)
    const pairs = SHEET_HEADERS.map((h, i) => ({ label: h, value: values[i] ?? '' }))
    const body = pairs.map((f) => `${f.label}: ${f.value}`).join('\n')

    // The same fields twice, deliberately. src/server/modules/email/ explains
    // why both parts go out and why the text one is the record.
    // The photographs are not on the sheet row (the Sheet does not want them),
    // so they are read here. Already verified at submit: parsePhotoKeys drops
    // anything outside our prefix and verifyPhotoKeys reads the bytes, so what
    // is stored is ours and is an image.
    const [withPhotos] = await db
      .select({ photos: applications.photos })
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1)
    let photos: string[] = []
    try {
      const parsed: unknown = JSON.parse(withPhotos?.photos || '[]')
      if (Array.isArray(parsed)) photos = parsed.filter((u): u is string => typeof u === 'string')
    } catch { photos = [] }

    const html = staffNoticeHtml({
      heading: row.shopName || 'A maker',
      sub: `${row.category || 'Uncategorised'} · ${row.track} · applied for ${showName}`,
      // The admin link is the button, so it does not also need to be a row.
      // The admin link is the button, so it does not also need to be a row.
      fields: pairs.filter((f) => f.label !== 'Open in admin'),
      cta: { href: row.adminLink, label: 'Open in admin' },
      photos,
    })

    await mail(
      to,
      `New application: ${row.shopName || 'a maker'} (${row.category || 'uncategorised'})`,
      `${row.shopName} applied for ${showName}.\n\n${body}\n\n`
        + `This message is also the backup copy. Every field is above.`,
      'application_staff_notice',
      row.email || undefined,
      html,
    )
  } catch {
    // Deliberately silent. The row is saved; this is the third copy, not the
    // first, and /admin/outbox shows what did and did not go out.
  }
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

        // The add-ons they asked for on the application. Requests until this
        // moment; from here they are money, so the price is SNAPSHOTTED onto
        // booking_addons the same way commission_bps is (docs/03-DATA-MODEL.md
        // §6). Repricing an add-on later never changes what this maker owes.
        //
        // A code that is no longer offered is dropped rather than guessed at,
        // and the drop is on the audit row so it is visible in review.
        let wanted: string[] = []
        try { wanted = JSON.parse(app.requestedAddons) } catch { /* pre-0002 row */ }
        const offered = wanted.length > 0 ? await activeAddOns(show.id) : []
        const granted = offered.filter(
          (a) => wanted.includes(a.code) && (a.track === null || a.track === app.track),
        )
        const dropped = wanted.filter((c) => !granted.some((a) => a.code === c))
        const addonsCents = granted.reduce((sum, a) => sum + a.priceCents, 0)

        const due = new Date(Date.now() + show.paymentWindowHours * 3600_000).toISOString()
        const bookingId = randomUUID()
        await db.insert(bookings).values({
          id: bookingId, showId: show.id, vendorId: vendor.id, applicationId: appId,
          spaceTypeId: space.id, vendorCode: code,
          priceCents: space.priceCents,
          addonsCents,
          commissionBps: show.commissionBps,   // immutable snapshot
          status: 'awaiting_payment', paymentDueAt: due,
        })
        for (const a of granted) {
          await db.insert(bookingAddons).values({
            id: randomUUID(), bookingId, addOnId: a.id, priceCents: a.priceCents,
          })
        }
        await log('booking', bookingId, 'created', null, {
          priceCents: space.priceCents,
          addonsCents,
          addons: granted.map((a) => ({ code: a.code, priceCents: a.priceCents })),
          droppedAddons: dropped,
          commissionBps: show.commissionBps,
          code,
        })

        await mail(
          vendor.email,
          `You’re in: ${show.name}`,
          `${vendor.contactName}, you’re in.\n\n`
            + `${show.name} · ${fmtRange(show.startsOn, show.endsOn)} · ${show.venueName}\n`
            + `Your vendor code is ${code}. Tag every item ${code} plus the price. That's all the register needs.\n\n`
            + `Space: ${space.label}\nBooth fee: ${usd(space.priceCents)}\n`
            + granted.map((a) => `${a.name}: ${usd(a.priceCents)}\n`).join('')
            + (granted.length > 0 ? `Total: ${usd(space.priceCents + addonsCents)}\n` : '')
            + `${app.track === 'indoor' ? `Commission: ${show.commissionBps / 100}% on indoor sales\n` : ''}`
            + `\nPay to confirm within ${show.paymentWindowHours} hours. After that the space returns to the pool.\n`
            // Outdoor makers sell for their own account, so the permit is ours
            // to collect and CDTFA Publication 111 fines us per seller we
            // cannot show a record for. The application no longer asks, so
            // this is where the ask lives. Indoor makers do not need one:
            // Mermade is the retailer of record for their sales (agreement 6.2).
            + (app.track === 'outdoor' || app.track === 'both'
              ? `\nOne more thing before load-in: reply with your California seller's permit number, `
                + `or tell us you qualify as an occasional seller and we will send you the CDTFA-410-D `
                + `to sign. You sell for your own account outside, so we have to hold that record.\n`
              : '')
            + `\nMermade Market`,
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
        + `Please apply again next season.\n\nMermade Market`,
      'declined',
    )
  }

  if (next === 'waitlist') {
    await mail(
      vendor.email,
      `Waitlisted for ${show.name}`,
      `${vendor.contactName}, you're on the waitlist for ${show.name}.\n\n`
        + `Spaces open up when accepted vendors don't pay in time, and we offer them in order. `
        + `We'll email either way by ${fmtDate(show.rosterAnnouncedOn)}.\n\nMermade Market`,
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
  outdoorLoadInNote: z.string().max(200, 'Keep it to a line').default(''),
  takedownNote: z.string().max(200, 'Keep it to a line').default(''),
  loadInSlots: z.string().max(200, 'Keep it to a line').default(''),
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
    // Typed by a person at /admin/show, usually on a phone, and a phone turns
    // a typed hyphen into an en dash without being asked. docs/12-VOICE.md
    // wants none of those on the site, so they are cleaned on the way in
    // rather than left to somebody noticing.
    venueName: plainDashes(d.venueName),
    venueAddress: plainDashes(d.venueAddress),
    hoursNote: plainDashes(d.hoursNote),
    loadInNote: plainDashes(d.loadInNote),
    outdoorLoadInNote: plainDashes(d.outdoorLoadInNote),
    takedownNote: plainDashes(d.takedownNote),
    loadInSlots: plainDashes(d.loadInSlots),
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

/**
 * Edit an add-on's name, blurb and price from /admin/show.
 *
 * Same shape and same rules as updateSpace: the edit changes what a future
 * applicant is quoted, and never what an accepted maker was promised —
 * booking_addons snapshots the price at booking time (docs/03-DATA-MODEL.md
 * §6). The code and the track are fixed, because the application form and the
 * rules pages key off them.
 */
export async function updateAddOn(fd: FormData): Promise<void> {
  const id = String(fd.get('id'))
  const addOn = await db.query.addOns.findFirst({ where: eq(addOns.id, id) })
  if (!addOn) return

  const priceDollars = Number(fd.get('price'))
  const name = String(fd.get('name') ?? '').trim()
  const description = String(fd.get('description') ?? '').trim()
  const isLimited = fd.get('isLimited') === 'on'
  if (!name || !Number.isFinite(priceDollars) || priceDollars < 0) return

  const next = { name, description, priceCents: Math.round(priceDollars * 100), isLimited }
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  for (const k of Object.keys(next) as Array<keyof typeof next>) {
    if (addOn[k] !== next[k]) { before[k] = addOn[k]; after[k] = next[k] }
  }
  if (Object.keys(after).length === 0) return

  await db.update(addOns).set(next).where(eq(addOns.id, id))
  await log('add_on', id, 'settings_change', before, after, '', 'staff')
  revalidatePath('/admin/show')
  revalidatePath('/apply')
  revalidatePath('/makers/indoor')
  revalidatePath('/makers/outdoor')
}
