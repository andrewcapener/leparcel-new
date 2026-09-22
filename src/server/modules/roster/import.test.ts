import {
  parseCsv, parseAcceptSheet, centsFrom, sameLabel, asideLabel, planImport, summarise,
  sniffSeparator, type Lookups,
} from './import'

/**
 * This reads a spreadsheet and turns it into seventy eight bookings with real
 * money on them, so every way a spreadsheet can be wrong is worth a test.
 */
let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

/* Google Sheets quoting. A real shop on this roster is
   "Brighton Awad (Melissa, mom)", whose comma would split the row. */
const q = parseCsv('a,b\n"Brighton Awad (Melissa, mom)",2\n')
check('a quoted comma does not split the row', q[1]!.length === 2)
check('and the value survives whole', q[1]![0] === 'Brighton Awad (Melissa, mom)')
check('a doubled quote is one quote', parseCsv('x\n"say ""hi"""\n')[1]![0] === 'say "hi"')
check('carriage returns do not make empty rows', parseCsv('a,b\r\n1,2\r\n').length === 2)
check('trailing blank lines are dropped', parseCsv('a\n1\n\n\n').length === 2)

/* Money. Never a float multiply (rule 1). */
check('dollars become cents', centsFrom('280.00') === 28000)
check('a dollar sign and commas are fine', centsFrom('$1,020.00') === 102000)
check('whole dollars work', centsFrom('450') === 45000)
/* The one that catches a float bug: 3.4 * 100 is 339.99999999999994. */
check('no float drift', centsFrom('3.40') === 340)
check('zero is a real fee, not a blank', centsFrom('0.00') === 0)
check('blank is not zero', centsFrom('') === null)
check('words are rejected', centsFrom('free') === null)
check('three decimals are rejected', centsFrom('10.001') === null)
check('negatives are rejected', centsFrom('-50') === null)
check('absurd amounts are rejected', centsFrom('1000000') === null)

/* Labels travel between two spreadsheets and a database. */
check('case and spacing do not matter', sameLabel('Outdoor  Saturday', 'outdoor saturday'))
check('but different spaces still differ', !sameLabel('3x4', '3x6'))

/* The sheet itself. */
const good = [
  'Set fee?,List,Track,Shop,Contact,Sign-in email,Book this space,CHARGE,Note',
  'YES,Elise,indoor,Trophy Goods,Shea,shea@crabandcleek.com,3x8,340.00,',
  ',Hillary,outdoor,Toradi,Justine,hello@toradiskin.com,Outdoor Friday,400.00,',
].join('\n')
const ok = parseAcceptSheet(good)
check('a clean sheet parses', ok.problems.length === 0 && ok.rows.length === 2)
check('the email is lowercased', ok.rows[0]!.email === 'shea@crabandcleek.com')
check('the space comes through', ok.rows[1]!.spaceLabel === 'Outdoor Friday')

/* Columns are found by NAME. A column moving must not shift every fee. */
const moved = [
  'CHARGE,Sign-in email,Book this space',
  '510.00,a@b.com,Outdoor Sunday',
].join('\n')
const mv = parseAcceptSheet(moved)
check('columns are matched by heading, not position',
  mv.rows[0]!.amount === '510.00' && mv.rows[0]!.email === 'a@b.com')

/* Everything that should be refused rather than guessed. */
check('a missing CHARGE column is refused',
  parseAcceptSheet('Sign-in email,Book this space\na@b.com,3x6').problems.length === 1)
check('nothing pasted is refused', parseAcceptSheet('').problems.length === 1)
const dup = parseAcceptSheet([
  'Sign-in email,Book this space,CHARGE',
  'a@b.com,3x6,280', 'a@b.com,3x4,260',
].join('\n'))
check('the same maker twice is caught', dup.problems.some((p) => p.detail.includes('twice')))
check('and only the first is kept', dup.rows.length === 1)
const missing = parseAcceptSheet([
  'Shop,Sign-in email,Book this space,CHARGE',
  'Nameless,,3x6,280', 'Spaceless,c@d.com,,280',
].join('\n'))
check('a row with no email is reported', missing.problems.some((p) => p.detail.includes('no email')))
check('a row with no space is reported', missing.problems.some((p) => p.detail.includes('no space')))
check('and neither is imported', missing.rows.length === 0)

/* ── planning against the show ── */
const look: Lookups = {
  applications: new Map([
    ['shea@crabandcleek.com', { id: 'app1', vendorId: 'v1', status: 'new' }],
    ['hello@toradiskin.com', { id: 'app2', vendorId: 'v2', status: 'new' }],
    ['done@already.com', { id: 'app3', vendorId: 'v3', status: 'accepted' }],
  ]),
  booked: new Set(['done@already.com']),
  spaces: [
    { id: 's1', label: '3x8', priceCents: 34000 },
    { id: 's2', label: 'Outdoor Friday', priceCents: 40000 },
  ],
  vendorCodes: new Map([['v1', 'MM07'], ['v2', null]]),
}
const rows = parseAcceptSheet([
  'Shop,Sign-in email,Book this space,CHARGE',
  'Trophy Goods,shea@crabandcleek.com,3x8,340.00',
  'Toradi,hello@toradiskin.com,outdoor friday,400.00',
  'Already,done@already.com,3x8,340.00',
  'Stranger,nobody@nowhere.com,3x8,340.00',
  'Bad space,shea2@crabandcleek.com,Gazebo,340.00',
].join('\n')).rows
look.applications.set('shea2@crabandcleek.com', { id: 'app4', vendorId: 'v4', status: 'new' })
const plan = planImport(rows, look)

