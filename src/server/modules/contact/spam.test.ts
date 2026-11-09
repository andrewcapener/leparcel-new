import assert from 'node:assert/strict'
import { MIN_FILL_MS, readSubmission, readsAsNoise } from './spam'

/**
 * The asymmetry is the whole point of this file. A spam message reaching an
 * inbox costs somebody one press of a delete key. A real maker silently
 * dropped costs us a maker, and we never find out. So the real names below
 * matter more than the junk ones.
 */

/* The exact submission Drew screenshotted, 9 November. */
const real = {
  name: 'Elise Capener',
  email: 'elise@mermademarket.com',
  message: 'Can I bring a second rack on Saturday?',
  elapsedMs: 45_000,
}
assert.deepEqual(
  readSubmission({
    name: 'FgTkXBuVVsDqoIXwXtYi',
    email: 'louise.bell@ifm.com',
    message: 'jRMZRghinyotErLr',
    elapsedMs: 40_000,
  }),
  { spam: true, why: 'name and message both read as random characters' },
)

/* ── Nobody real is turned away ─────────────────────────────────────────── */

assert.deepEqual(readSubmission(real), { spam: false })

for (const name of [
  'Christopher Nguyen', 'Krzysztof', 'Schwarzenegger', 'MacDonald', "O'Brien",
  'McDonough', 'Chelsy Erickson', 'Jean-Baptiste', 'Hillary Salway',
  'Mary-Kate Olsen', 'Bartholomew', 'Przybylski', 'Vandenberghe',
]) {
  assert.deepEqual(
    readSubmission({ ...real, name }),
    { spam: false },
    `turned away ${name}`,
  )
}

/* A name a machine would call strange, with a message that reads as English,
   goes through. This is the case the "both" rule exists for. */
assert.deepEqual(
  readSubmission({ ...real, name: 'Zbgniew Brzzynski' }),
  { spam: false },
)
/* And the reverse: a real name with a one-word message. */
assert.deepEqual(readSubmission({ ...real, message: 'Hi' }), { spam: false })
assert.deepEqual(readSubmission({ ...real, message: 'Thanks!!!' }), { spam: false })

/* Any script but Latin is never judged on its vowels, because the test means
   nothing there and a filter that cannot read a script does not get a vote. */
for (const name of ['张伟东先生好', 'Αλέξανδρος', 'Достоевский']) {
  assert.equal(readsAsNoise(name), false, `judged ${name}`)
  assert.deepEqual(readSubmission({ ...real, name, message: name }), { spam: false })
}

/* Short is never judged. There is not enough in nine letters to be sure. */
assert.equal(readsAsNoise('XbTqZvRpL'), false)

/* ── And the machines are ───────────────────────────────────────────────── */

for (const junk of ['FgTkXBuVVsDqoIXwXtYi', 'jRMZRghinyotErLr', 'QzWxRtYpLkJhGfDs', 'aBcDeFgHiJkLmN']) {
  assert.equal(readsAsNoise(junk), true, `let ${junk} through`)
}

/* The hidden field beats everything else: a person cannot reach it. */
assert.deepEqual(
  readSubmission({ ...real, honeypot: 'Mermade Market' }),
  { spam: true, why: 'hidden field was filled in' },
)
assert.deepEqual(readSubmission({ ...real, honeypot: '   ' }), { spam: false })
assert.deepEqual(readSubmission({ ...real, honeypot: '' }), { spam: false })

/* Too fast to have been typed. */
assert.equal(readSubmission({ ...real, elapsedMs: 40 }).spam, true)
assert.equal(readSubmission({ ...real, elapsedMs: MIN_FILL_MS - 1 }).spam, true)
assert.equal(readSubmission({ ...real, elapsedMs: MIN_FILL_MS }).spam, false)
/* A missing or nonsense reading is never held against the visitor: the form
   needs JavaScript to submit at all, so a blank here is our bug, not theirs. */
for (const elapsedMs of [undefined, NaN, -1, Infinity]) {
  assert.deepEqual(readSubmission({ ...real, elapsedMs }), { spam: false }, `${elapsedMs}`)
}

console.log('contact spam: the bot is dropped, and nobody with an unusual name is')
