/**
 * The Drip push, against the contract on developer.drip.com.
 *
 * Checked before this was written rather than remembered: HTTP Basic with the
 * API token as the username and an EMPTY password (their docs write it as
 * `-u YOUR_API_KEY:`, and the trailing colon is the empty password), the
 * subscribers wrapped in an ARRAY, 201 or 204 on success, 422 with an errors
 * array on a validation failure.
 *
 * Every one of those is a thing that fails quietly if it is wrong: a bad auth
 * header is a 401 nobody reads, and an unwrapped body is a 422 nobody reads,
 * and either way the list silently stops filling.
 */

export {}   // a module, so its locals do not collide with the other test scripts

import { pushSubscriber, redact, dripConfig } from './client'

let failures = 0
const check = (what: string, ok: boolean, detail = '') => {
  if (!ok) { failures++; console.error(`  FAIL ${what}${detail ? `: ${detail}` : ''}`) }
}

const CFG = { accountId: '4516610', token: 'test-token' }

/** Stands in for fetch and remembers exactly what it was handed. */
function spy(status: number, body = '') {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string | URL, init: RequestInit) => {
    calls.push({ url: String(url), init })
    return { ok: status >= 200 && status < 300, status, text: async () => body } as Response
  }) as typeof fetch
  return { calls, restore: () => { globalThis.fetch = original } }
}

async function main() {
  /* 1 · a good push */
  {
    const s = spy(204)
    const r = await pushSubscriber('maker@example.com', { cfg: CFG, source: 'home', tags: ['site-signup'] })
    s.restore()
    check('204 is a success', r.outcome === 'sent', JSON.stringify(r))

    const { url, init } = s.calls[0]!
    check('the account id is in the path',
      url === 'https://api.getdrip.com/v2/4516610/subscribers', url)
    check('it posts', init.method === 'POST')

    const auth = (init.headers as Record<string, string>).Authorization
    const decoded = Buffer.from(auth.replace('Basic ', ''), 'base64').toString()
    check('basic auth, token as user', decoded.startsWith('test-token:'), decoded)
    check('and an EMPTY password, which is the trailing colon',
      decoded === 'test-token:', decoded)

    const body = JSON.parse(String(init.body))
    check('subscribers are wrapped in an array', Array.isArray(body.subscribers))
    check('one subscriber', body.subscribers.length === 1)
    check('the address is sent', body.subscribers[0].email === 'maker@example.com')
    check('the tag is sent', body.subscribers[0].tags?.[0] === 'site-signup')
    check('the source rides along as a custom field',
      body.subscribers[0].custom_fields?.signup_source === 'home')
  }

  /* 2 · 201 is also a success, per the docs */
  {
    const s = spy(201); const r = await pushSubscriber('a@b.test', { cfg: CFG }); s.restore()
    check('201 is a success too', r.outcome === 'sent')
  }

  /* 3 · a validation failure is reported, never thrown */
  {
    const s = spy(422, '{"errors":[{"code":"presence_error","attribute":"email"}]}')
    const r = await pushSubscriber('bad', { cfg: CFG })
    s.restore()
    check('422 is a failure, not a throw', r.outcome === 'failed')
    check('and it says what happened',
      r.outcome === 'failed' && r.detail.includes('422'), JSON.stringify(r))
  }

  /* 4 · no credentials is a no-op, the way email is without a Resend key */
  {
    const r = await pushSubscriber('a@b.test', { cfg: null })
    check('unconfigured is skipped, not failed', r.outcome === 'skipped')
  }

  /* 5 · the address never survives into a stored error (CLAUDE.md rule 9).
         Drip echoes it back in some validation messages, and this string
         lands in a database column and in logs. */
  {
    const leaked = '422 {"errors":[{"message":"maker@example.com is invalid"}]}'
    const clean = redact(leaked, 'maker@example.com')
    check('the address is stripped', !clean.includes('maker@example.com'), clean)
    check('and the reason survives', clean.includes('422'), clean)
    check('long junk is capped', redact('x'.repeat(9000), '').length <= 300)
  }

  /* 6 · half a configuration is a typo, not a configuration */
  {
    const keep = { a: process.env.DRIP_ACCOUNT_ID, t: process.env.DRIP_API_TOKEN }
    process.env.DRIP_ACCOUNT_ID = '4516610'; delete process.env.DRIP_API_TOKEN
    check('an id with no token is not configured', dripConfig() === null)
    delete process.env.DRIP_ACCOUNT_ID; process.env.DRIP_API_TOKEN = 'x'
    check('a token with no id is not configured', dripConfig() === null)
    process.env.DRIP_ACCOUNT_ID = '4516610'
    check('both is configured', dripConfig() !== null)
    if (keep.a) process.env.DRIP_ACCOUNT_ID = keep.a; else delete process.env.DRIP_ACCOUNT_ID
    if (keep.t) process.env.DRIP_API_TOKEN = keep.t; else delete process.env.DRIP_API_TOKEN
  }

  if (failures) { console.error(`drip: ${failures} failure(s)`); process.exit(1) }
  console.log('drip: basic auth, wrapped body, failures recorded, address never stored')
}
main()
