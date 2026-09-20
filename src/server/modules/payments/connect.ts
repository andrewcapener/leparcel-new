import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { vendors } from '@/db/schema'
import { stripe } from './config'
import { siteUrl } from '@/lib/site-url'
import type { DbHandle } from './booth'

/**
 * Stripe Connect: the account a maker owns, that Mermade pays into.
 *
 * The thing to keep straight, because the whole payment-method decision was
 * built on the opposite belief: paying Mermade by bank transfer does not make
 * one of these. That debits a bank once. This is a separate account with its
 * own identity check and its own tax ID, and it is the only way money moves
 * from Mermade to a maker.
 *
 * Express, per docs/04 §3. Stripe collects the KYC and chases what is
 * missing, which at forty makers is worth a great deal; Mermade keeps control
 * of when payouts go out, which is the whole reason not to use Standard.
 */

/** What a maker sees, and what staff sort on. Ordered by how much attention
 *  each one needs, which is the order the roster reads them in. */
export type ConnectState =
  /** No Stripe account yet. */
  | 'not_started'
  /** Account exists, Stripe still wants something from them. */
  | 'unfinished'
  /** Stripe is checking documents. Nothing for the maker to do but wait. */
  | 'in_review'
  /** Stripe has turned it off. Needs a person, not a nudge. */
  | 'disabled'
  /** Money can leave. */
  | 'ready'

export type ConnectFacts = {
  stripeAccountId: string | null
  payoutsEnabled: boolean
  connectRequirements: string
  connectDisabledReason: string | null
}

