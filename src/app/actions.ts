'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { eq, and, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { activeShow, activeAddOns, activeSpaceTypes, forgetShowConfig, pgCode } from '@/db/queries'
import {
  shows, vendors, applications, bookings, bookingAddons, bookingCharges, spaceTypes, addOns,
  auditLog, emailOutbox, sheetSyncs, subscribers, CATEGORIES, type ApplicationStatus,
} from '@/db/schema'
import { applicationWindow, fmtDate, fmtDateTime, fmtRange, laWallToIso } from '@/lib/dates'
import { usd } from '@/lib/money'
import { plainDashes } from '@/lib/dashes'
import { syncApplication, sheetsConfigured } from '@/server/modules/sheets/sync'
import { queueMissing, unsentApplicationIds } from '@/server/modules/sheets/state'
import { gatherRow } from '@/server/modules/sheets/gather'
import { SHEET_HEADERS, sheetValues } from '@/server/modules/sheets/row'
import { staffNoticeHtml } from '@/server/modules/email/staff-notice'
import { applicationReceivedHtml } from '@/server/modules/email/application-received'
import { CONTACT_EMAIL } from '@/lib/agreement'
import { parsePhotoKeys } from '@/server/modules/uploads/photos'
import { photoUploadsEnabled } from '@/server/modules/uploads/config'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import { cleanAttribution } from '@/lib/attribution'
import { spaceAllowed } from '@/server/modules/spaces/eligibility'
import { previewingOpenWindow } from '@/lib/preview'
import { siteUrl } from '@/lib/site-url'
import { signInLinkHtml, signInLinkText } from '@/server/modules/email/sign-in-link'
import {
  LINK_TTL_MS, MAKER_COOKIE, makerAuthConfigured, normalizeEmail, signLinkToken,
  readSession as readMakerSession,
} from '@/lib/makerAuth'
import { publicPhotoUrl, verifyPhotoKeys } from '@/server/modules/uploads/storage'
import { pushSubscriber, dripConfig } from '@/server/modules/drip/client'
import { startBoothPayment, bookingByPayToken, dropLiveCheckout } from '@/server/modules/payments/booth'
import {
  ensureConnectAccount, onboardingLink, refreshAccount, owesPayoutSetup,
} from '@/server/modules/payments/connect'
import { slotOptions } from '@/server/modules/compliance/checklist'
import { boothFeeHtml, boothFeeText } from '@/server/modules/email/booth-fee'
import { isForfeitable } from '@/server/modules/payments/booking-status'
import { chargeProblem } from '@/server/modules/payments/ledger'
import { viaFromManual, viaLabel } from '@/server/modules/payments/paid-via'
import { pushPaymentTabsIfConnected } from '@/server/modules/roster/sheet-push'
import { paymentDueAt } from '@/server/modules/payments/deadline'
import {
  intakeAccepts, intakeMode, intakeStatus,
} from '@/server/modules/applications/intake'
import { sendLead, newEventId } from '@/server/modules/meta/capi'

/* ═══════════════════════ helpers ═══════════════════════ */

/**
 * Who did this.
 *
 * It used to be the string 'elise@mermademarket.com', hardcoded, for every
 * row: a placeholder from when one shared password meant there was no way to
 * know. There is now, so the audit log carries the name of whoever's password
 * signed the session. Anything with no staff session is the site acting on a
 * maker's behalf, which is what a submitted application is, and it says so
 * rather than borrowing somebody's name for it.
 */
async function actorNow(): Promise<string> {
  try {
    const jar = await cookies()
    const who = await staffForSession(jar.get(ADMIN_COOKIE)?.value)
    return who?.name ?? 'the site'
  } catch {
    // Outside a request scope. Never in production, but a script importing
    // this module should not crash on a cookie jar that is not there.
    return 'the site'
  }
}

async function log(
  entity: string, entityId: string, action: string,
  before: unknown, after: unknown, reason = '', actor?: string,
) {
  const by = actor ?? await actorNow()
  await db.insert(auditLog).values({
    id: randomUUID(), entity, entityId, action, actor: by,
    before: before ? JSON.stringify(before) : null,
    after: after ? JSON.stringify(after) : null,
    reason,
  })
}

/**
 * The prototype writes mail to a table instead of sending it, so you can read
 * exactly what a maker would receive at /admin/outbox. Swap for Resend +
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
  /** The Meta event id for a successful application, handed to the browser so
   *  the pixel's Lead and the server's Lead carry the SAME id and Meta counts
   *  one. Never set on a failure, and it identifies an event, not a person. */
  metaEventId?: string
}

/* ═══════════════════════ newsletter ═══════════════════════ */

