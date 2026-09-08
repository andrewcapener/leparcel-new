import Stripe from 'stripe'

/**
 * Stripe, or nothing at all.
 *
 * Same shape as every other integration in this codebase: with no key set
 * this is inert and the rest of the app behaves as though payments were never
 * built, exactly the way email behaves without RESEND_API_KEY. That matters
 * more here than elsewhere, because it means the maker portal can ship and be
 * reviewed before the Stripe account exists, and the day the key lands in
 * Vercel the Pay button starts working with no code change.
 *
 * Trimmed, for the reason documented at length in the Meta and Drip clients:
 * a key pasted into a dashboard with a trailing newline fails in a way that
 * looks identical to a revoked key and costs a deploy cycle to tell apart.
 */
export const stripeSecret = () => process.env.STRIPE_SECRET_KEY?.trim() || undefined
export const webhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined

export const paymentsConfigured = () => Boolean(stripeSecret())

/** True while the configured key is a test key. Surfaced in the UI, because a
 *  test key silently taking pretend money at a real deadline is the worst
 *  possible failure and it should be visible on the page, not in an env var. */
export const isTestMode = () => Boolean(stripeSecret()?.startsWith('sk_test_'))

let client: Stripe | undefined
export function stripe(): Stripe | undefined {
  const key = stripeSecret()
  if (!key) return undefined
  /* Pinned API version rather than the account default: a Stripe-side version
     bump must never change what this app does without a deploy. */
  client ??= new Stripe(key, { apiVersion: '2026-08-26.dahlia' })
  return client
}

/** For /api/health: what is configured, never a value (rule 9). */
export function paymentsDiagnostics() {
  const key = stripeSecret()
  return {
    configured: Boolean(key),
    mode: key ? (isTestMode() ? 'test' : 'live') : null,
    hasWebhookSecret: Boolean(webhookSecret()),
    /* A live key with no webhook secret is the dangerous middle state: makers
       can pay and nothing will ever mark them confirmed, because a booking is
       only ever confirmed by a verified webhook (rule 5). */
    canConfirmPayments: Boolean(key && webhookSecret()),
  }
}
