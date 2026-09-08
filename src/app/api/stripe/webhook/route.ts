import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/db'
import { handleStripeWebhook } from '@/server/modules/payments/booth'

/* Never cached, never prerendered, and never statically analysed into
   something that reads the body twice. */
export const dynamic = 'force-dynamic'

/**
 * Stripe's webhook endpoint. The only thing that marks a booking paid.
 *
 * `req.text()` and not `req.json()`, deliberately: the signature is computed
 * over the exact bytes Stripe sent, so parsing and re-serialising first makes
 * every legitimate event look forged.
 *
 * Always 200 on anything we understood, including a duplicate, an event we
 * ignore, and an amount mismatch. A non-2xx tells Stripe to retry, and
 * retrying does not fix any of those: the mismatch is recorded in
 * stripe_events with its reason and needs a person, not another delivery. The
 * one case that returns 400 is a bad signature, which is the one case where
 * "do not send that again" is the right answer.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text()
  const signature = req.headers.get('stripe-signature')

  const result = await handleStripeWebhook(db, raw, signature)

  switch (result.outcome) {
    case 'bad_signature':
      return NextResponse.json({ error: 'bad signature' }, { status: 400 })
    case 'unconfigured':
      /* No keys on this deployment. 200, because a preview deploy should not
         make Stripe's dashboard turn red with delivery failures. */
      return NextResponse.json({ ok: true, note: 'payments not configured here' })
    default:
      /* The outcome is deliberately echoed. It carries no personal data, it is
         visible in Stripe's own delivery log, and "mismatch" showing up there
         is how somebody notices before a maker complains. */
      return NextResponse.json({ ok: true, outcome: result.outcome })
  }
}