export async function subscribe(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase()
  const parsed = z.string().email().safeParse(email)
  if (!parsed.success) return { ok: false, errors: { email: 'That doesn’t look like an email address.' } }

  /* Ours first, Drip second, and that order is the point. Drip is where the
     list is sent from today and Drew wants off it. If an address only ever
     landed in Drip, leaving would mean an export and a prayer; holding it
     here makes the migration a deleted function. */
  /* Allowlisted, not just length-capped. It becomes a column here and a
     custom field in Drip, and anything a form posts is a thing a stranger
     can choose. An unknown value is simply 'home' rather than an error:
     nobody's signup should fail over a label we use for our own segmenting. */
  const posted = String(fd.get('source') ?? '')
  const source = (['home', 'footer', 'apply', 'popup'] as const).includes(posted as never)
    ? posted
    : 'home'
  let id = ''
  try {
    id = randomUUID()
    await db.insert(subscribers).values({ id, email, source })
  } catch {
    // Already subscribed. Same success message either way: whether an address
    // is on the list is not something a form should confirm to a stranger.
    id = ''
  }

  /* Push to Drip, and RECORD the result. Nothing here throws and nothing here
     changes what the person is told: joining the list must not fail because
     Drip is down. The recording is the lesson from sheet_syncs, which failed
     silently from launch day because nothing wrote down that it had. */
  if (id && dripConfig()) {
    const r = await pushSubscriber(email, { source, tags: ['site-signup'] })
    await db.update(subscribers)
      .set(
        r.outcome === 'sent'
          ? { dripStatus: 'sent', dripError: '', dripSyncedAt: new Date().toISOString() }
          : r.outcome === 'failed'
            ? { dripStatus: 'failed', dripError: r.detail }
            : { dripStatus: 'skipped' },
      )
      .where(eq(subscribers.id, id))
      .catch(() => { /* the address is saved; bookkeeping is not worth a throw */ })
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

  /* Carried through the email so a maker who started on the payment page ends
     up back on it. Only ever the literal "payment"; see the enter route. */
  const next = String(fd.get('next') ?? '') === 'payment' ? '&next=payment' : ''
  const url = `${siteUrl()}/account/enter?token=${encodeURIComponent(await signLinkToken(email))}${next}`
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
  // Optional, and deliberately not format-checked: it exists so Elise can post
  // a flyer, and a maker outside the US has a postcode that is not five digits.
  postalCode: z.string().max(12, 'That does not look like a postal code').optional(),
  flyersWanted: z.enum(['', '25', '50']).optional(),

  track: z.enum(['indoor', 'outdoor', 'both'], { message: 'Choose inside, outside, or both' }),

  category: z.enum(CATEGORIES, { message: 'Choose a category' }),
  description: z.string().min(40, 'Tell us a little more (40 characters minimum)').max(600, '600 characters max'),
  // Whole dollars. Without the explicit messages a maker who typed 12.50 got
  // "Expected integer, received float", which is Zod talking to a developer.
  priceLow: z.coerce.number({ message: 'Whole dollars, no cents' })
    .int('Whole dollars, no cents').min(1, 'Required'),
  priceHigh: z.coerce.number({ message: 'Whole dollars, no cents' })
    .int('Whole dollars, no cents').min(1, 'Required'),

  // No default on either of these in the form, so a blank really is a blank
  // and the message has to read like a question, not a type error.
  madeByYou: z.enum(['all', 'mostly_sourced_components', 'curate_resell'], {
    message: 'Tell us how much of it you make',
  }),
  isMlm: z.enum(['yes', 'no'], { message: 'Answer yes or no' }),

  permitStatus: z.enum(['have', 'occasional', 'unsure']).optional().or(z.literal('')),
  sellerPermit: z.string().optional(),
  occasionalSeller: z.string().optional(),
  hasCoi: z.string().optional(),

  signedName: z.string().min(2, 'Type your name to sign').max(120, 'Keep it under 120 characters'),
  // An unchecked checkbox posts no key, so the type error fired before the
  // refine could and the maker was told "Maker agreement: Required".
  agree: z.string({ message: 'You must accept the maker agreement' })
    .refine((v) => v === 'on', 'You must accept the maker agreement'),
})
  .refine((d) => d.priceHigh >= d.priceLow, {
    message: 'High price must be at least the low price', path: ['priceHigh'],
  })
  /* Having a permit is not required to apply. Saying you have one and then
     not giving the number is, because that answer is worth nothing to us:
     it is the number that lets us meet Publication 111 before load-in, and
     chasing it later by email is the work this field exists to avoid. The
     other two answers, "occasional seller" and "not sure", stay free: they
     are honest positions and we handle them after acceptance. */
  .refine((d) => d.permitStatus !== 'have' || (d.sellerPermit ?? '').trim().length > 0, {
    message: 'Add your permit number, or change the answer above',
    path: ['sellerPermit'],
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

  /* The window, or a member of staff rehearsing.
   *
   * This used to be the window alone, deliberately: the launch preview put the
   * form on screen and the server still refused, so nothing could slip through
   * early. The cost was that the one path nobody could exercise before opening
   * day was the whole path, and a dress rehearsal that stops at the submit
   * button is not one.
   *
   * The preview cookie is not something a stranger can set. /api/preview
   * requires a valid /admin session before it will issue it, so this opens
   * submission to staff and to nobody else. A rehearsal application is a real
   * row on purpose, so that the emails, the Sheet and the jury queue are all
   * exercised too; delete it from the admin when you are done.
   */
  const staffRehearsal = await previewingOpenWindow()
  /* Three modes, not two. Once the window closes the form keeps taking
     entries as WAITLIST rows, because booth fees fall due on the 23rd and
     the spaces of whoever does not pay come back into the pool that week.
     Before a window opens there is still nothing to apply to. */
  const intake = intakeMode(
    applicationWindow(show.applicationsOpenAt, show.applicationsCloseAt), staffRehearsal,
  )
  if (!intakeAccepts(intake)) {
    return { ok: false, attempt, message: 'Applications are not open for this show.' }
  }
  const onWaitlist = intake === 'waitlist'

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
  /* In the order the maker ticked them, which a checkbox cannot tell us: a
     form posts its boxes in document order however they were clicked. The
     hidden spaceOrder field carries the ranking, and it is only ever used to
     SORT ids that were posted, never to add one, so a hand-built POST cannot
     smuggle a space in through it. An older cached page sends no order and
     falls back to document order, which is what it always did.

     This mattered on the first morning: an applicant ranked Saturday, Sunday,
     Friday and the form recorded Friday first, because Friday is listed
     first. She noticed. Nobody else would have. */
  const posted = fd.getAll('spaces').map(String).filter(Boolean)
  const ranking = String(fd.get('spaceOrder') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  const rankOf = (id: string) => {
    const i = ranking.indexOf(id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const requestedIds = ranking.length > 0
    ? [...posted].sort((a, b) => rankOf(a) - rankOf(b))
    : posted
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
  /* Elise's curation rules, enforced here as well as in the form. A disabled
     checkbox is a courtesy, not a control: this endpoint takes space ids and
     anybody can post whatever they like. */
  const barred = requested
    .map((sp) => ({ sp, verdict: spaceAllowed(sp.code, d.category) }))
    .find(({ verdict }) => !verdict.ok)
  if (barred && !barred.verdict.ok) {
    return {
      ok: false, attempt, values: strings(raw),
      errors: { spaces: `${barred.sp.label} is not open to ${d.category}. ${barred.verdict.reason}` },
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

  // Makers persist across shows — find or create, never duplicate on email.
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
  /* Where they came from. Re-cleaned here rather than trusted: the hidden
     field is posted by a browser and a posted value is a posted value.
     attributionFrom takes a query string, so the stored value is fed back
     through as one. */
  const attribution = cleanAttribution(String(fd.get('attribution') ?? ''))

  const email = d.email.trim().toLowerCase()
  const details = {
    shopName: d.shopName, contactName: d.contactName,
    phone: d.phone, website: d.website || null, instagram: d.instagram,
    city: d.city, state: d.state, postalCode: d.postalCode?.trim() ?? '',
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
      city: vendor.city, state: vendor.state, postalCode: vendor.postalCode,
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
      message: 'We already have an application from this email for this show. If that was you just now, we have it and there is nothing else to do.',
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
    attribution,
    track: d.track, spaceTypeId: space.id,
    requestedSpaceIds: JSON.stringify(requestedIds),
    category: d.category, description: d.description,
    priceLowCents: d.priceLow * 100, priceHighCents: d.priceHigh * 100,
    madeByYou: d.madeByYou,
    // The form stopped asking. The column keeps its default so the row
    // shape, the Sheet's columns and every existing row are untouched; see
    // the note in src/server/modules/sheets/row.ts.
    usesAiArtwork: false,
    flyersWanted: d.flyersWanted ?? '',
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
    status: intakeStatus(intake),
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
        photos, status, signed_name, terms_version, flyers_wanted
      ) values (
        ${row.id}, ${row.showId}, ${row.vendorId}, ${row.track}, ${row.spaceTypeId},
        ${row.requestedSpaceIds}, ${row.category}, ${row.description},
        ${row.priceLowCents}, ${row.priceHighCents}, ${row.madeByYou},
        ${row.usesAiArtwork}, ${row.isMlm}, ${row.sellerPermit},
        ${row.occasionalSeller}, ${row.hasCoi}, ${row.photos}, ${row.status},
        ${row.signedName}, ${row.termsVersion}, ${row.flyersWanted}
      )`)
  }

  await log(
    'application', appId, 'submitted', null,
    // Counts and reasons, never a maker's filename and never a URL with
    // anything identifying in it. A dropped photograph is the one thing about
    // this row that somebody may have to explain later.
    {
      status: intakeStatus(intake),
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
    onWaitlist
      ? `You are on the ${show.name} waiting list`
      : `We have your ${show.name} application`,
    onWaitlist
      /* The roster for this show is already set. The only honest thing to
         say is what would have to happen for a space to exist, and that we
         cannot say whether it will. The roster date belongs to people who
         applied before the window shut and naming it here would be naming
         somebody else's missed deadline. */
      ? `This is a receipt, not a decision. Applications for ${show.name} have closed and the `
        + `roster is set.\n\n`
        + receiptFields.map((f) => `${f.label}: ${f.value}`).join('\n')
        + `\n\nSpaces do come free, usually when an accepted maker does not pay their booth fee `
        + `in time. When one does we go to this list first, and we read every entry on it `
        + `ourselves. We cannot promise a space and we will not leave you wondering: if nothing `
        + `opens up, we will say so.\n\nMermade Market`
      : `This is a receipt, not a decision. Everyone who applies gets one.\n\n`
        + `We have your ${show.name} application. Nothing else is needed from you right now.\n\n`
        + receiptFields.map((f) => `${f.label}: ${f.value}`).join('\n')
        + `\n\nWe read every application ourselves and we answer either way, whether the answer `
        + `is yes or no. You will hear from us on ${fmtDate(show.rosterAnnouncedOn)}, when the `
        + `roster goes out.\n\nMermade Market`,
    onWaitlist ? 'waitlist_received' : 'application_received',
    undefined,
    applicationReceivedHtml({
      shopName: d.shopName,
      contactName: d.contactName,
      showName: show.name,
      fields: receiptFields,
      rosterDate: fmtDate(show.rosterAnnouncedOn),
      contactEmail: CONTACT_EMAIL,
      waitlist: onWaitlist,
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

  /* Tell Meta an application happened, from the server.
     The browser pixel fires PageView and nothing else, because the one
     conversion this business has is an application and a browser event for it
     is lost to an ad blocker, to Safari, and to anybody who closes the tab on
     the thank-you screen. An application Meta never hears about looks, to the
     algorithm, exactly like somebody who bounced.
     Inert until a pixel id and a CAPI token are configured, and it cannot
     throw: a marketing signal must never cost a maker their application. */
  /* Minted here rather than inside sendLead, because the browser needs the
     same value: the pixel fires Lead on the thank-you screen with this id and
     Meta keeps one of the two. Before this, the server event was the only
     Lead, so there was nothing to deduplicate and, more to the point, nothing
     a Custom Audience could exclude on. Retargeting people who opened the
     form and did NOT finish it needs a browser-side signal for the ones who
     did. */
  const metaEventId = newEventId()
  try {
    const h = await headers()
    const r = await sendLead({
      email,
      eventId: metaEventId,
      phone: d.phone || undefined,
      sourceUrl: `${siteUrl()}/apply`,
      /* Meta's own click and browser cookies, when the browser set them.
         Without fbc an ad click cannot be tied back to the ad that paid
         for it, which is most of the reason to do this at all. */
      fbp: (await cookies()).get('_fbp')?.value,
      fbc: (await cookies()).get('_fbc')?.value,
      clientIp: h.get('x-forwarded-for')?.split(',')[0]?.trim(),
      userAgent: h.get('user-agent') ?? undefined,
    })
    if (r.outcome === 'failed') console.error(`[meta] lead not sent: ${r.detail}`)
  } catch {
    // Never the reason a submission reports a failure.
  }

  revalidatePath('/admin/jury')
  return { ok: true, attempt, message: 'submitted', metaEventId }
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
/**
 * Who gets told about a new application.
 *
 * More than one person, since 7 Sep 2026: Drew asked for Hillary on it, and
 * she runs the outdoor half. STAFF_NOTIFY_TO takes a comma-separated list and
 * overrides the default entirely, so adding somebody is one variable and no
 * deploy of ours.
 *
 * One message each, rather than one message with several recipients. It costs
 * an extra send and buys three things worth more: each person can reply to the
 * maker without replying to the team, /admin/outbox shows plainly who was told
 * and who was not, and one bad address cannot take the whole notification down
 * with it.
 */
function staffNotifyList(): string[] {
  const raw = process.env.STAFF_NOTIFY_TO?.trim()
    || process.env.CONTACT_TO?.trim()
    || 'hello@mermademarket.com, hillary@mermademarket.com'
  const seen = new Set<string>()
  return raw
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter((a) => a.includes('@') && !seen.has(a) && seen.add(a))
}

async function notifyStaff(applicationId: string, showName: string): Promise<void> {
  const recipients = staffNotifyList()
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

    for (const to of recipients) {
      await mail(
        to,
        `New application: ${row.shopName || 'a maker'} (${row.category || 'uncategorised'})`,
        `${row.shopName} applied for ${showName}.\n\n${body}\n\n`
          + `This message is also the backup copy. Every field is above.`,
        'application_staff_notice',
        row.email || undefined,
        html,
      )
    }
  } catch {
    // Deliberately silent. The row is saved; this is the third copy, not the
    // first, and /admin/outbox shows what did and did not go out.
  }
}

/* ═══════════════════════ jury ═══════════════════════ */

/**
 * Accepting creates the Booking and snapshots commission_bps (CLAUDE.md rule 6).
 * Mermade IDs are assigned here, sequentially per show, and are what the
 * register reads: MM07 + a price is the whole of the money model.
 */
export async function decide(fd: FormData): Promise<void> {
  const appId = String(fd.get('applicationId'))
  const next = String(fd.get('status')) as ApplicationStatus
  const reason = String(fd.get('reason') ?? '')
  /* The space a person chose on the accept form. Until this existed, accepting
     booked whatever the maker ticked first on their own application, at that
     price, with no way to move somebody from a 3x8 to the 3x4 that is actually
     left. Empty means "whatever they asked for", which is the old behaviour. */
  const chosenSpaceId = String(fd.get('spaceTypeId') ?? '').trim()

  const app = await db.query.applications.findFirst({ where: eq(applications.id, appId) })
  if (!app) return
  const show = await db.query.shows.findFirst({ where: eq(shows.id, app.showId) })
  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.id, app.vendorId) })
  if (!show || !vendor) return

  const before = { status: app.status }

  /* Whether a decision mails the maker at all. Drew, 20 Sept 2026, relaying
     the team: "no automation yet on accepted/declined emails." Off by default
     and set on /admin/show, so staff write and send their own and the roster
     carries the payment link to paste into it.

     This gate covers only what the DASHBOARD triggers. The application receipt
     and the sign-in link are untouched: one answers a maker pressing Submit,
     the other answers a maker asking to sign in, and switching either off
     would break the portal the invoice lives on. */
  const mailsDecisions = show.decisionEmails === 'on'

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
    const bookSpaceId = chosenSpaceId || app.spaceTypeId
    /* Loud, not silent. The old code wrapped the whole booking in
       `if (app.spaceTypeId)`, so an application with no space marked the maker
       accepted, created no booking and sent nothing, and the only way to find
       out was a maker asking why they never got an invoice. */
    if (!already && !bookSpaceId) {
      throw new Error(
        'Pick a space before accepting: this application does not carry one, '
        + 'so there is nothing to bill.',
      )
    }
    if (!already && bookSpaceId) {
      const space = await db.query.spaceTypes.findFirst({ where: eq(spaceTypes.id, bookSpaceId) })
      if (!space) throw new Error('That space no longer exists. Pick another and try again.')
      {
        // Sequential per-show Mermade ID. Reused across shows if the maker has one.
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

        /* The later of the Show's fixed date and this maker's own window, so
           accepting eighty people over an evening gives them all the same
           deadline and the last one off the waitlist is still treated fairly.
           See payments/deadline.ts. */
        const due = paymentDueAt({
          fixedAt: show.paymentDueAt,
          windowHours: show.paymentWindowHours,
          acceptedAtIso: new Date().toISOString(),
        })
        const bookingId = randomUUID()
        const payToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
        await db.insert(bookings).values({
          id: bookingId, showId: show.id, vendorId: vendor.id, applicationId: appId,
          spaceTypeId: space.id, vendorCode: code,
          priceCents: space.priceCents,
          addonsCents,
          commissionBps: show.commissionBps,   // immutable snapshot
          status: 'awaiting_payment', paymentDueAt: due,
          /* The link staff paste into their own email, and the one the fee
             email carries. Minted here so it exists the moment the booking
             does: a roster row with an Accept but no link to copy would send
             somebody back to the database. */
          payToken,
        })
        for (const a of granted) {
          await db.insert(bookingAddons).values({
            id: randomUUID(), bookingId, addOnId: a.id, priceCents: a.priceCents,
          })
        }
        await log('booking', bookingId, 'created', null, {
          space: space.label,
          /* Visible in the audit when staff moved somebody off their first
             choice, which is the change most likely to be queried later. */
          spaceAsked: app.spaceTypeId,
          spaceBooked: space.id,
          priceCents: space.priceCents,
          addonsCents,
          addons: granted.map((a) => ({ code: a.code, priceCents: a.priceCents })),
          droppedAddons: dropped,
          commissionBps: show.commissionBps,
          code,
        })

        /* The receipt, on its own switch. Separate from the acceptance email
           because they are two different jobs: the team write the warm one in
           their own voice, and this is the space, the fee, the deadline and a
           button. Sending it takes nothing away from them, which is the whole
           reason it can go automatically when the other cannot. */
        if (show.paymentEmail === 'on') {
          const lines = [
            { label: space.label, value: usd(space.priceCents) },
            ...granted.map((a) => ({ label: a.name, value: usd(a.priceCents) })),
          ]
          const startOnly = show.paymentMethods === 'bank_only'
          const bits = {
            url: `${siteUrl()}/pay/${payToken}`,
            shopName: vendor.shopName,
            showName: show.name,
            lines,
            totalLabel: usd(space.priceCents + addonsCents),
            deadline: fmtDateTime(due),
            startOnly,
            vendorCode: code,
          }
          await mail(
            vendor.email,
            `Your booth fee: ${show.name}`,
            boothFeeText(bits),
            'booth_fee',
            undefined,
            boothFeeHtml(bits),
          )
          /* Recorded so a second Accept on the same application cannot send a
             second one, and so the roster can show it went. */
          await db.update(bookings)
            .set({ feeEmailAt: new Date().toISOString() })
            .where(eq(bookings.id, bookingId))
        }

        if (mailsDecisions) await mail(
          vendor.email,
          `You’re in: ${show.name}`,
          `${vendor.contactName}, you’re in.\n\n`
            + `${show.name} · ${fmtRange(show.startsOn, show.endsOn)} · ${show.venueName}\n`
            + `Your Mermade ID is ${code}. Tag every item ${code} plus the price. That's all the register needs.\n\n`
            + `Space: ${space.label}\nBooth fee: ${usd(space.priceCents)}\n`
            + granted.map((a) => `${a.name}: ${usd(a.priceCents)}\n`).join('')
            + (granted.length > 0 ? `Total: ${usd(space.priceCents + addonsCents)}\n` : '')
            + `${app.track === 'indoor' ? `Commission: ${show.commissionBps / 100}% on indoor sales\n` : ''}`
            /* The link. Until this line existed, this email told a maker to
               pay within 48 hours and named no way to do it, and /account had
               no invoice on it either. Sign-in is by emailed link from that
               page, so this points at the page rather than carrying a token:
               a payment url inside a forwardable email is somebody else's
               space, bought by mistake. */
            /* The wording follows the Show's payment policy. Under bank only
               the window is a deadline to START a transfer, because ACH takes
               about four business days and telling a maker to "pay within 48
               hours" would be asking for something that cannot happen. */
            /* The booking's own link, not /account. Until tokens existed this
               had to point at the portal and make the maker sign in; every
               step between an email and a paid invoice is a step where
               somebody gives up. */
            + (show.paymentMethods === 'bank_only'
              ? `\nStart your bank transfer within ${show.paymentWindowHours} hours: ${siteUrl()}/pay/${payToken}\n`
                + `Transfers take about four business days to arrive. Your space is held from `
                + `the moment you start one, so you do not have to wait for it to land.\n`
              : `\nPay to confirm within ${show.paymentWindowHours} hours: ${siteUrl()}/pay/${payToken}\n`)
            + `Sign in with this address and your fee, your space and your Mermade ID are on the page.\n`
            + `If we hear nothing by then, the space returns to the pool.\n`
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

  if (next === 'declined' && mailsDecisions) {
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

  if (next === 'waitlist' && mailsDecisions) {
    await mail(
      vendor.email,
      `Waitlisted for ${show.name}`,
      `${vendor.contactName}, you're on the waitlist for ${show.name}.\n\n`
        + `Spaces open up when accepted makers don't pay in time, and we offer them in order. `
        + `We'll email either way by ${fmtDate(show.rosterAnnouncedOn)}.\n\nMermade Market`,
      'waitlisted',
    )
  }

  /* A new maker is a new row on the payment tabs, and accepting one was the
     only thing that changed the roster without refreshing them. The sheet
     pushed on payments, Venmo matches and releases, so it told the truth
     about money and lied about who was on the list: Drew accepted three
     makers late on the 22nd, asked whether they had pay links, and the sheet
     still showed the roster as it had been at the last payment. Acceptance
     changes the roster, so acceptance refreshes it too. */
  await liveSheet(show.id)

  revalidatePath('/admin/jury')
  revalidatePath('/admin/roster')
  revalidatePath(`/admin/applications/${appId}`)
  revalidatePath('/')
}

/** Simulates the maker paying the booth fee in the portal. */
/**
 * Delete every rehearsal application for the active show.
 *
 * "Rehearsal" is defined by the clock, not by a flag anybody has to set
 * correctly: an application submitted before the window opened can only have
 * come from staff with the preview cookie or from seeded demo data, because
 * nobody else could reach the form. That makes this safe by construction. Once
 * applications are open it deletes nothing, and it cannot ever take a real
 * one, whatever anybody clicks.
 *
 * The rows really go. This is the one place in the app that deletes rather
 * than voids, and it is allowed to because these rows are not a record of
 * anything that happened: they are a record of us testing. Everything about
 * them is written into the audit log first, so the deletion is itself
 * evidence, and the log survives.
 *
 * Bookings and sheet-sync rows point at applications, so they go first.
 * Vendors are left alone: a vendor row is a person, the unique index is on
 * (show, vendor) rather than on the vendor, and a returning maker who
 * rehearsed should find their own details waiting when they apply for real.
 */
export async function purgeRehearsals(): Promise<void> {
  const show = await activeShow()
  if (!show) return

  const cutoff = show.applicationsOpenAt
  const doomed = await db
    .select({ id: applications.id, vendorId: applications.vendorId, submittedAt: applications.submittedAt })
    .from(applications)
    /* Cast BOTH sides. These are text columns holding two different shapes:
       submitted_at is Postgres's own "2026-09-07 17:12:00.123+00" and the
       Show record's dates are ISO "2026-09-07T09:00:00-07:00". Compared as
       text, a space sorts before a T, so every application submitted TODAY
       compared as EARLIER than this morning's opening time and this query
       called real applications rehearsals. Compared as timestamps it is the
       question we meant to ask. */
    .where(and(
      eq(applications.showId, show.id),
      sql`${applications.submittedAt}::timestamptz < ${cutoff}::timestamptz`,
    ))

  for (const a of doomed) {
    // The whole row, before it stops existing.
    const [full] = await db.select().from(applications).where(eq(applications.id, a.id))
    await log('application', a.id, 'purged_rehearsal', full ?? null, null,
      `submitted ${a.submittedAt}, before the window opened at ${cutoff}`)

    const held = await db.select({ id: bookings.id }).from(bookings)
      .where(eq(bookings.applicationId, a.id))
    for (const b of held) await db.delete(bookingAddons).where(eq(bookingAddons.bookingId, b.id))
    await db.delete(bookings).where(eq(bookings.applicationId, a.id))
    await db.delete(sheetSyncs).where(eq(sheetSyncs.applicationId, a.id))
    await db.delete(applications).where(eq(applications.id, a.id))
  }

  revalidatePath('/admin')
  revalidatePath('/admin/jury')
  revalidatePath('/admin/roster')
  /* Then leave, rather than re-rendering in place.
     The button lives inside `{rehearsalCount > 0 && ...}` on the dashboard, so
     a successful purge takes the count to zero and unmounts the very form
     whose action is still in flight. React reconciled that away mid
     transition and the whole main column came back empty: Drew pressed Delete
     and got a blank page. A redirect makes it a fresh navigation, so what
     arrives is a page the server rendered whole, with the block correctly
     gone. */
  redirect('/admin')
}

/**
 * Delete one application, by hand, from its own page.
 *
 * The purge on the dashboard only ever reaches rows submitted before the
 * window opened, which is exactly what makes it safe and exactly what makes
 * it insufficient: it cannot touch a rehearsal somebody sent through the live
 * form this morning, a maker who applied twice, or a spam entry. Drew, on
 * opening day: "we just got access... can we delete entries?!"
 *
 * So this one CAN take a real application, and everything about it is built
 * around that. The shop name has to be typed to match, which is the only
 * guard that survives a mis-click on the wrong maker's page, and a reason is
 * required. On a mismatch nothing is touched and the page says so.
 *
 * The whole row goes into the audit log first, so the deletion leaves a
 * record even though the record it deletes is gone. That log is the reason
 * this is allowed to be a real delete rather than a void: the evidence
 * outlives the row.
 *
 * The vendor is left alone, for the same reason the purge leaves them: a
 * vendor row is a person, and a maker whose duplicate we removed should still
 * find their details waiting.
 *
 * The Sheet is a separate copy and this does not reach into it. Deleting the
 * sheetSyncs row means the Sheet keeps its line and a later sync will append
 * a fresh one rather than update; staff delete the row there themselves.
 */
export async function deleteApplication(fd: FormData): Promise<void> {
  const id = String(fd.get('applicationId') ?? '')
  const typed = String(fd.get('confirm') ?? '').trim()
  const reason = String(fd.get('reason') ?? '').trim()
  const back = `/admin/applications/${encodeURIComponent(id)}`

  const app = await db.query.applications.findFirst({ where: eq(applications.id, id) })
  if (!app) redirect('/admin/jury')
  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.id, app.vendorId) })
  if (!vendor) redirect(`${back}?deny=missing`)

  // Case and surrounding space are noise; the name is the check.
  if (typed.toLowerCase() !== vendor.shopName.trim().toLowerCase()) {
    redirect(`${back}?deny=name`)
  }
  if (reason.length < 3) redirect(`${back}?deny=reason`)

  await log('application', id, 'deleted', app, null,
    `${reason} (confirmed "${vendor.shopName}")`)

  const held = await db.select({ id: bookings.id }).from(bookings)
    .where(eq(bookings.applicationId, id))
  for (const b of held) await db.delete(bookingAddons).where(eq(bookingAddons.bookingId, b.id))
  await db.delete(bookings).where(eq(bookings.applicationId, id))
  await db.delete(sheetSyncs).where(eq(sheetSyncs.applicationId, id))
  await db.delete(applications).where(eq(applications.id, id))

  revalidatePath('/admin')
  revalidatePath('/admin/jury')
  revalidatePath('/admin/roster')
  redirect('/admin/jury')
}

/**
 * Staff matched a payment that no webhook will ever tell us about.
 *
 * A Venmo or a Zelle lands as a notification on somebody's phone, so a person
 * finds the MM code in the payment note and presses this. That is the whole
 * reconciliation, and until now it recorded only that the fee was in: the
 * route it came by was lost, which made "who paid what and where" a question
 * the database could not answer on the one day it gets asked all day.
 *
 * `via` defaults to what the maker said when they pressed "I have sent it",
 * and falls to 'other' when neither the maker nor the staff member said.
 * Never to a guess: an unrecorded route prints as unrecorded.
 *
 * Deliberately not a door for Stripe's two routes. A card or a bank transfer
 * is confirmed by a verified webhook and nothing else (rule 5); this exists
 * for the money Stripe never sees.
 */
export async function markPaid(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId'))
  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
  if (!b || b.status !== 'awaiting_payment') return

  const via = viaFromManual(String(fd.get('via') ?? ''), b.saidSentVia)
  const paidAt = new Date().toISOString()

  await db.update(bookings)
    .set({ status: 'confirmed', paidAt, paidVia: via })
    .where(eq(bookings.id, bookingId))
  await db.update(vendors)
    .set({ showsAttended: sql`${vendors.showsAttended} + 1` })
    .where(eq(vendors.id, b.vendorId))

  await log('booking', bookingId, 'paid',
    { status: 'awaiting_payment', paidVia: b.paidVia },
    { status: 'confirmed', paidAt, paidVia: via },
    `booth fee received, matched by hand: ${viaLabel(via).toLowerCase()}`)

  await liveSheet(b.showId)

  revalidatePath('/admin/roster')
  revalidatePath('/')
}

/**
 * Correct one booking's booth fee.
 *
 * Drew, 21 Sept 2026: most fees are standard, "if there's anything custom, it
 * might be one or two people, and I can clarify that before we finalize all
 * the payments." This is where that clarification lands. One or two is enough
 * to need a control, because the alternative is SQL, and SQL writes no audit
 * row (rule 3).
 *
 * The quiet failure it closes: a maker whose real deal is not the list price
 * opens an invoice showing the list price and pays it. The webhook confirms,
 * because the invoice and the payment agree with each other and both are
 * wrong. Nothing notices until somebody reconciles by hand in December.
 *
 * Three things this is careful about.
 *
 * It refuses once money has moved. Changing the price of a fee somebody has
 * already paid does not refund them or bill them; it just makes the record
 * disagree with the bank. A paid booking that is genuinely wrong needs a
 * person and a refund, not an edit.
 *
 * It kills any live Checkout Session. Line items are fixed when a Session is
 * made, so an open one still charges the old amount, and the webhook would
 * then read that payment as a mismatch against the new invoice: money taken,
 * booking unconfirmed.
 *
 * And it bumps priceVersion, because Stripe rejects a reused idempotency key
 * whose parameters have changed. Without that the next Pay click is a 400 on
 * the one screen with a deadline on it.
 */
export async function setBoothPrice(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const reason = String(fd.get('reason') ?? '').trim()
  /* Dollars in the box, cents in the column (rule 1). Parsed through a
     rounding step rather than a float multiply, because 2.9 * 100 is 289.99999
     in this language and a booth fee is not a place to find that out. */
  const dollars = Number(String(fd.get('dollars') ?? '').replace(/[$,\s]/g, ''))
  if (!Number.isFinite(dollars) || dollars < 0 || dollars > 100_000) {
    redirect('/admin/roster?price=bad')
  }
  const priceCents = Math.round(dollars * 100)

  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
  if (!b) redirect('/admin/roster?price=missing')
  /* Confirmed, or a transfer already in flight. Both mean money has moved or
     is moving against the old number. */
  if (b.status === 'confirmed' || b.status === 'payment_processing') {
    redirect('/admin/roster?price=paid')
  }
  if (priceCents === b.priceCents) redirect('/admin/roster')

  await db.update(bookings).set({
    priceCents,
    priceVersion: b.priceVersion + 1,
  }).where(eq(bookings.id, bookingId))

  /* After the write, so a maker cannot slip through on the old session in the
     moment between the two. */
  await dropLiveCheckout(db, bookingId)

  await log('booking', bookingId, 'price_changed',
    { priceCents: b.priceCents }, { priceCents },
    reason || 'no reason given', `staff:${await staffName()}`)

  /* The girls read the sheet, not this screen. A fee changed here and not
     there is how Emily Davis Ceramics came to be discussed as a 3x6 in one
     place and a 3x8 in another on the day she was trying to pay. What a
     maker owes is exactly the kind of thing the payment tabs exist to say. */
  await liveSheet(b.showId)

  revalidatePath('/admin/roster')
  revalidatePath('/account')
  redirect('/admin/roster?price=set')
}

/**
 * Add a line to a maker's invoice, or take one off.
 *
 * Drew, 24 Sept: "there's times when things change and we need to invoice
 * them for more. We might add fees, they might want priority, they might want
 * an extra day, they might want a bigger booth, they might want a smaller
 * booth. We need to have some flexibility there."
 *
 * The one thing that could not be done before: change what a maker owes AFTER
 * they have paid. The fee itself stays frozen once money moves, because
 * editing it then makes the record disagree with the bank. This adds a line
 * instead, so the original fee and the second day are both still legible in
 * December, which is the whole point of not editing in place.
 *
 * Works on a confirmed booking on purpose. That is the case this exists for:
 * she paid for Saturday and wants Sunday. Her existing pay link then asks for
 * the difference rather than the whole thing again.
 *
 * It cannot mark anything paid and it never touches `status`. Payment state
 * belongs to Stripe and to staff pressing Mark paid (rule 5). A booking that
 * is confirmed and owes another $450 is both of those things at once, and the
 * roster says so.
 */
export async function addBoothCharge(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const description = String(fd.get('description') ?? '').trim()
  const reason = String(fd.get('reason') ?? '').trim()

  /* Dollars in the box, cents in the column, through a rounding step rather
     than a float multiply (rule 1). A leading minus is how a line comes off. */
  const typed = String(fd.get('dollars') ?? '').replace(/[$,\s]/g, '')
  const dollars = Number(typed)
  if (!Number.isFinite(dollars)) redirect('/admin/roster?charge=bad')
  const amountCents = Math.round(dollars * 100)

  const problem = chargeProblem(description, amountCents)
  if (problem) redirect('/admin/roster?charge=bad')

  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
  if (!b) redirect('/admin/roster?charge=missing')

  const id = randomUUID()
  await db.insert(bookingCharges).values({
    id, bookingId, description, amountCents,
    reason: reason || 'no reason given',
    createdBy: `staff:${await staffName()}`,
  })

  /* Same reason setBoothPrice bumps it: the idempotency key carries this
     number, and Stripe answers a reused key by REPLAYING the first session
     rather than opening a new one. Without the bump, a maker who has already
     paid and is now asked for a second day would be handed her own completed
     checkout, and the $350 could never be collected. */
  await db.update(bookings).set({ priceVersion: b.priceVersion + 1 })
    .where(eq(bookings.id, bookingId))

  /* A maker part way through checking out is paying the old balance. Drop it
     so the next thing she opens asks for the new one. */
  await dropLiveCheckout(db, bookingId)

  await log('booking', bookingId, 'charge_added', null,
    { description, amountCents }, reason || 'no reason given', `staff:${await staffName()}`)

  await liveSheet(b.showId)
  revalidatePath('/admin/roster')
  revalidatePath('/account')
  redirect('/admin/roster?charge=added')
}

/**
 * Take a line back off an invoice.
 *
 * Voided, never deleted, with who did it and why (rule 3). An invoice that
 * quietly loses a line is one nobody can reconcile against the bank in
 * December, and "it was there yesterday" is not a thing anybody should have
 * to say about a maker's money.
 */
export async function voidBoothCharge(fd: FormData): Promise<void> {
  const chargeId = String(fd.get('chargeId') ?? '')
  const reason = String(fd.get('reason') ?? '').trim()

  const c = await db.query.bookingCharges.findFirst({
    where: eq(bookingCharges.id, chargeId),
  })
  if (!c) redirect('/admin/roster?charge=missing')
  if (c.voidedAt) redirect('/admin/roster')

  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, c.bookingId) })

  await db.update(bookingCharges).set({
    voidedAt: new Date().toISOString(),
    voidedBy: `staff:${await staffName()}`,
    voidReason: reason || 'no reason given',
  }).where(eq(bookingCharges.id, chargeId))

  /* The balance moved, so the next checkout needs its own idempotency key
     exactly as it does when a line is added. */
  if (b) {
    await db.update(bookings).set({ priceVersion: b.priceVersion + 1 })
      .where(eq(bookings.id, c.bookingId))
  }

  await dropLiveCheckout(db, c.bookingId)

  await log('booking', c.bookingId, 'charge_voided',
    { description: c.description, amountCents: c.amountCents }, null,
    reason || 'no reason given', `staff:${await staffName()}`)

  if (b) await liveSheet(b.showId)
  revalidatePath('/admin/roster')
  revalidatePath('/account')
  redirect('/admin/roster?charge=voided')
}

/**
 * Move a maker into a different space.
 *
 * Elise, 23 Sept: "switch Emily ceramics 3x6 instead of 3x8." Until now only
 * the fee could be changed, which captures the money and leaves the roster
 * still saying 3x8. That row is what the floor plan and the load-in are built
 * from in November, so a fee that quietly disagrees with a footprint is a
 * problem waiting eight weeks to happen.
 *
 * The fee does NOT follow automatically. A booth fee on this roster is rarely
 * the list price: it carries credits, second day discounts and whatever the
 * girls granted, and silently repricing somebody because their footprint
 * changed would undo the very decisions the fee column exists to record. The
 * screen says what the new space lists at and the fee stays a separate,
 * deliberate press.
 *
 * Same guard as the fee: gone once money has moved. Changing the footprint
 * somebody has already paid for is a conversation, not a form.
 */
export async function setBoothSpace(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const spaceTypeId = String(fd.get('spaceTypeId') ?? '')
  const reason = String(fd.get('reason') ?? '').trim()

  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
  if (!b) redirect('/admin/roster?space=missing')
  if (b.status === 'confirmed' || b.status === 'payment_processing') {
    redirect('/admin/roster?space=paid')
  }
  if (!spaceTypeId || spaceTypeId === b.spaceTypeId) redirect('/admin/roster')

  const next = await db.query.spaceTypes.findFirst({ where: eq(spaceTypes.id, spaceTypeId) })
  const had = await db.query.spaceTypes.findFirst({ where: eq(spaceTypes.id, b.spaceTypeId) })
  if (!next) redirect('/admin/roster?space=missing')

  /* A maker applied to one track and is placed on that track. Moving an
     indoor consignment maker into an outdoor booth is not a space change, it
     is a different agreement, a different commission and a different day. */
  if (had && next.track !== had.track) redirect('/admin/roster?space=track')

  await db.update(bookings).set({ spaceTypeId }).where(eq(bookings.id, bookingId))

  /* After the write, for the same reason the fee change does it: a maker must
     not be able to finish paying against the space they no longer hold. */
  await dropLiveCheckout(db, bookingId)

  await log('booking', bookingId, 'space_changed',
    { spaceTypeId: b.spaceTypeId, label: had?.label ?? '' },
    { spaceTypeId, label: next.label },
    reason || 'no reason given', `staff:${await staffName()}`)

  /* Same reason as the fee. A footprint that has moved here and not on the
     sheet is two people reading two different numbers about one maker. */
  await liveSheet(b.showId)

  revalidatePath('/admin/roster')
  revalidatePath('/account')
  redirect('/admin/roster?space=set')
}

/**
 * Release one maker's space, by hand.
 *
 * Elise, 22 Sept: a maker was accepted who was on her no list, and another
 * should have that space. Nothing in the admin could undo a booking. The
 * status existed in the schema and only the bulk overdue sweep could ever set
 * one, which meant a wrong acceptance could be corrected in the database or
 * not at all.
 *
 * Refuses anything that has been paid or is clearing. Money that has moved is
 * a refund and a conversation, not a status flip, and a cancelled booking
 * holding a real payment would drop that money out of every total on the
 * roster while it sat in Stripe.
 *
 * The reason is required and goes in the audit log. A space taken back from
 * somebody who was told they were in is exactly the decision a person has to
 * be able to explain in November.
 *
 * Sends nothing. Whoever made this call writes to the maker themselves.
 */
export async function cancelBooking(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const reason = String(fd.get('reason') ?? '').trim()
  if (reason.length < 3) redirect('/admin/roster?release=why')

  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, bookingId) })
  if (!b) redirect('/admin/roster?release=missing')
  if (b.status === 'confirmed' || b.status === 'payment_processing') {
    redirect('/admin/roster?release=paid')
  }
  if (b.status === 'cancelled' || b.status === 'forfeited') {
    redirect('/admin/roster?release=already')
  }

  await db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, bookingId))

  /* The pay link lives in an inbox forever. Killing any half finished Stripe
     session stops the obvious race: a maker part way through checkout while
     somebody releases the space underneath them. `canStartPayment` refuses a
     fresh one from here on. */
  await dropLiveCheckout(db, bookingId)

  await log('booking', bookingId, 'released_by_staff',
    { status: b.status }, { status: 'cancelled' },
    reason, `staff:${await staffName()}`)

  await liveSheet(b.showId)

  revalidatePath('/admin/roster')
  revalidatePath('/admin')
  redirect('/admin/roster?release=done')
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
  decisionEmails: z.enum(['on', 'off']),
  paymentEmail: z.enum(['on', 'off']),
  payoutSetup: z.enum(['on', 'off']),
  venmoHandle: z.string().max(80).default(''),
  zelleContact: z.string().max(120).default(''),
  zelleName: z.string().max(120).default(''),
  onboardingSlotsIndoor: z.string().max(2000).default(''),
  onboardingSlotsOutdoor: z.string().max(2000).default(''),
  /* Optional: an empty date input posts an empty string, which is not a date
     and must not become one. */
  inventoryDueAt: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Use a date or leave it empty').default(''),
  rosterAnnouncedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Required'),
  commissionPct: z.coerce.number().min(0, 'Not negative').max(50, 'That is over half'),
  paymentDueOn: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Use a date or leave it empty').default(''),
  paymentWindowHours: z.coerce.number().int('Whole hours').min(1).max(240, 'Ten days at most'),
  paymentMethods: z.enum(['card_and_bank', 'bank_only', 'card_only']),
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
    decisionEmails: d.decisionEmails,
    paymentEmail: d.paymentEmail,
    payoutSetup: d.payoutSetup,
    venmoHandle: d.venmoHandle.trim(),
    zelleContact: d.zelleContact.trim(),
    zelleName: d.zelleName.trim(),
    onboardingSlotsIndoor: d.onboardingSlotsIndoor,
    onboardingSlotsOutdoor: d.onboardingSlotsOutdoor,
    /* Noon Pacific, not midnight: a date rendered back in another timezone
       slips to the day before from midnight and never does from noon. */
    inventoryDueAt: d.inventoryDueAt ? laWallToIso(`${d.inventoryDueAt}T12:00`) : null,
    rosterAnnouncedOn: laWallToIso(d.rosterAnnouncedOn),
    commissionBps: Math.round(d.commissionPct * 100),
    paymentWindowHours: d.paymentWindowHours,
    /* Stored as 11:59pm Pacific on the day chosen, the same convention the
       application deadline uses, so "due by 9/23" means the whole of the
       23rd rather than midnight at its start. */
    paymentDueAt: d.paymentDueOn ? laWallToIso(`${d.paymentDueOn}T23:59`) : null,
    paymentMethods: d.paymentMethods,
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

  /* The public pages read this through a cached wrapper, so staff must not
     have to wait out the window to see their own edit. */
  forgetShowConfig()

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
  /* The public pages read this through a cached wrapper, so staff must not
     have to wait out the window to see their own edit. */
  forgetShowConfig()

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
  /* The public pages read this through a cached wrapper, so staff must not
     have to wait out the window to see their own edit. */
  forgetShowConfig()

  revalidatePath('/admin/show')
  revalidatePath('/apply')
  revalidatePath('/makers/indoor')
  revalidatePath('/makers/outdoor')
}

