/**
 * The Mermade ID is minted from a COUNT, and a count is a string.
 *
 * Postgres returns count(*) as a bigint and the driver hands it back as a
 * JavaScript string, so `n + 1` concatenates instead of adding. With eighty
 * four bookings on the show, the eighty fifth maker was given MM841 rather
 * than MM85. Nine makers on Fall 26 carry a code of that shape: MM791, MM841,
 * MM851, MM861, MM871, MM881, MM891, MM901, MM911, each one the count of the
 * moment with a 1 stuck on the end.
 *
 * That is not cosmetic. The code is what a maker types into a Venmo or Zelle
 * note and it is the only thing that matches their money to their booking,
 * so a wrong code is money nobody can reconcile.
 *
 * Nothing caught it. The types said `number`, tsc was happy, and every test
 * that built a code built it from a real number. It only appears against a
 * real database, and only from the eleventh booking onward, because below ten
 * the padStart hid it: "9" + 1 is "91", which still looks like a code.
 */
import { nextVendorCode } from './mm-code'

let failures = 0
function ok(what: string, cond: boolean, detail = '') {
  if (!cond) { console.error(`FAIL ${what}${detail ? `\n     ${detail}` : ''}`); failures++ }
}
const eq = (what: string, got: unknown, want: unknown) =>
  ok(what, Object.is(got, want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)

/* A count as the driver actually returns it. */
eq('a string count still counts', nextVendorCode('12', []), 'MM13')
eq('and the real one that broke', nextVendorCode('84', []), 'MM85')
eq('and the first of them', nextVendorCode('79', []), 'MM80')
eq('a number works too', nextVendorCode(12, []), 'MM13')
eq('the very first maker', nextVendorCode('0', []), 'MM01')
eq('single digits pad', nextVendorCode('8', []), 'MM09')
eq('and it does not stop at 99', nextVendorCode('99', []), 'MM100')

/* A count is not a free number: releasing a booking drops the count while
   the code it used stays with that maker forever. */
eq('a code already handed out is skipped', nextVendorCode('12', ['MM13']), 'MM14')
eq('and a run of them', nextVendorCode('12', ['MM13', 'MM14', 'MM15']), 'MM16')
eq('case does not matter', nextVendorCode('12', ['mm13']), 'MM14')
eq('unrelated codes do not push it along', nextVendorCode('12', ['MM99']), 'MM13')

/* The shape itself: two digits minimum, no stray characters, ever. */
{
  let bad = ''
  for (let i = 0; i < 400; i++) {
    const c = nextVendorCode(String(i), [])
    /* Against the answer itself, not against the shape of the bug: at a count
       of 0 the broken version also produced MM01, so testing for the bug's
       shape reports a failure on the one input where it never showed. */
    if (c !== `MM${String(i + 1).padStart(2, '0')}` || !/^MM\d{2,}$/.test(c)) {
      bad = `${i} -> ${c}`
      break
    }
  }
  ok('400 counts in a row each give the number after the count', bad === '', bad)
}

if (failures > 0) { console.error(`\n${failures} failure(s).`); process.exit(1) }
console.log('mm code: a string count never becomes MM841, and a used code is never handed out twice')
