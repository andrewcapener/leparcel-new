import { parseCodeSheet, planCodes, summariseCodes, codeNotice, appliable, type Holder } from './codes'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

/* Drew's paste, including the shapes that actually tripped it: a lowercase
   code, a code that is not MM at all, and several hundred lines of other
   tables underneath that also have codes in them. */
const SHEET = [
  'MM',
  "MM1\tSkylark Place\tSkyelar Nalley\tskyelarnalley@gmail.com\t\t\t",
  'MM2\tThe Flaky Apple Pie Co. \tBrooke Cazier\tbrooke@flakyapplepieco.com\t\t',
  'mm8\tEmily Davis Ceramics\tEmily Davis\temilydavisceramics@gmail.com',
  'MM18\tFive sisters make\tEléna \tsam.chanell@gmail.com',
  'MM19\tFive sisters make\tSofia Nelsen\tsam.chanell@gmail.com',
  'B36\tTruly Kustom Jewelry\tTava Macdonald\ttrulykustom@gmail.com',
  'M42\tMERMADE MERCH\tElise Capener\thello@mermademarket.com',
  '',
  'SPRING 2026',
  "ART\tMM1 \tX\t3'x6': $280",
  'MM1\tTREATS ON A SHELF',
  '2026-09-21 12:26 PT\tEléna Nielson\tsam.chanell@gmail.com\t9494665592',
].join('\n')

const parsed = parseCodeSheet(SHEET)

check('only the numbered roster rows are read', parsed.rows.length === 7)
check('the bare MM heading is not a row', !parsed.rows.some((r) => r.code === 'MM'))
check('a lowercase code is taken as the code', parsed.rows.some((r) => r.code === 'MM8'))
check('a code that is not MM is kept as typed', parsed.rows.some((r) => r.code === 'B36'))
check('and so is the one with a single M', parsed.rows.some((r) => r.code === 'M42'))
/* The sheet carries MM1, not MM01. The house format pads; a tent card does
   not, and the tent card wins. */
check('no padding is invented', parsed.rows[0]!.code === 'MM1')
check('the shop and the person are kept', parsed.rows[0]!.shop === 'Skylark Place'
  && parsed.rows[0]!.contact === 'Skyelar Nalley')
check('the address is lower-cased', parsed.rows[0]!.email === 'skyelarnalley@gmail.com')

/* Everything under the roster has codes in it too, and none of it is a row. */
check('last spring’s space table is ignored',
  !parsed.rows.some((r) => r.shop.includes('3')))
check('the sales report is ignored', parsed.rows.length === 7)
check('a timestamped note with an address in it is not a row',
  !parsed.rows.some((r) => r.contact === 'Eléna Nielson'))

const holder = (over: Partial<Holder> = {}): Holder => ({
  bookingId: 'b1', vendorId: 'v1', email: 'skyelarnalley@gmail.com',
  shopName: 'Skylark Place', code: 'MM07', status: 'confirmed', ...over,
})

/* ── the plan ────────────────────────────────────────────────────────── */

const one = planCodes(
  [{ line: 1, code: 'MM1', shop: 'Skylark Place', contact: 'S', email: 'skyelarnalley@gmail.com' }],
  [holder()],
)
check('a maker whose number moved is a change', one[0]!.kind === 'change')
check('and it says what it is moving from',
  one[0]!.kind === 'change' && one[0]!.from === 'MM07')

const already = planCodes(
  [{ line: 1, code: 'MM7', shop: '', contact: '', email: 'skyelarnalley@gmail.com' }],
  [holder({ code: 'MM7' })],
)
check('a maker already on that number is left alone', already[0]!.kind === 'same')
check('and nothing is written for them', appliable(already).length === 0)

const missing = planCodes(
  [{ line: 1, code: 'MM1', shop: '', contact: '', email: 'nobody@example.com' }],
  [holder()],
)
check('an address with no space at this show is held back', missing[0]!.kind === 'nomaker')

/* Eléna and Sofia. One address, two makers, two numbers: the single thing in
   this sheet that cannot be resolved without asking a person. */