/**
 * Send every application the Google Sheet is still missing.
 *
 * There has been a way to do this since the sync was built: `npx tsx
 * scripts/sync-sheets.ts`. Nobody who runs this business has a terminal with
 * production's credentials in it, which made "the Sheet is behind" a thing
 * only an engineer could fix. It happened for real: migration 0003 sat in the
 * migrate runner's baseline list, so sheet_syncs never existed in production
 * and not one application ever reached the Sheet. The migration is fixed, and
 * this is the button that catches the Sheet up.
 *
 * Two steps, the same two the script does. `queueMissing` gives a sheet_syncs
 * row to every application that never got one, which is what makes anything
 * submitted during the outage visible to the retry at all. Then every row that
 * is not `sent` is posted, oldest first.
 *
 * Safe to press twice. The Sheet is keyed on the application id, so a re-send
 * updates the row it already wrote rather than appending a second one, and an
 * application already marked sent is not in the list.
 */
export async function syncSheetBacklog(): Promise<void> {
  if (!sheetsConfigured()) {
    /* No transport, nothing to post to. The dashboard only renders the button
       when one is configured, so this is the double-submit case, not a state
       a person can navigate to. */
    redirect('/admin')
  }

  await queueMissing(db)
  const ids = await unsentApplicationIds(db)

  /* One at a time with a breath between, same as the script: Apps Script is
     rate limited and the Sheets API is not fast. 250ms x 100 applications is
     inside every quota and finishes inside a request. */
  for (const id of ids) {
    await syncApplication(db, id)
    await new Promise((r) => setTimeout(r, 250))
  }

  revalidatePath('/admin')
  /* Leave rather than re-render: the button lives inside a block that only
     exists while something is unsent, so a successful run unmounts the form
     whose action is still in flight. That is exactly what turned the rehearsal
     purge into a blank page. */
  redirect('/admin')
}

