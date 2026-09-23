import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { mailPaths, anythingBroadcasts, armedToMakers, type MailFacts } from './can-send'

/**
 * The list is a promise about the code, so the test checks the code.
 *
 * Counting the ways out is the point of this file. A tenth `mail(` in
 * actions.ts, or a second module that reaches api.resend.com, without a row
 * here would make the screen say "nothing can reach a maker" while something
 * could, which is the one lie this screen exists to prevent.
 */
let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const src = readFileSync(new URL('../../../app/actions.ts', import.meta.url), 'utf8')
const callSites = (src.match(/await mail\(/g) ?? []).length
check(`actions.ts still has nine mail call sites, found ${callSites}`, callSites === 9)
check('actions.ts reaches Resend exactly once',
  (src.match(/api\.resend\.com/g) ?? []).length === 1)

/* And that exactly two modules transmit at all. mail() sends one message;
   sendChase() sends a batch, which is a different endpoint and could not
   reuse it. A third file reaching api.resend.com would bypass this list, so
   the whole tree is counted rather than trusted. */
const tree = readdirSync(new URL('../../../', import.meta.url), {
  recursive: true, withFileTypes: true,
})
const senders = tree
  .filter((e) => e.isFile() && /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name))
  .map((e) => join(e.parentPath, e.name))
  .filter((f) => readFileSync(f, 'utf8').includes('api.resend.com'))
  .map((f) => f.replace(/^.*\/src\//, 'src/'))
  .sort()
check(`exactly two modules transmit, found ${senders.join(', ')}`,
  senders.length === 2
  && senders.some((f) => f.endsWith('app/actions.ts'))
  && senders.some((f) => f.endsWith('email/chase-send.ts')))

const shut: MailFacts = {
  hasApiKey: true, decisionEmails: 'off', paymentEmail: 'off',
  applicationsOpen: false, dripConfigured: false,
}
const open: MailFacts = {
  hasApiKey: true, decisionEmails: 'on', paymentEmail: 'on',
  applicationsOpen: true, dripConfigured: false,
}

check('every way out has a row', mailPaths(shut).length === 9)
/* Nine calls plus the batch, nine rows: `accepted`, `declined` and
   `waitlisted` are three calls behind one switch and one sentence to a
   person, and splitting them into three rows would pad the screen without
   telling anybody more. The booth fee email is one call reached two ways in
   the source. The chase is its own row because it is its own transport. */

const quiet = mailPaths(shut)
/* The chase is the one thing here that is not behind a switch, because its
   gate is a person reading a list of names on a screen. So with every switch
   off it is still the only thing armed, and that is the honest answer. */
check('with both switches off, only the chase can reach a crowd',
  anythingBroadcasts(quiet).length === 1
  && anythingBroadcasts(quiet)[0]!.what.startsWith('Booth fee chase'))
check('the sign-in link still works, which is the point',
  armedToMakers(quiet).some((p) => p.what.includes('sign-in')))
check('and the only other thing a maker can receive is the chase',
  armedToMakers(quiet).length === 2)

const loud = mailPaths(open)
check('with both on, four things broadcast', anythingBroadcasts(loud).length === 4)
check('the booth fee is one of them',
  anythingBroadcasts(loud).some((p) => p.what === 'Booth fee, with their pay link'))
check('and so is the chase',
  anythingBroadcasts(loud).some((p) => p.what.startsWith('Booth fee chase')))
/* Never on its own, whatever else is true. Somebody ticks the names. */
for (const f of [shut, open]) {
  const chase = mailPaths(f).find((p) => p.what.startsWith('Booth fee chase'))!
  check('the chase always needs a person', chase.sets === 'staff press a button')
}
check('releasing a space is one of them',
  anythingBroadcasts(loud).some((p) => p.what.startsWith('Space released')))

/* The importer is not a switch. Seventy eight bookings at once is the worst
   place to discover a setting was on, so it cannot send in any state. */
for (const f of [shut, open]) {
  const bulk = mailPaths(f).find((p) => p.what.includes('whole roster'))!
  check('the bulk importer never sends', bulk.armed === false)
}

/* No key beats every switch, because one function does all the sending. */
const keyless = mailPaths({ ...open, hasApiKey: false })
check('no Resend key means nothing at all is armed', keyless.every((p) => !p.armed))

/* Closed applications shut the two paths a stranger could trigger. */
const closed = mailPaths({ ...open, applicationsOpen: false })
check('a closed window disarms the receipt',
  !closed.find((p) => p.what.startsWith('We have your'))!.armed)
check('and the staff notice with it',
  !closed.find((p) => p.what === 'New application')!.armed)

check('nothing says "on its own" to a maker in any state',
  [...quiet, ...loud].every((p) => !(p.to === 'the maker' && p.sets === 'on its own')))

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('email paths: two transports, all listed, and none of them reaches a maker unasked')
export {}