const sisters = planCodes(
  [
    { line: 1, code: 'MM18', shop: 'Five sisters make', contact: 'Eléna', email: 'sam.chanell@gmail.com' },
    { line: 2, code: 'MM19', shop: 'Five sisters make', contact: 'Sofia', email: 'sam.chanell@gmail.com' },
  ],
  [
    holder({ bookingId: 'b1', email: 'sam.chanell@gmail.com', code: 'MM20' }),
    holder({ bookingId: 'b2', email: 'sam.chanell@gmail.com', code: 'MM21' }),
  ],
)
check('two makers behind one address are both held back',
  sisters.every((p) => p.kind === 'shared'))
check('and neither is written', appliable(sisters).length === 0)
check('the screen is told who they both are',
  sisters[0]!.kind === 'shared' && sisters[0]!.holders.length === 2)

/* A straight swap: two makers exchanging numbers is the ordinary case in a
   renumbering and must not read as a collision. */
const swap = planCodes(
  [
    { line: 1, code: 'MM2', shop: '', contact: '', email: 'a@example.com' },
    { line: 2, code: 'MM1', shop: '', contact: '', email: 'b@example.com' },
  ],
  [
    holder({ bookingId: 'b1', vendorId: 'v1', email: 'a@example.com', code: 'MM1' }),
    holder({ bookingId: 'b2', vendorId: 'v2', email: 'b@example.com', code: 'MM2' }),
  ],
)
check('two makers swapping numbers is two changes',
  swap.every((p) => p.kind === 'change'))

/* But a number sitting on somebody the sheet never mentions is a real clash,
   and handing it out twice would put two makers on one payment reference. */
const clash = planCodes(
  [{ line: 1, code: 'MM5', shop: '', contact: '', email: 'a@example.com' }],
  [
    holder({ bookingId: 'b1', email: 'a@example.com', code: 'MM1' }),
    holder({ bookingId: 'b2', email: 'stranger@example.com', code: 'MM5' }),
  ],
)
check('a number held by somebody not in the sheet is held back', clash[0]!.kind === 'taken')
check('and the screen names who has it',
  clash[0]!.kind === 'taken' && clash[0]!.by.email === 'stranger@example.com')

const s = summariseCodes([...one, ...already, ...missing, ...sisters])
check('the summary counts what will happen', s.change === 1 && s.same === 1)
check('and what will not', s.nomaker === 1 && s.shared === 2)
check('the notice reads as a sentence',
  codeNotice(s) === '1 to change, 1 already right, 3 needing a person.')
check('an empty paste says so', codeNotice(summariseCodes([])) === 'Nothing to read in that.')

/* The same two sisters, but only one of them holds a space. The address is
   no longer ambiguous in the database, and the sheet still is: without this
   the second row overwrote the first and one sister took the other's
   number, silently. */
const oneSister = planCodes(
  [
    { line: 1, code: 'MM18', shop: 'Five sisters make', contact: 'Eléna', email: 'sam.chanell@gmail.com' },
    { line: 2, code: 'MM19', shop: 'Five sisters make', contact: 'Sofia', email: 'sam.chanell@gmail.com' },
  ],
  [holder({ bookingId: 'b1', email: 'sam.chanell@gmail.com', code: 'MM20' })],
)
check('two rows on one address are held back even with a single booking',
  oneSister.every((p) => p.kind === 'shared'))
check('and nothing is written for either', appliable(oneSister).length === 0)

/* A number on a space somebody gave up is free. The booking row survives
   (rule 3) and keeps the number it was using, and holding a maker back for
   the sake of one who is not coming would be the wrong way round. */
const released = planCodes(
  [{ line: 1, code: 'MM5', shop: '', contact: '', email: 'a@example.com' }],
  [
    holder({ bookingId: 'b1', email: 'a@example.com', code: 'MM1' }),
    holder({ bookingId: 'b2', email: 'gone@example.com', code: 'MM5', status: 'cancelled' }),
  ],
)
check('a cancelled space does not hold on to its number', released[0]!.kind === 'change')
const forfeited = planCodes(
  [{ line: 1, code: 'MM5', shop: '', contact: '', email: 'a@example.com' }],
  [
    holder({ bookingId: 'b1', email: 'a@example.com', code: 'MM1' }),
    holder({ bookingId: 'b2', email: 'gone@example.com', code: 'MM5', status: 'forfeited' }),
  ],
)
check('and neither does a forfeited one', forfeited[0]!.kind === 'change')

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('maker numbers: only the roster rows are read, and nothing ambiguous is ever written')