/**
 * Send an accepted maker to Stripe to pay their booth fee.
 *
 * Authorisation is the whole point of this being a server action rather than a
 * link: the booking is looked up FROM the signed-in maker's own vendor row, so
 * a booking id typed into a form by somebody else resolves to nothing. A maker
 * can only ever pay their own space.
 *
 * The redirect goes to Stripe's hosted page. Nothing about payment state is
 * decided here or on the way back: the booking is confirmed by the webhook and
 * only by the webhook (CLAUDE.md rule 5).
 */
export async function payBoothFee(): Promise<void> {
  const email = await readMakerSession((await cookies()).get(MAKER_COOKIE)?.value)
  if (!email) redirect('/account')

  const show = await activeShow()
  if (!show) redirect('/account')

  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.email, email) })
  if (!vendor) redirect('/account')

  const [booking] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.vendorId, vendor.id), eq(bookings.showId, show.id)))
    .limit(1)
  if (!booking) redirect('/account')

  const result = await startBoothPayment(db, booking.id, email, show.paymentMethods)

  /* Every failure lands back on /account with a reason in the url, because the
     alternative is a maker staring at a Next.js error page hours before their
     space returns to the pool. The page renders each of these as a sentence. */
  switch (result.outcome) {
    case 'ready':
      redirect(result.url)
    case 'already_paid':
      redirect('/account?paid=1')
    case 'unconfigured':
      redirect('/account?pay=unavailable')
    case 'missing':
      redirect('/account?pay=missing')
    case 'released':
      redirect('/account?pay=released')
    default:
      console.error(`[stripe] checkout failed for booking ${booking.id}: ${result.detail}`)
      redirect('/account?pay=failed')
  }
}

