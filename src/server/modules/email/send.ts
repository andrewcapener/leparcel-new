import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { emailOutbox } from '@/db/schema'

/**
 * The one way a single message leaves this application.
 *
 * It lived privately inside actions.ts, which was fine while actions.ts was
 * the only file that mailed anybody. The moment a second screen needed to
 * send one, the choice was to copy this function or to move it, and copying
 * it is how a codebase ends up with two transports that drift: one grows a
 * reply-to, the other does not; one records the failure, the other swallows
 * it. src/server/modules/email/can-send.test.ts counts the modules that can
 * reach api.resend.com for exactly this reason, and a second copy is the
 * thing it is built to catch.
 *
 * sendChase() is the deliberate exception and stays separate: a batch is a
 * different endpoint with different failure modes, and it could not reuse
 * this if it tried.
 *
 * The outbox row is written BEFORE the request and updated after, never the
 * other way round. A send that throws still leaves a record, so "did she get
 * the invoice" is answerable from our own database at /admin/outbox rather
 * than from somebody's memory.
 *
 * Returns what happened rather than nothing, so a screen that sent one
 * message on a button press can say which of the three it was. Most callers
 * ignore it, which is fine; the one that asks gets a truthful answer instead
 * of a spinner that resolves into silence.
 */
/* A hung request is worse than a failed one here: this is awaited inside a
   Server Action, so without a deadline a slow provider holds the staff
   member's page open until the platform kills it, and no outbox row is ever
   updated. */
const TIMEOUT_MS = 20_000

const DEFAULT_EMAIL_FROM = 'Mermade Market <hello@mermademarket.com>'

export async function mail(
  toEmail: string, subject: string, body: string, template: string, replyTo?: string,
  html?: string,
): Promise<'sent' | 'logged' | 'failed'> {
  const id = randomUUID()
  await db.insert(emailOutbox).values({ id, toEmail, subject, body, template })

  const key = process.env.RESEND_API_KEY
  if (!key) return 'logged'

  let status: 'sent' | 'failed' = 'sent'
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
      signal: AbortSignal.timeout(TIMEOUT_MS),
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
  return status
}
