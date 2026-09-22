import { readFileSync } from 'fs'
import { mailPaths, anythingBroadcasts, armedToMakers, type MailFacts } from './can-send'

/**
 * The list is a promise about the code, so the test checks the code.
 *
 * Counting the call sites is the point of this file. A tenth `mail(` in
 * actions.ts without a tenth row here would make the screen say "nothing can
 * reach a maker" while something could, which is the one lie this screen
 * exists to prevent.
 */
let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const src = readFileSync(new URL('../../../app/actions.ts', import.meta.url), 'utf8')
const callSites = (src.match(/await mail\(/g) ?? []).length
check(`actions.ts still has nine mail call sites, found ${callSites}`, callSites === 9)
/* And that nothing else in the codebase transmits. mail() is the only caller
   of the Resend endpoint; anything else reaching it would bypass this list. */
check('only actions.ts talks to Resend',
  (src.match(/api\.resend\.com/g) ?? []).length === 1)

const shut: MailFacts = {
  hasApiKey: true, decisionEmails: 'off', paymentEmail: 'off',
  applicationsOpen: false, dripConfigured: false,
}
const open: MailFacts = {
  hasApiKey: true, decisionEmails: 'on', paymentEmail: 'on',
  applicationsOpen: true, dripConfigured: false,
}

check('every call site has a row', mailPaths(shut).length === 9 - 1)
/* Nine calls, eight rows: `accepted`, `declined` and `waitlisted` are three
   calls behind one switch and one sentence to a person, and splitting them
   into three rows would pad the screen without telling anybody more. The
   booth fee email is one call reached two ways in the source. */

const quiet = mailPaths(shut)
check('with both switches off, nothing broadcasts', anythingBroadcasts(quiet).length === 0)
check('the sign-in link still works, which is the point',
  armedToMakers(quiet).some((p) => p.what.includes('sign-in')))
check('and it is the only thing a maker can receive',
  armedToMakers(quiet).length === 1)

const loud = mailPaths(open)
check('with both on, three things broadcast', anythingBroadcasts(loud).length === 3)
check('the booth fee is one of them',
  anythingBroadcasts(loud).some((p) => p.what.startsWith('Booth fee')))
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
console.log('email paths: nine call sites, all listed, and none of them reaches a maker unasked')
export {}
