import { blankRows, byCode, codeOrder, money, printMakers, sheetSummary } from './inventory-print'
import type { InventoryRow, MakerListRow } from './inventory-export'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

/* ── display money, off the export's spreadsheet dollars ──────────────── */

check('whole dollars lose the cents', money('7.00') === '$7')
check('odd cents keep them', money('7.50') === '$7.50')
check('a single cent survives', money('0.01') === '$0.01')
check('four figures are left alone', money('1200.00') === '$1200')
/* A maker with nothing filed has no cheapest price, and the cover page has to
   render that as a blank rather than as "$". */
check('nothing stays nothing', money('') === '')
check('whitespace is nothing', money('   ') === '')

/* ── Mermade numbers sort like numbers ────────────────────────────────── */

check('prefix and number split', String(codeOrder('MM109')) === 'MM,109')
check('a bare number has no prefix', String(codeOrder('36')) === ',36')
/* The one the database gets wrong: ordered as text, MM10 comes before MM2. */
check('MM2 before MM10', byCode('MM2', 'MM10') < 0)
check('MM11 before MM109', byCode('MM11', 'MM109') < 0)
check('B before MM', byCode('B36', 'MM1') < 0)
check('equal codes tie', byCode('MM7', 'MM7') === 0)
/* Lowercase in the database must not sort into its own group. */
check('case does not split the prefix', byCode('mm2', 'MM10') < 0)
/* A code nobody expected must not throw or swallow the maker. */
check('a letters-only code still orders', typeof byCode('TBD', 'MM1') === 'number')

/* ── blocks ───────────────────────────────────────────────────────────── */

const item = (code: string, label: string, price: string, extra: Partial<InventoryRow> = {}) =>
  ({
    code, shop: '', contact: '', item: label, price,
    multiBuys: '', note: '', listStatus: 'Filed', added: '',
    ...extra,
  }) as InventoryRow

const maker = (code: string, over: Partial<MakerListRow> = {}) =>
  ({
    code, shop: `Shop ${code}`, contact: 'A Maker', email: 'a@example.com',
    lines: '0', cheapest: '', dearest: '', listStatus: 'Filed',
    payouts: '', lastTouched: '',
    ...over,
  }) as MakerListRow

const blocks = printMakers(
  [
    item('MM10', 'Earrings', '18.00', { multiBuys: '2 for $30.00' }),
    item('MM2', 'Candle', '24.00'),
    item('MM10', 'Rings', '12.00'),
  ],
  [
    maker('MM10', { cheapest: '12.00', dearest: '18.00' }),
    maker('MM2', { cheapest: '24.00', dearest: '24.00' }),
    maker('MM5', { listStatus: 'Nothing yet' }),
  ],
)

check('every maker gets a block', blocks.length === 3)
check('blocks are in code order', blocks.map((b) => b.code).join() === 'MM2,MM5,MM10')
/* A maker who has filed nothing is the whole point of printing this, so her
   block has to exist and has to be empty rather than absent. */
check('a maker with nothing filed still has a block', blocks[1].code === 'MM5')
check('and it carries no lines', blocks[1].lines.length === 0)
check('and says so', blocks[1].filed === 'Nothing yet')

const mm10 = blocks[2]
check('lines land on the right maker', mm10.lines.length === 2)
/* The maker's own order, not alphabetical and not by price: she wrote the
   list and she is going to read it back off this page. */
check('the maker’s own order is kept', mm10.lines.map((l) => l.item).join() === 'Earrings,Rings')
check('lines are numbered from one', mm10.lines.map((l) => l.n).join() === '1,2')
check('prices are display money', mm10.lines[0].price === '$18')
check('multi-buys come through', mm10.lines[0].multiBuys === '2 for $30.00')
check('the range is display money', `${mm10.cheapest} to ${mm10.dearest}` === '$12 to $18')

/* An item row for a maker who is not on the list is a released booking or a
   bad join. It must not invent a block, because a block is a page with a
   signature line on it. */
const orphan = printMakers([item('MM99', 'Mug', '9.00')], [maker('MM1')])
check('an orphan item row makes no block', orphan.length === 1 && orphan[0].code === 'MM1')

/* ── the cover page's counts ──────────────────────────────────────────── */

const sum = sheetSummary(blocks)
check('makers counted', sum.makers === 3)
check('makers with a list counted', sum.listed === 2)
check('makers to chase counted', sum.missing === 1)
check('lines counted', sum.lines === 3)
/* Three lines, one of which also sells two for $30: four buttons at the till.
   This is the number that should match the register, so it is worth stating. */
check('ways to buy counted', sum.variants === 4)

/* ── room to write ───────────────────────────────────────────────────── */

/* A maker who filed a list needs a few spare lines for whatever she names
   while Elise is sitting with her. A maker who filed nothing needs room for
   the whole list, because that conversation is the list. */
check('a filed list gets spare lines', blankRows(12) === 4)
check('a short list gets the same', blankRows(1) === 4)
check('nothing filed gets a list\u2019s worth', blankRows(0) === 10)
check('every maker gets some room', [0, 1, 9, 30, 80].every((n) => blankRows(n) > 0))

const empty = sheetSummary([])
check('an empty show counts to zero', empty.makers === 0 && empty.lines === 0)

if (failures) {
  console.error(`${failures} failed`)
  process.exit(1)
}
console.log('inventory-print: ok')
