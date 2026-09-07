import { createHash, randomUUID } from 'crypto'
import { capiToken, pixelId, capiConfigured, LDU } from './config'

/**
 * Server-side conversion events.
 *
 * Why server side at all, when the pixel is already in the page: a browser
 * event is lost to an ad blocker, to Safari, and to anybody who closes the tab
 * before the script runs, and applications are the only conversion this
 * business has. An application that Meta never hears about is a maker who
 * looks, to the algorithm, like somebody who bounced.
 *
 * Events are DEDUPLICATED against the browser by event_id: the same id is
 * given to both, and Meta keeps one. Without it a single application counts
 * twice and every cost-per-application is half what it really is.
 *
 * Personal data is SHA-256 hashed before it leaves this process, which is
 * Meta's requirement and also ours (CLAUDE.md rule 9): the raw address never
 * goes over the wire and never reaches a log.
 *
 * Nothing here throws. A conversion is a marketing signal; losing one must
 * never cost a maker their application.
 */

export type CapiResult =
  | { outcome: 'skipped' }
  | { outcome: 'sent'; eventId: string }
  | { outcome: 'failed'; detail: string }

/** Meta wants lowercased, trimmed, then SHA-256 hex. */
export function hash(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

/** A phone has to lose everything that is not a digit before it is hashed. */
export function hashPhone(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  return digits ? createHash('sha256').update(digits).digest('hex') : null
}

export type LeadEvent = {
  email: string
  phone?: string
  /** Shared with the browser event so Meta counts it once. */
  eventId?: string
  /** The page the person was on, for attribution. */
  sourceUrl?: string
  /** Passed through from the browser's _fbp / _fbc cookies when we have them. */
  fbp?: string
  fbc?: string
  clientIp?: string
  userAgent?: string
}

export function newEventId(): string {
  return randomUUID()
}

/** Post one Lead. Never throws. */
export async function sendLead(e: LeadEvent, timeoutMs = 5000): Promise<CapiResult> {
  if (!capiConfigured()) return { outcome: 'skipped' }
  const id = pixelId()!
  const token = capiToken()!
  const eventId = e.eventId ?? newEventId()

  const user_data: Record<string, unknown> = { em: [hash(e.email)] }
  if (e.phone) { const p = hashPhone(e.phone); if (p) user_data.ph = [p] }
  if (e.fbp) user_data.fbp = e.fbp
  if (e.fbc) user_data.fbc = e.fbc
  if (e.clientIp) user_data.client_ip_address = e.clientIp
  if (e.userAgent) user_data.client_user_agent = e.userAgent

  const body = {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      ...(e.sourceUrl ? { event_source_url: e.sourceUrl } : {}),
      user_data,
      ...LDU,
    }],
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${id}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (res.ok) return { outcome: 'sent', eventId }
    const text = await res.text().catch(() => '')
    /* Never store or log what came back verbatim: the token is in the URL and
       Meta echoes request context in some errors. Status and a short slice. */
    return { outcome: 'failed', detail: `${res.status} ${text.replace(/\s+/g, ' ').slice(0, 200)}` }
  } catch (err) {
    const why = err instanceof Error && err.name === 'AbortError' ? 'timed out' : 'network error'
    return { outcome: 'failed', detail: why }
  } finally {
    clearTimeout(timer)
  }
}
