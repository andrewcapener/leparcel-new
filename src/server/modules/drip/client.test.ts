/**
 * The Drip push must never break a signup, and must never store an address.
 *
 * Two properties, both learned the hard way elsewhere in this codebase. The
 * Sheets sync failed silently from launch day because nothing recorded the
 * failure, so every outcome here has to be distinguishable. And rule 9 says
 * PII never reaches a log or an error column, so what Drip says back has to be
 * scrubbed before it is stored.
 */

export {}   // a module, so its locals do not collide with the other test scripts

import { pushSubscriber, redact, dripConfig } from './client'

let failures = 0
const check = (what: string, ok: boolean, detail = '') => {
  if (!ok) { failures++; console.error(`  FAIL ${what}${detail ? `: ${detail}` : ''}`) }
}

const CFG = { accountId: '4516610', token: 'test-token' }
const EMAIL = 'maker@example.com'

/* ── redaction ─────────────────────────────────────────────────────────── */
{
  const raw = `422 {"errors":[{"attribute":"email","message":"${EMAIL} is invalid"}]}`
  const out = redact(raw, EMAIL)
  check('the address is stripped', !out.includes(EMAIL), out)
  check('the reason survives', out.includes('is invalid'), out)
  check('the status survives', out.startsWith('422'), out)
  check('newlines collapse', !redact('a\n\nb', EMAIL).includes('\n'))
  check('it is length capped', redact('x'.repeat(900), EMAIL).length <= 300)
  check('an empty email does not blank the whole string',
    redact('500 upstream', '') === '500 upstream')
}

/* ── configuration ─────────────────────────────────────────────────────── */
{
  const before = { a: process.env.DRIP_ACCOUNT_ID, t: process.env.DRIP_API_TOKEN }
  delete process.env.DRIP_ACCOUNT_ID; delete process.env.DRIP_API_TOKEN
  check('no credentials means not configured', dripConfig() === null)
  process.env.DRIP_ACCOUNT_ID = '4516610'
  check('half configured is not configured', dripConfig() === null)
  process.env.DRIP_API_TOKEN = 'abc'
  check('both halves configure it', dripConfig()?.accountId === '4516610')
  if (before.a) process.env.DRIP_ACCOUNT_ID = before.a; else delete process.env.DRIP_ACCOUNT_ID
  if (before.t) process.env.DRIP_API_TOKEN = before.t; else delete process.env.DRIP_API_TOKEN
}

/* ── the request we actually send ──────────────────────────────────────── */
async function withFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const real = globalThis.fetch
  globalThis.fetch = impl
  try { return await fn() } finally { globalThis.fetch = real }
}

async function main() {
  let seen: { url: string; init: RequestInit } | null = null
  const ok = (async (url: string | URL, init: RequestInit) => {
    seen = { url: String(url), init }
    return new Response(null, { status: 204 })
  }) as unknown as typeof fetch

  const sent = await withFetch(ok, () =>
    pushSubscriber(EMAIL, { cfg: CFG, source: 'popup', tags: ['site-signup'] }))
  check('204 is a success', sent.outcome === 'sent', JSON.stringify(sent))

  const s = seen as unknown as { url: string; init: RequestInit }
  check('the account id is in the path',
    s.url === 'https://api.getdrip.com/v2/4516610/subscribers', s.url)
  const h = s.init.headers as Record<string, string>
  /* Basic, token as the username, EMPTY password. Their docs write it as
     `-u YOUR_API_KEY:` and that trailing colon is the empty password. */
  check('basic auth, token as user, empty password',
    h.Authorization === `Basic ${Buffer.from('test-token:').toString('base64')}`, h.Authorization)
  check('json content type', h['Content-Type'] === 'application/json')

  const body = JSON.parse(String(s.init.body))
  check('subscribers are wrapped in an array', Array.isArray(body.subscribers))
  check('the address is sent', body.subscribers[0].email === EMAIL)
  check('the tag is sent', body.subscribers[0].tags?.[0] === 'site-signup')
  check('the source rides along as a custom field',
    body.subscribers[0].custom_fields?.signup_source === 'popup')

  // 201 is the other success Drip documents.
  const created = await withFetch(
    (async () => new Response('{}', { status: 201 })) as unknown as typeof fetch,
    () => pushSubscriber(EMAIL, { cfg: CFG }))
  check('201 is a success', created.outcome === 'sent')

  // A validation failure is reported, scrubbed, and never throws.
  const bad = await withFetch(
    (async () => new Response(`{"errors":[{"message":"${EMAIL} bad"}]}`, { status: 422 })) as unknown as typeof fetch,
    () => pushSubscriber(EMAIL, { cfg: CFG }))
  check('422 is a failure', bad.outcome === 'failed')
  check('and it carries a reason', bad.outcome === 'failed' && bad.detail.includes('422'))
  check('with no address in it', bad.outcome === 'failed' && !bad.detail.includes(EMAIL))

  // Drip being down costs a push and nothing else.
  const down = await withFetch(
    (async () => { throw new Error('ECONNREFUSED') }) as unknown as typeof fetch,
    () => pushSubscriber(EMAIL, { cfg: CFG }))
  check('a network error never throws', down.outcome === 'failed')

  // Not configured: a no-op, and no request at all.
  let called = false
  const skipped = await withFetch(
    (async () => { called = true; return new Response(null, { status: 204 }) }) as unknown as typeof fetch,
    () => pushSubscriber(EMAIL, { cfg: null }))
  check('unconfigured is skipped', skipped.outcome === 'skipped')
  check('and sends nothing', !called)

  if (failures) { console.error(`drip: ${failures} failure(s)`); process.exit(1) }
  console.log('drip: the contract holds, failures are reported, no address is stored')
}
main()