/**
 * The maker's answer to the onboarding call question.
 *
 * Authorised the same way payBoothFee is, from the signed-in maker's own
 * vendor row, so a booking id in a form body resolves to nothing. The value
 * is checked against the list the Show actually offers rather than trusted:
 * this string is rendered back to staff on the roster, and an unvalidated one
 * would let a maker write whatever they liked into it.
 */
export async function chooseOnboardingSlot(fd: FormData): Promise<void> {
  const email = await readMakerSession((await cookies()).get(MAKER_COOKIE)?.value)
  if (!email) redirect('/account')
  const show = await activeShow()
  if (!show) redirect('/account')
  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.email, email) })
  if (!vendor) redirect('/account')

  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.vendorId, vendor.id), eq(bookings.showId, show.id)))
    .limit(1)
  if (!booking) redirect('/account')

  const app = await db.query.applications.findFirst({
    where: eq(applications.id, booking.applicationId),
  })
  const offered = slotOptions(
    app?.track === 'outdoor' ? show.onboardingSlotsOutdoor : show.onboardingSlotsIndoor,
  )
  const slot = String(fd.get('slot') ?? '')
  if (!offered.includes(slot)) redirect('/account#call')

  const before = { onboardingSlot: booking.onboardingSlot }
  await db.update(bookings).set({ onboardingSlot: slot }).where(eq(bookings.id, booking.id))
  await log('booking', booking.id, 'onboarding_slot', before, { onboardingSlot: slot })

  revalidatePath('/account')
  revalidatePath('/admin/roster')
  redirect('/account#call')
}

