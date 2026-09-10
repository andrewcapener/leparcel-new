import {
  normalizePermit, checkPermit, owesPermit, permitSettled,
  permitState, permitCleared, permitAnswered,
} from './permit'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

/* The same permit written four ways is one permit. */
const shapes = ['123456789', '123-456789', '123 456 789', ' 123-456-789 ']
check('every common shape normalises to the same digits',
  new Set(shapes.map(normalizePermit)).size === 1)

check('a plain nine digit permit is accepted', checkPermit('123456789').ok)
check('a dashed permit is accepted', checkPermit('123-456789').ok)
check('a spaced permit is accepted', checkPermit('123 456 789').ok)
check('surrounding space is fine', checkPermit('  123456789  ').ok)
check('eight digits is accepted', checkPermit('12345678').ok)
check('twelve digits is accepted', checkPermit('123456789012').ok)

/* The two things that actually get typed in the wrong box. */
check('a short fragment is rejected', !checkPermit('1234').ok)
check('a thirteen digit number is rejected', !checkPermit('1234567890123').ok)
check('empty is rejected', !checkPermit('').ok)
check('letters alone are rejected', !checkPermit('SRY ABOUT THIS').ok)

/* A rejection always says what to do next, never just "invalid". */
for (const bad of ['', '1234', '1234567890123']) {
  const r = checkPermit(bad)
  check(`"${bad}" is rejected with a reason`, !r.ok && r.reason.length > 10)
}

/* Who owes one. Wrong in either direction is expensive: asking an indoor
   maker is pointless paperwork, and NOT asking an outdoor one is up to
   $1,000 under CDTFA Publication 111. */
check('outdoor owes a permit', owesPermit('outdoor'))
check('both owes one, because they are outdoor for part of the show', owesPermit('both'))
check('indoor owes nothing: Mermade is the retailer of record', !owesPermit('indoor'))
check('an unknown track is not asked for one', !owesPermit(''))

check('a permit on file settles it', permitSettled('123456789', false))
check('an occasional seller claim settles it', permitSettled('', true))
check('whitespace alone does not settle it', !permitSettled('   ', false))
check('nothing does not settle it', !permitSettled('', false))

/* ── what we actually know, from three fields that mean different things ──
   The bug this replaces: `Boolean(sellerPermit) || occasionalSeller` read a
   maker who answered "I am an occasional seller" as never asked, because
   nothing in the application sets occasionalSeller. */
const st = (over: Partial<Parameters<typeof permitState>[0]>) => permitState({
  track: 'outdoor', permitStatus: null, sellerPermit: '', occasionalSeller: false, ...over,
})

check('indoor is never required', st({ track: 'indoor' }) === 'not_required')
check('a number on file is on_file', st({ permitStatus: 'have', sellerPermit: '123456789' }) === 'on_file')
check('"have" without a number is promised', st({ permitStatus: 'have' }) === 'promised')
check('"occasional" is a declaration, not a document',
  st({ permitStatus: 'occasional' }) === 'occasional_declared')
check('a signed 410-D is documented', st({ occasionalSeller: true }) === 'occasional_documented')
check('"unsure" is its own state', st({ permitStatus: 'unsure' }) === 'unsure')
check('outdoor with no answer is unanswered', st({}) === 'unanswered')

/* A number beats everything else, because it is the record Publication 111
   actually asks for. */
check('a number wins over a stale "unsure"',
  st({ permitStatus: 'unsure', sellerPermit: '123456789' }) === 'on_file')

/* Cleared is strict: a declaration is not a document. */
check('on_file clears', permitCleared('on_file'))
check('a signed 410-D clears', permitCleared('occasional_documented'))
check('indoor clears', permitCleared('not_required'))
check('DECLARING occasional does not clear: 111 wants the record, not the intention',
  !permitCleared('occasional_declared'))
check('promised does not clear', !permitCleared('promised'))
check('unsure does not clear', !permitCleared('unsure'))
check('unanswered does not clear', !permitCleared('unanswered'))

/* Answered means stop asking them and start doing our bit. */
check('a declaration counts as answered', permitAnswered('occasional_declared'))
check('unsure counts as answered', permitAnswered('unsure'))
check('never asked does not', !permitAnswered('unanswered'))

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log("seller's permit: every written shape is one permit, and what a maker already told us is never asked again")
export {}
