/**
 * What leaves this process must be hashed, and must never be sent twice.
 *
 * Two failures this guards against, both expensive and both silent.
 *
 * Meta requires SHA-256 of the lowercased, trimmed value. Send a raw address
 * and it is rejected AND the address has left the building, which is a rule 9
 * violation on top of a broken integration.
 *
 * And the browser pixel and the server both report the same application, so
 * they share one event_id and Meta keeps one. Get that wrong and every
 * application counts twice, which halves every reported cost per application
 * and makes a campaign look twice as good as it is.
 */

export {}   // a module, so its locals do not collide with the other test scripts

import { createHash } from 'crypto'
import { hash, hashPhone, newEventId, sendLead } from './capi'

let failures = 0
const check = (what: string, ok: boolean, detail = '') => {
  if (!ok) { failures++; console.error(`  FAIL ${what}${detail ? `: ${detail}` : ''}`) }
}
const sha = (v: string) => createHash('sha256').update(v).digest('hex')

/* ── hashing ───────────────────────────────────────────────────────────── */
check('an address is sha-256 of its lowercased form',
  hash('Maker@Example.COM') === sha('maker@example.com'))
check('surrounding space is trimmed first', hash('  a@b.co ') === sha('a@b.co'))
check('it is hex, 64 chars', /^[0-9a-f]{64}$/.test(hash('a@b.co')))
check('the raw value never appears in the output', !hash('a@b.co').includes('a@b.co'))

/* A phone loses everything that is not a digit. Meta matches on digits, so
   "(949) 555-0148" and "9495550148" have to hash identically or the same
   person looks like two. */
check('a phone is digits only',
  hashPhone('(949) 555-0148') === hashPhone('9495550148'))
check('and it is hashed, not sent', hashPhone('9495550148') === sha('9495550148'))
check('a phone with no digits is nothing', hashPhone('n/a') === null)

/* ── event ids ─────────────────────────────────────────────────────────── */
check('event ids are unique', newEventId() !== newEventId())

/* ── the request ───────────────────────────────────────────────────────── */
async function main() {
  const before = { p: process.env.MERMADE_DATASET_ID, t: process.env.MERMADE_META_ACCESS_TOKEN }

  // Unconfigured: nothing is sent at all.
  delete process.env.MERMADE_DATASET_ID
  delete process.env.MERMADE_META_ACCESS_TOKEN
  let called = false
  const real = globalThis.fetch
  globalThis.fetch = (async () => { called = true; return new Response('{}', { status: 200 }) }) as typeof fetch
  const skipped = await sendLead({ email: 'a@b.co' })
  check('unconfigured is skipped', skipped.outcome === 'skipped')
  check('and sends nothing', !called)

  // Configured.
  process.env.MERMADE_DATASET_ID = '111222333'
  process.env.MERMADE_META_ACCESS_TOKEN = 'tok'
  let seen: { url: string; body: string } | null = null
  globalThis.fetch = (async (u: string | URL, init: RequestInit) => {
    seen = { url: String(u), body: String(init.body) }
    return new Response('{"events_received":1}', { status: 200 })
  }) as unknown as typeof fetch

  const r = await sendLead({
    email: ' Maker@Example.com ', phone: '(949) 555-0148',
    eventId: 'shared-id', sourceUrl: 'https://mermademarket.com/apply',
    fbp: 'fb.1.2.3', fbc: 'fb.1.2.click',
  })
  check('a 200 is a success', r.outcome === 'sent')
  check('the shared event id is kept', r.outcome === 'sent' && r.eventId === 'shared-id')

  const s = seen as unknown as { url: string; body: string }
  check('it posts to the pixel dataset', s.url.includes('/111222333/events'), s.url)
  const b = JSON.parse(s.body)
  const ev = b.data[0]
  check('the event is a Lead', ev.event_name === 'Lead')
  check('the event id rides along', ev.event_id === 'shared-id')
  check('the address is hashed', ev.user_data.em[0] === sha('maker@example.com'))
  check('the RAW address is nowhere in the payload', !s.body.includes('Maker@Example.com'))
  check('and not in lowercase either', !s.body.toLowerCase().includes('maker@example.com'))
  check('the phone is hashed', ev.user_data.ph[0] === sha('9495550148'))
  check('the raw phone is nowhere', !s.body.includes('555-0148'))
  check('the click id is passed through', ev.user_data.fbc === 'fb.1.2.click')

  /* Limited Data Use, on every event. Mermade is a California business and
     CPRA applies; 1/1000 is Meta's code for United States / California. */
  check('LDU is set', Array.isArray(ev.data_processing_options)
    && ev.data_processing_options[0] === 'LDU')
  check('country is US', ev.data_processing_options_country === 1)
  check('state is California', ev.data_processing_options_state === 1000)

  // Failures are reported, never thrown.
  globalThis.fetch = (async () => new Response('bad request', { status: 400 })) as typeof fetch
  const bad = await sendLead({ email: 'a@b.co' })
  check('a 400 is a failure, not a throw', bad.outcome === 'failed')

  globalThis.fetch = (async () => { throw new Error('boom') }) as typeof fetch
  const down = await sendLead({ email: 'a@b.co' })
  check('a network error is a failure, not a throw', down.outcome === 'failed')

  globalThis.fetch = real
  if (before.p) process.env.MERMADE_DATASET_ID = before.p; else delete process.env.MERMADE_DATASET_ID
  if (before.t) process.env.MERMADE_META_ACCESS_TOKEN = before.t; else delete process.env.MERMADE_META_ACCESS_TOKEN

  if (failures) { console.error(`meta capi: ${failures} failure(s)`); process.exit(1) }
  console.log('meta capi: hashed, deduplicated, LDU on every event, never throws')
}
main()