/**
 * Send a maker to Stripe to set up how they GET PAID.
 *
 * The other direction from payBoothFee, and the one Drew actually cares about:
 * "this was the entire goal ... so that they only have to set up stripe once
 * and we can pay them automatically." Paying us by bank transfer does not do
 * this. That debits an account once and leaves no way for money to come back.
 *
 * Authorised exactly like payBoothFee, from the signed-in maker's own vendor
 * row. Nothing is read from the form body at all, so there is no id anybody
 * could substitute: this action can only ever act on the account of whoever
 * holds the cookie.
 *
 * The account is made once and reused; the LINK is minted fresh every time,
 * because Stripe's onboarding links are single use and expire in minutes. A
 * stored one is a broken one.
 */
export async function startConnectOnboarding(): Promise<void> {
  const email = await readMakerSession((await cookies()).get(MAKER_COOKIE)?.value)
  if (!email) redirect('/account')

  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.email, email) })
  if (!vendor) redirect('/account')

  const made = await ensureConnectAccount(db, vendor.id)
  if ('error' in made) {
    /* The reason is for us, not for them: Stripe puts request context in some
       of these and the account page says one plain sentence instead. */
    console.error(`[connect] account for ${vendor.id}: ${made.error}`)
    redirect('/account?payouts=unavailable')
  }

  /* Only the first time: the row is written by ensureConnectAccount, and this
     is the trail of who set it in motion (rule 3). */
  if (!vendor.stripeAccountId) {
    await log('vendor', vendor.id, 'connect_started',
      { stripeAccountId: null }, { stripeAccountId: made.accountId },
      'maker started payout setup', `maker:${vendor.id}`)
  }

  const link = await onboardingLink(made.accountId, '/account#payouts')
  if ('error' in link) {
    console.error(`[connect] link for ${vendor.id}: ${link.error}`)
    redirect('/account?payouts=unavailable')
  }
  redirect(link.url)
}

