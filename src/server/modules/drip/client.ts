/**
 * Push one subscriber to Drip.
 *
 * Verified against developer.drip.com before it was written, not from memory:
 * POST /v2/:account_id/subscribers, HTTP Basic with the API token as the
 * username and an EMPTY password, subscribers wrapped in an array, 201 or 204
 * on success, 422 with an `errors` array on a validation failure.
 *
 * Two promises, both borrowed from what the Sheets sync got wrong:
 *
 *   1. Joining the list never fails because of Drip. The row is already
 *      committed before this runs. Drip being down, slow or misconfigured
 *      costs a push and nothing else, so nothing in here throws.
 *   2. A failure is never silent. Every attempt is written back to the
 *      subscriber row, so a broken token shows up as a count rather than as
 *      an empty list somebody notices in a month.
 *
 * With no credentials configured this is a no-op that reports 'skipped',
 * exactly the way email behaves without RESEND_API_KEY.
 */

export type DripResult =
  | { outcome: 'skipped' }                      // not configured
  | { outcome: 'sent' }
  | { outcome: 'failed'; detail: string }

export type DripConfig = { accountId: string; token: string }

/** Configured, or nothing. Both halves are required; one alone is a typo. */
export function dripConfig(): DripConfig | null {
  const accountId = process.env.DRIP_ACCOUNT_ID?.trim()
  const token = process.env.DRIP_API_TOKEN?.trim()
  return accountId && token ? { accountId, token } : null
}

/**
 * What went wrong, in a form safe to store.
 *
 * Drip echoes the submitted address back in some validation errors, and this
 * string lands in a database column and in logs, so the address is stripped
 * (CLAUDE.md rule 9). Length-capped because a stack of HTML from a proxy is
 * not a diagnosis.
 */
export function redact(detail: string, email: string): string {
  const withoutEmail = email
    ? detail.split(email).join('[address]')
    : detail
  return withoutEmail.replace(/\s+/g, ' ').trim().slice(0, 300)
}

export async function pushSubscriber(
  email: string,
  opts: { tags?: string[]; source?: string; timeoutMs?: number; cfg?: DripConfig | null } = {},
): Promise<DripResult> {
  const cfg = opts.cfg === undefined ? dripConfig() : opts.cfg
  if (!cfg) return { outcome: 'skipped' }

  const body = {
    subscribers: [{
      email,
      // Where on the site they signed up, so a segment can be built later
      // without us having to remember which form was which.
      ...(opts.source ? { custom_fields: { signup_source: opts.source } } : {}),
      ...(opts.tags?.length ? { tags: opts.tags } : {}),
    }],
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000)

  try {
    const res = await fetch(
      `https://api.getdrip.com/v2/${encodeURIComponent(cfg.accountId)}/subscribers`,
      {
        method: 'POST',
        headers: {
          // Basic, token as the username, empty password. Their docs write it
          // as `-u YOUR_API_KEY:` and the trailing colon is the empty password.
          Authorization: `Basic ${Buffer.from(`${cfg.token}:`).toString('base64')}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Mermade Market (mermademarket.com)',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    )

    if (res.ok) return { outcome: 'sent' }

    const text = await res.text().catch(() => '')
    return { outcome: 'failed', detail: redact(`${res.status} ${text}`, email) }
  } catch (e) {
    const why = e instanceof Error && e.name === 'AbortError' ? 'timed out' : String(e)
    return { outcome: 'failed', detail: redact(why, email) }
  } finally {
    clearTimeout(timer)
  }
}
