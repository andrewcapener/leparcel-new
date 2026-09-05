/**
 * Unit test for the retry state machine and the idempotency key.
 *
 * The mapping is what the sheet looks like; this is what happens when Google
 * is down, which is the half nobody exercises by hand. Pure functions, so it
 * runs in milliseconds with no database and no network.
 *
 * Run with `npm test`. Dependency-free, in the style of money.test.ts.
 */
import {
  MAX_ATTEMPTS, backoffMs, initialState, nextState, isDue, idempotencyKey,
} from './retry'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  if (!ok) { failures++; console.error(`  ✗ ${name} ${detail}`) }
}

const T0 = '2026-09-07T17:00:00.000Z'
const at = (ms: number) => new Date(new Date(T0).getTime() + ms).toISOString()
const down = { ok: false as const, detail: 'fetch failed (ECONNREFUSED)', retryable: true }
const broken = { ok: false as const, detail: 'HTTP 403: share the Sheet', retryable: false }

// 1 · a fresh application is pending and immediately due
{
  const s = initialState(T0)
  check('starts pending', s.status === 'pending', s.status)
  check('starts at zero attempts', s.attempts === 0, String(s.attempts))
  check('is due at once', isDue(s, T0))
}

// 2 · the happy path
{
  const s = nextState(initialState(T0), { ok: true }, T0)
  check('sent', s.status === 'sent', s.status)
  check('records when', s.sentAt === T0, String(s.sentAt))
  check('clears the error', s.lastError === '')
  check('stops retrying', s.nextAttemptAt === null)
  check('a sent row is never due', !isDue(s, at(999 * 60_000)))
}

// 3 · a retryable failure waits, and waits longer each time
{
  let s = nextState(initialState(T0), down, T0)
  check('still pending', s.status === 'pending', s.status)
  check('counted the attempt', s.attempts === 1, String(s.attempts))
  check('kept the reason', s.lastError.includes('ECONNREFUSED'), s.lastError)
  check('waits a minute', s.nextAttemptAt === at(60_000), String(s.nextAttemptAt))
  check('not due yet', !isDue(s, at(30_000)))
  check('due after the wait', isDue(s, at(60_000)))

  s = nextState(s, down, at(60_000))
  check('second wait is longer',
    new Date(s.nextAttemptAt!).getTime() - new Date(at(60_000)).getTime() === backoffMs(2),
    String(s.nextAttemptAt))
  check('backoff grows', backoffMs(1) < backoffMs(2) && backoffMs(2) < backoffMs(3))
  check('backoff is capped', backoffMs(99) === backoffMs(50))
}

// 4 · an outage that never ends gives up, and gives up exactly once
{
  let s = initialState(T0)
  let t = 0
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    check(`attempt ${i + 1} still queued`, s.status === 'pending', s.status)
    s = nextState(s, down, at(t))
    t += backoffMs(s.attempts)
  }
  check('gives up at the cap', s.status === 'failed', s.status)
  check('attempts equal the cap', s.attempts === MAX_ATTEMPTS, String(s.attempts))
  check('stops scheduling', s.nextAttemptAt === null)
  check('a failed row is not auto-retried', !isDue(s, at(t + 99 * 3_600_000)))
}

// 5 · an error a human has to fix does not burn eight retries
{
  const s = nextState(initialState(T0), broken, T0)
  check('fails fast', s.status === 'failed', s.status)
  check('after one attempt', s.attempts === 1, String(s.attempts))
  check('says why', s.lastError.includes('403'), s.lastError)
}

// 6 · a recovery after failures records the success and forgets the error
{
  let s = nextState(initialState(T0), down, T0)
  s = nextState(s, down, at(60_000))
  s = nextState(s, { ok: true }, at(360_000))
  check('recovers to sent', s.status === 'sent', s.status)
  check('keeps the attempt count', s.attempts === 3, String(s.attempts))
  check('error cleared', s.lastError === '')
}

// 7 · the error text is bounded, so one HTML error page cannot bloat a row
{
  const s = nextState(initialState(T0), { ok: false, detail: 'x'.repeat(5_000), retryable: true }, T0)
  check('error is bounded', s.lastError.length <= 400, String(s.lastError.length))
}

// 8 · the idempotency key is deterministic and per application. This is what
//     stops a retry after a timeout from appending the same maker twice.
{
  check('deterministic', idempotencyKey('app-1') === idempotencyKey('app-1'))
  check('per application', idempotencyKey('app-1') !== idempotencyKey('app-2'))
  check('is the application id', idempotencyKey('app-1') === 'app-1')
}

if (failures) { console.error(`\n${failures} failing assertions`); process.exit(1) }
console.log('sheets: retry policy holds (backoff, give-up, recovery, idempotency)')