/**
 * Pull the account's state back from Stripe, on demand.
 *
 * The webhook is the reliable path and stays the one that matters. This is for
 * the maker standing on the page ten seconds after finishing onboarding: the
 * event may not have landed yet, and "we are still waiting" to somebody who
 * just finished reads as a system that lost their work.
 */
export async function refreshPayoutStatus(): Promise<void> {
  const email = await readMakerSession((await cookies()).get(MAKER_COOKIE)?.value)
  if (!email) redirect('/account')
  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.email, email) })
  if (!vendor?.stripeAccountId) redirect('/account#payouts')

  await refreshAccount(db, vendor.stripeAccountId)
  revalidatePath('/account')
  revalidatePath('/admin/roster')
  redirect('/account#payouts')
}

/**
 * Payout setup from a pasted link, with no sign-in.
 *
 * The sibling of startConnectOnboarding, and the one that actually gets used:
 * the maker who just paid their booth fee from a staff-written email is on
 * /pay/<token>, is not signed in, and has Stripe open in their head. Making
 * them stop, request a magic link, wait for an email and come back is how a
 * two-minute job becomes a November problem.
 *
 * The token already authorises money on this booking, so it authorises this.
 * If anything it is the lesser power: paying moves real money, while this
 * opens Stripe's own onboarding, where Stripe collects and holds everything.
 * The worst a stranger with a forwarded link can do is create an empty payout
 * account for a maker who was going to need one anyway. Nothing about the
 * maker is revealed that the page was not already showing.
 */
export async function startConnectOnboardingByToken(fd: FormData): Promise<void> {
  const token = String(fd.get('token') ?? '')
  const found = await bookingByPayToken(db, token)
  if (!found) redirect('/pay/invalid')

  const back = `/pay/${encodeURIComponent(token)}`
  /* Never for an outdoor maker. They take their own money at their own tent
     and are owed nothing, so this would be an identity check for no reason. */
  if (!owesPayoutSetup(found.track)) redirect(back)

  const made = await ensureConnectAccount(db, found.vendorId)
  if ('error' in made) {
    console.error(`[connect] account for ${found.vendorId}: ${made.error}`)
    redirect(`${back}?payouts=unavailable`)
  }
  if (!found.stripeAccountId) {
    await log('vendor', found.vendorId, 'connect_started',
      { stripeAccountId: null }, { stripeAccountId: made.accountId },
      'maker started payout setup from their payment link', `maker:${found.vendorId}`)
  }

  const link = await onboardingLink(made.accountId, `${back}#payouts`)
  if ('error' in link) {
    console.error(`[connect] link for ${found.vendorId}: ${link.error}`)
    redirect(`${back}?payouts=unavailable`)
  }
  redirect(link.url)
}

