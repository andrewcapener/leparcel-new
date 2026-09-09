import { normalizePermit, checkPermit, owesPermit, permitSettled } from './permit'

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

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log("seller's permit: every written shape is one permit, and only outdoor is asked")
export {}