check('a clean row books', plan[0]!.kind === 'book')
check('the space is resolved despite casing', plan[1]!.kind === 'book')
check('an existing booking is left alone, not doubled', plan[2]!.kind === 'already')
check('somebody who never applied is a problem, not a new vendor', plan[3]!.kind === 'problem')
check('an unknown space is a problem, not a guess', plan[4]!.kind === 'problem')
check('and it says which label failed',
  plan[4]!.kind === 'problem' && plan[4]!.detail.includes('Gazebo'))

/* The fee in the sheet wins over the space's list price. That is the whole
   point: it already carries the credits and the discounts. */
const first = plan[0]!
check('the sheet fee is what gets charged',
  first.kind === 'book' && first.priceCents === 34000)
check('and the list price is carried for the review screen',
  first.kind === 'book' && first.defaultCents === 34000)

const s = summarise(plan)
check('the summary counts what will happen', s.willBook === 2 && s.already === 1 && s.problems === 2)
check('and totals the money', s.totalCents === 74000)

/* An overridden fee must be counted, because staff recognise that number. */
const over = planImport(parseAcceptSheet([
  'Shop,Sign-in email,Book this space,CHARGE',
  'Trophy Goods,shea@crabandcleek.com,3x8,480.00',
].join('\n')).rows, look)
check('a fee above the list price is flagged as overridden', summarise(over).overridden === 1)
check('and a fee equal to it is not',
  summarise(planImport(parseAcceptSheet([
    'Shop,Sign-in email,Book this space,CHARGE',
    'Trophy Goods,shea@crabandcleek.com,3x8,340.00',
  ].join('\n')).rows, look)).overridden === 0)
/* Zero is a real fee and must still book. */
check('a zero fee books rather than failing',
  planImport(parseAcceptSheet([
    'Shop,Sign-in email,Book this space,CHARGE',
    'Trophy Goods,shea@crabandcleek.com,3x8,0.00',
  ].join('\n')).rows, look)[0]!.kind === 'book')

/* Copying rows out of Google Sheets puts TABS on the clipboard, not commas,
   and that is the path the girls will actually take. Read as commas, the
   whole paste is one column and every row reports "has no email". */
check('a tab heading row is sniffed as tabs', sniffSeparator('Shop\tSign-in email\tCHARGE') === '\t')
check('a comma heading row stays commas', sniffSeparator('Shop,Sign-in email,CHARGE') === ',')
check('a comma inside a quoted heading does not swing the vote',
  sniffSeparator('"Shop, trading as"\tSign-in email\tCHARGE') === '\t')
const tabbed = parseAcceptSheet([
  'Shop\tSign-in email\tBook this space\tCHARGE',
  'Trophy Goods\tshea@crabandcleek.com\t3x8\t$340.00',
].join('\n'))
check('a tabbed paste reads one clean row', tabbed.rows.length === 1 && tabbed.problems.length === 0)
check('and the fee survives the tabs', tabbed.rows[0]!.amount === '$340.00')
/* A shop name with a comma in it, pasted as tabs: the comma must be data. */
const tabbedComma = parseAcceptSheet([
  'Shop\tSign-in email\tBook this space\tCHARGE',
  'Brighton Awad (Melissa, mom)\tshea@crabandcleek.com\t3x8\t340.00',
].join('\n'))
check('a comma in a tabbed shop name is just a comma',
  tabbedComma.rows[0]!.shop === 'Brighton Awad (Melissa, mom)')

/* The girls annotate a space when the fee is unusual: "3x6 (half off)" is on
   the real sheet. The space is named; only the reason is in the bracket. */
check('a trailing note on the label still finds the space', asideLabel('3x6 (half off)', '3x6'))
check('spacing inside the bracket does not matter', asideLabel('3x6(half off)', '3x6'))
check('a bracket in the middle is not a trailing note',
  asideLabel('3x6 (half) off', '3x6') === false)
check('it never matches a different space', asideLabel('3x8 (half off)', '3x6') === false)
check('and it is not a substring match', asideLabel('3x6 half off', '3x6') === false)
const annotated = planImport(parseAcceptSheet([
  'Shop,Sign-in email,Book this space,CHARGE',
  'Trophy Goods,shea@crabandcleek.com,3x8 (half off),170.00',
].join('\n')).rows, look)[0]!
check('an annotated row books', annotated.kind === 'book')
check('at the space it resolved to, printed plainly',
  annotated.kind === 'book' && annotated.spaceLabel === '3x8')
check('and at the fee the sheet typed, not half the list',
  annotated.kind === 'book' && annotated.priceCents === 17000)

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('roster import: the sheet is read by heading, and a fee never drifts through a float')
export {}
