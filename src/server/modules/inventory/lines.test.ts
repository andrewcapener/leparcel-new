import {
  priceFromDollars, tag, readLine, formatLine, makerBlock,
  oddCentsNote, listState, listNotice, listDone, type Line, type LineInput,
} from './lines'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

/* ── money comes out of text, never a float ──────────────────────────── */

const cents = (s: string) => {
  const r = priceFromDollars(s)
  return 'cents' in r ? r.cents : null
}

check('whole dollars', cents('7') === 700)
check('a dollar sign is fine', cents('$7') === 700)
check('a comma is fine', cents('$1,200') === 120000)
/* The one that fails under Number(x) * 100: 4.10 * 100 is
   409.99999999999994, which floors to 409 and shorts the maker a cent. */
check('the float trap', cents('4.10') === 410)
check('another float trap', cents('7.35') === 735)
check('one decimal place', cents('7.5') === 750)
check('spaces are trimmed', cents('  12.25 ') === 1225)

check('nothing is not a price', !('cents' in priceFromDollars('')))
check('words are not a price', !('cents' in priceFromDollars('five')))
check('three decimals are refused', !('cents' in priceFromDollars('1.005')))
check('scientific notation is refused', !('cents' in priceFromDollars('1e4')))
check('negatives are refused', !('cents' in priceFromDollars('-5')))
check('zero is refused', !('cents' in priceFromDollars('0')))
check('absurd is refused', !('cents' in priceFromDollars('20000')))

/* ── tags read the way a price tag reads ─────────────────────────────── */

check('whole dollars drop the cents', tag(500) === '$5')
check('cents are kept when there are any', tag(750) === '$7.50')
check('a single trailing cent is padded', tag(705) === '$7.05')
check('thousands are grouped', tag(120000) === '$1,200')

/* ── a line ──────────────────────────────────────────────────────────── */

const line = (l: Partial<LineInput> = {}) =>
  readLine({ label: 'Maps', price: '5', bundleQty: '', bundlePrice: '', ...l })
const ok = (l: Partial<LineInput> = {}) => 'line' in line(l)
const bad = (l: Partial<LineInput> = {}) => {
  const r = line(l)
  return 'bad' in r ? r.bad : null
}

check('a plain line', ok())
check('a line with no name is refused', bad({ label: '  ' }) !== null)
check('a long name is refused', bad({ label: 'x'.repeat(81) }) !== null)
const collapsed = line({ label: 'Table   cloths' })
check('inner whitespace is collapsed',
  'line' in collapsed && collapsed.line.label === 'Table cloths')

/* Hillary's own example, start to finish. */
const maps = readLine({ label: 'Maps', price: '5', bundleQty: '2', bundlePrice: '8' })
check('a bundle parses', 'line' in maps && maps.line.bundleQty === 2 && maps.line.bundleCents === 800)
check('a bundle formats the way she writes it',
  'line' in maps && formatLine(maps.line) === 'Maps: $5 or buy 2/$8')

const cloths = readLine({ label: 'Table cloths / Backpacks', price: '20', bundleQty: '2', bundlePrice: '36' })
check('the second example too',
  'line' in cloths && formatLine(cloths.line) === 'Table cloths / Backpacks: $20 or buy 2/$36')

const stickers = readLine({ label: 'Stickers/Maps/gift tags', price: '7', bundleQty: '', bundlePrice: '' })
check('and the one with no bundle',
  'line' in stickers && formatLine(stickers.line) === 'Stickers/Maps/gift tags: $7')

/* Half a bundle is the likeliest mistake on the form. */
check('a quantity with no price is refused', bad({ bundleQty: '2' }) !== null)
check('a price with no quantity is refused', bad({ bundlePrice: '8' }) !== null)
check('a bundle of one is refused', bad({ bundleQty: '1', bundlePrice: '4' }) !== null)
check('a fractional quantity is refused', bad({ bundleQty: '2.5', bundlePrice: '8' }) !== null)

/* The quiet one: a bundle that is not a discount is a typo every time, and
   nobody notices until a shopper does the sum at the counter. */
check('a bundle dearer than singles is refused', bad({ bundleQty: '2', bundlePrice: '12' }) !== null)
check('a bundle equal to singles is refused', bad({ bundleQty: '2', bundlePrice: '10' }) !== null)
check('a bundle a cent cheaper is allowed', ok({ bundleQty: '2', bundlePrice: '9.99' }))
check('the refusal does the arithmetic for them',
  (bad({ bundleQty: '2', bundlePrice: '12' }) ?? '').includes('$10'))

/* ── the whole block ─────────────────────────────────────────────────── */

const lines: Line[] = [
  { label: 'Maps', priceCents: 500, bundleQty: 2, bundleCents: 800 },
  { label: 'Stickers/Maps/gift tags', priceCents: 700, bundleQty: null, bundleCents: null },
  { label: 'Table cloths / Backpacks', priceCents: 2000, bundleQty: 2, bundleCents: 3600 },
]
check('the block is exactly what staff already read',
  makerBlock('MM15', "Maggie's Maps", lines) ===
  "MM15 Maggie's Maps:\nMaps: $5 or buy 2/$8\nStickers/Maps/gift tags: $7\nTable cloths / Backpacks: $20 or buy 2/$36")
check('a maker with no code still gets a heading',
  makerBlock(null, "Maggie's Maps", lines).startsWith("Maggie's Maps:"))

check('round prices draw no note', oddCentsNote(lines) === null)
check('odd cents draw one note',
  (oddCentsNote([{ label: 'A', priceCents: 750, bundleQty: null, bundleCents: null }]) ?? '').includes('One of your prices'))
check('several odd prices are counted',
  (oddCentsNote([
    { label: 'A', priceCents: 750, bundleQty: null, bundleCents: null },
    { label: 'B', priceCents: 199, bundleQty: null, bundleCents: null },
  ]) ?? '').includes('2 of your prices'))
/* It is a preference, not a rule: a maker whose tags are printed is right. */
check('the note never refuses anything', ok({ price: '7.99' }))

/* ── the deadline ────────────────────────────────────────────────────── */

const now = '2026-11-01T12:00:00.000Z'
check('no date means nothing is being asked', listState(null, now) === 'not_open')
check('rubbish is treated as no date', listState('not a date', now) === 'not_open')
check('before the date it is open', listState('2026-11-05T07:59:00.000Z', now) === 'open')
check('after the date it is shut', listState('2026-10-28T07:59:00.000Z', now) === 'locked')
check('the date itself is still open', listState(now, now) === 'open')

check('a shut list with prices says what the register has',
  listNotice('locked', 4).includes('what the register has'))
check('a shut empty list offers a way through',
  listNotice('locked', 0).includes('by hand'))
check('an open empty list explains the shape',
  listNotice('open', 0).includes('One line per price'))

check('an empty list is not done', listDone(0) === false)
check('one line is done', listDone(1) === true)

/* House style: these strings are read by makers. */
const copy = [
  listNotice('not_open', 0), listNotice('open', 0), listNotice('open', 3),
  listNotice('locked', 0), listNotice('locked', 3),
  oddCentsNote([{ label: 'A', priceCents: 750, bundleQty: null, bundleCents: null }]) ?? '',
  bad({ bundleQty: '2', bundlePrice: '12' }) ?? '',
]
check('no fancy dashes and no exclamations in anything a maker reads',
  copy.every((t) => !t.includes('!')
    && !t.includes(String.fromCharCode(0x2014)) && !t.includes(String.fromCharCode(0x2013))))

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('inventory lines: a price never comes from a float, and a bundle is always a discount')