/**
 * "I have sent it", from the maker, about a Venmo or Zelle.
 *
 * Drew, 22 Sept 2026, working out how the girls reconcile these. A Venmo
 * reaches us as a notification on somebody's phone and nothing else, so until
 * a person matches it the roster cannot tell a maker who paid on Tuesday from
 * a maker who has not paid at all. Both read awaiting_payment.
 *
 * This is the maker supplying the one fact only she has, at the only moment
 * she is willing to: she just sent it. It turns searching an inbox for an
 * unknown payment into confirming one somebody said to expect.
 *
 * It is NOT a payment and it marks nothing paid (rule 5). A button on a web
 * page is not evidence that money moved. All it does is keep the space off the
 * release list and flag the row, and a person still checks Venmo and presses
 * Mark paid.
 *
 * Authorised by the pay token, exactly as paying is, and deliberately
 * reversible: pressing it again with a different method just moves the claim,
 * and staff can clear it from the roster.
 */
export async function sayManualSent(fd: FormData): Promise<void> {
  const token = String(fd.get('token') ?? '')
  const via = String(fd.get('via') ?? '')
  const back = `/pay/${encodeURIComponent(token)}`
  if (via !== 'venmo' && via !== 'zelle') redirect(back)

  const found = await bookingByPayToken(db, token)
  if (!found) redirect('/pay/invalid')

  const [b] = await db.select().from(bookings).where(eq(bookings.id, found.id)).limit(1)
  /* Nothing to claim on a booking that is already settled, and a claim on one
     that is would only muddle the roster. */
  if (!b || b.status !== 'awaiting_payment') redirect(back)

  const when = new Date().toISOString()
  await db.update(bookings).set({ saidSentAt: when, saidSentVia: via })
    .where(eq(bookings.id, b.id))
  await log('booking', b.id, 'said_sent',
    { saidSentAt: b.saidSentAt, saidSentVia: b.saidSentVia }, { saidSentAt: when, saidSentVia: via },
    `maker says they sent a ${via} payment`, `maker:${found.vendorId}`)

  revalidatePath('/admin/roster')
  redirect(`${back}?sent=${via}`)
}

/** Who is signed in, for the audit row. Falls back rather than throwing: the
 *  point of the record is that somebody marked it, and losing the name is not
 *  a reason to lose the timestamp. */
/**
 * Refresh the connected Google Sheet, if there is one.
 *
 * Called after anything that changes what a maker owes or has paid, so the
 * tabs the team works from answer "who has paid" rather than "who had paid
 * when somebody last pressed Send". Never throws and never blocks for long:
 * see pushPaymentTabsIfConnected.
 */
async function liveSheet(showId: string): Promise<void> {
  const show = await db.query.shows.findFirst({ where: (t, { eq: e }) => e(t.id, showId) })
  await pushPaymentTabsIfConnected(db, showId, show?.paymentSheetId, siteUrl())
}

async function staffName(): Promise<string> {
  const who = await staffForSession((await cookies()).get(ADMIN_COOKIE)?.value)
  return who?.name ?? 'staff'
}

/**
 * Pay from a link staff pasted into an email they wrote themselves.
 *
 * The sibling of payBoothFee, and deliberately a separate door. payBoothFee
 * authorises from the signed-in maker's own vendor row, which is the stronger
 * check and stays the way the portal works. This one authorises from the token
 * itself, because under manual acceptance there is no email from us for the
 * maker to sign in through: staff send the link, and the link has to work for
 * whoever opens it.
 *
 * What that costs is real and worth stating: anybody holding the link can pay
 * that invoice. What it does NOT do is open the account, so a forwarded link
 * never exposes an application, an address or a phone number. The money lands
 * on the right booking either way, which makes "somebody else paid it" a
 * curiosity rather than a loss.
 */
export async function payByToken(fd: FormData): Promise<void> {
  const token = String(fd.get('token') ?? '')
  const found = await bookingByPayToken(db, token)
  if (!found) redirect('/pay/invalid')

  const show = await db.query.shows.findFirst({ where: eq(shows.id, found.showId) })
  /* Back to THIS page, not the account. A maker who opened a pasted link has
     no session, so returning them to /account after a successful payment put
     a sign-in box in front of somebody who had just given us money. */
  const back = `/pay/${encodeURIComponent(token)}`
  const result = await startBoothPayment(
    db, found.id, found.email, show?.paymentMethods ?? 'card_and_bank', back,
  )
  switch (result.outcome) {
    case 'ready':
      redirect(result.url)
    case 'already_paid':
      redirect(`${back}?paid=1`)
    case 'unconfigured':
      redirect(`${back}?pay=unavailable`)
    case 'missing':
      redirect(`${back}?pay=missing`)
    case 'released':
      redirect(`${back}?pay=released`)
    default:
      console.error(`[stripe] token checkout failed for booking ${found.id}: ${result.detail}`)
      redirect(`${back}?pay=failed`)
  }
}

/**
 * Record that a person sent this maker their link.
 *
 * Not a nicety. With no automated acceptance email, nothing else in the system
 * knows whether a maker was ever told they are in, and the forfeit path
 * releases unpaid spaces whether or not anybody wrote to them. This is the
 * column the roster reads to show who is accepted and still in the dark.
 */
export async function markLinkSent(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const undo = String(fd.get('undo') ?? '') === '1'
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1)
  if (!booking) redirect('/admin/roster')

  const before = { linkSentAt: booking.linkSentAt, linkSentBy: booking.linkSentBy }
  const after = undo
    ? { linkSentAt: null, linkSentBy: null }
    : { linkSentAt: new Date().toISOString(), linkSentBy: await staffName() }

  await db.update(bookings).set(after).where(eq(bookings.id, bookingId))
  await log('booking', bookingId, undo ? 'link_unsent' : 'link_sent', before, after)

  revalidatePath('/admin/roster')
  redirect('/admin/roster')
}

/**
 * Release the spaces of makers who never paid.
 *
 * The acceptance email has always said "After that the space returns to the
 * pool" and nothing ever did it. With roughly a hundred acceptances going out
 * across three days, each with its own 48 hour clock, this cannot be a thing
 * somebody remembers to check.
 *
 * Staff-triggered rather than automatic, deliberately. A space returning to
 * the pool is a decision about a real person who applied months earlier, and
 * it should be taken by somebody who can see the list first. The screen shows
 * exactly who is about to be released before the button is pressed.
 *
 * `isForfeitable` decides, not this function, and it will not touch a booking
 * whose bank transfer is still clearing however far past the deadline it is.
 * A maker who paid on the last day by transfer must not lose their space
 * because ACH takes four business days.
 */
export async function forfeitOverdueBookings(): Promise<void> {
  const show = await activeShow()
  if (!show) redirect('/admin/roster')

  const now = new Date().toISOString()
  const rows = await db
    .select({ booking: bookings, vendor: vendors })
    .from(bookings)
    .innerJoin(vendors, eq(bookings.vendorId, vendors.id))
    .where(eq(bookings.showId, show.id))

  const doomed = rows.filter(
    (r) => isForfeitable(r.booking.status, r.booking.paymentDueAt, now, r.booking.saidSentAt,
      r.booking.priceCents + r.booking.addonsCents),
  )

  /* Same gate as a jury decision: releasing a space is a dashboard action, so
     under manual mode staff tell the maker themselves. The release still
     happens and is still audit-logged either way. */
  const mailsDecisions = show.decisionEmails === 'on'

  for (const { booking, vendor } of doomed) {
    const before = { status: booking.status, paymentDueAt: booking.paymentDueAt }
    await db.update(bookings)
      .set({ status: 'forfeited' })
      .where(eq(bookings.id, booking.id))

    await log('booking', booking.id, 'forfeited', before, { status: 'forfeited' },
      `booth fee unpaid at ${booking.paymentDueAt}, released ${now}`)

    /* Say it plainly and leave the door open. A maker who missed a deadline by
       a few hours because they were at a craft fair is exactly the maker this
       market wants, and the waiting list is real. */
    if (mailsDecisions) await mail(
      vendor.email,
      `Your ${show.name} space`,
      `${vendor.contactName}, we did not receive your booth fee by ${fmtDateTime(booking.paymentDueAt)}, `
        + `so your space has gone back into the pool.\n\n`
        + `If that is a mistake, or something got in the way, write back today. `
        + `We would rather hear from you than fill it.\n\n`
        + `Mermade Market`,
      'forfeited',
    )
  }

  revalidatePath('/admin/roster')
  revalidatePath('/admin')
  /* Leave rather than re-render: the button lives inside a block that only
     exists while something is overdue, and a successful run empties it. */
  redirect('/admin/roster')
}