/** Safe JSON: a column that should hold an array sometimes holds junk. */
export function requirementList(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw || '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Where a maker stands, from what Stripe last told us.
 *
 * `payouts_enabled` is Stripe's verdict and nothing else is allowed to stand
 * in for it. A statement must never be paid because our own columns looked
 * agreeable: the money either can leave or it cannot, and only Stripe knows.
 */
export function connectState(f: ConnectFacts): ConnectState {
  if (!f.stripeAccountId) return 'not_started'
  if (f.payoutsEnabled) return 'ready'
  /* Disabled is not the same as unfinished, and telling them apart is the
     difference between a reminder and a phone call. Stripe sets a disabled
     reason for the first and leaves it empty for the second. `pending
     verification` is its own thing again: Stripe is reading documents and
     nobody should be chased at all. */
  const why = (f.connectDisabledReason ?? '').trim()
  if (why && why !== 'requirements.pending_verification') return 'disabled'
  if (why === 'requirements.pending_verification') return 'in_review'
  return 'unfinished'
}

/** Whether this maker can be paid. The one question statements may ask. */
export function canBePaid(f: ConnectFacts): boolean {
  return connectState(f) === 'ready'
}

/** Only indoor makers are ever owed money: Mermade rings those sales. An
 *  outdoor maker runs their own register and never needs any of this. */
export function owesPayoutSetup(track: string): boolean {
  return track !== 'outdoor'
}

/* Stripe's field names are not sentences. These are the ones that actually
   come up; anything unmapped falls back to a readable version of the key
   rather than being hidden, because a maker stuck on an unlisted requirement
   is exactly who needs to be told something. */
const SAYS: Record<string, string> = {
  'individual.verification.document': 'A photo of your ID',
  'individual.id_number': 'Your Social Security number',
  'individual.ssn_last_4': 'The last four of your Social Security number',
  'individual.dob.day': 'Your date of birth',
  'individual.address.line1': 'Your address',
  'individual.first_name': 'Your legal first name',
  'individual.last_name': 'Your legal last name',
  'individual.email': 'Your email',
  'individual.phone': 'Your phone number',
  'external_account': 'The bank account you want to be paid into',
  'business_profile.url': 'A website or social media page',
  'business_profile.mcc': 'What you sell',
  'business_profile.product_description': 'What you sell',
  'tos_acceptance.date': 'Accepting Stripe’s terms',
  'individual.verification.additional_document': 'A second document, such as a utility bill',
  'business_profile.support_phone': 'A phone number your customers could reach',
  'settings.payments.statement_descriptor': 'The name that should show on a bank statement',
  /* Only ever seen by a maker who told Stripe they trade as a company rather
     than as themselves, which a few of them do. */
  'company.tax_id': 'Your EIN',
  'company.name': 'Your registered business name',
  'company.address.line1': 'Your business address',
  'company.owners_provided': 'Confirming who owns the business',
  'company.directors_provided': 'Confirming who runs the business',
  'relationship.owner': 'Who owns the business',
}

/** Stripe's requirement keys, in the maker's words. Deduplicated: several
 *  keys map to one sentence and nobody needs to read it twice. */
export function requirementsInPlainWords(keys: string[]): string[] {
  const out: string[] = []
  for (const k of keys) {
    const said = SAYS[k] ?? SAYS[k.replace(/^individual\./, '')] ?? humanise(k)
    if (!out.includes(said)) out.push(said)
  }
  return out
}

function humanise(key: string): string {
  const last = key.split('.').pop() ?? key
  const words = last.replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/* ───────────────────────────── Stripe side ───────────────────────────── */

/**
 * The maker's account, made once and reused forever.
 *
 * Express with `controller` properties rather than the old `type: 'express'`,
 * which is what docs/04 §3 specifies and what the current API wants: Mermade
 * carries loss liability and pays the fees (they come out of the 20%, which
 * is where they belong), and Stripe does the chasing.
 */
export async function ensureConnectAccount(
  db: DbHandle, vendorId: string,
): Promise<{ accountId: string } | { error: string }> {
  const s = stripe()
  if (!s) return { error: 'Stripe is not configured on this deployment.' }

  const [v] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1)
  if (!v) return { error: 'No such maker.' }
  if (v.stripeAccountId) return { accountId: v.stripeAccountId }

  try {
    const account = await s.accounts.create({
      controller: {
        /* Mermade eats negative balances. Required to control payout timing,
           which is the entire reason for Express over Standard. */
        losses: { payments: 'application' },
        fees: { payer: 'application' },
        requirement_collection: 'stripe',
        stripe_dashboard: { type: 'express' },
      },
      country: 'US',
      email: v.email,
      business_profile: {
        name: v.shopName,
        ...(v.website ? { url: v.website } : {}),
      },
      capabilities: { transfers: { requested: true } },
      metadata: { vendorId: v.id, shopName: v.shopName },
    }, {
      /* One account per maker even if they double-click. */
      idempotencyKey: `connect:${v.id}:v1`,
    })

    await db.update(vendors)
      .set({ stripeAccountId: account.id, connectUpdatedAt: new Date().toISOString() })
      .where(eq(vendors.id, v.id))
    return { accountId: account.id }
  } catch (err) {
    const detail = err instanceof Error ? err.message.slice(0, 300) : 'unknown Stripe error'
    return { error: detail }
  }
}

/**
 * A fresh onboarding link. They expire in minutes and are single use, so one
 * is minted per visit rather than stored: a saved link is a broken link.
 */
export async function onboardingLink(
  accountId: string, back: string,
): Promise<{ url: string } | { error: string }> {
  const s = stripe()
  if (!s) return { error: 'Stripe is not configured on this deployment.' }
  try {
    const link = await s.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      /* Both point back to the same page. Stripe uses refresh_url when its
         own link has expired, and the page simply mints another. */
      refresh_url: `${siteUrl()}${back}`,
      return_url: `${siteUrl()}${back}?payouts=back`,
    })
    return { url: link.url }
  } catch (err) {
    return { error: err instanceof Error ? err.message.slice(0, 300) : 'unknown Stripe error' }
  }
}

/** Write back what Stripe says. The only writer of payouts_enabled. */
export async function recordAccount(db: DbHandle, account: Stripe.Account): Promise<void> {
  const due = [
    ...(account.requirements?.currently_due ?? []),
    ...(account.requirements?.past_due ?? []),
  ]
  await db.update(vendors).set({
    payoutsEnabled: Boolean(account.payouts_enabled),
    chargesEnabled: Boolean(account.charges_enabled),
    connectRequirements: JSON.stringify([...new Set(due)]),
    connectDisabledReason: account.requirements?.disabled_reason ?? null,
    connectUpdatedAt: new Date().toISOString(),
  }).where(eq(vendors.stripeAccountId, account.id))
}

/** Ask Stripe directly. Used when a maker comes back from onboarding, because
 *  the webhook may not have landed yet and they want to see it worked. */
export async function refreshAccount(db: DbHandle, accountId: string): Promise<void> {
  const s = stripe()
  if (!s) return
  try {
    await recordAccount(db, await s.accounts.retrieve(accountId))
  } catch {
    /* A failed refresh is not worth a broken page: the webhook is the
       reliable path and this is only ever the impatient one. */
  }
}
