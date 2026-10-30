import {
  priceFromDollars, tag, readLine, formatLine, makerBlock, readPastedList,
  oddCentsNote, listState, listNotice, listDone, sendState, sendLabel, sendNotice, MAX_BREAKS,
  type Line, type LineInput,
} from './lines'

/** Multi-buy pairs the way the form posts them. */
const B = (...pairs: [string, string][]) => pairs.map(([qty, price]) => ({ qty, price }))

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
  readLine({ label: 'Maps', price: '5', breaks: B(['', '']), ...l })
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
const maps = readLine({ label: 'Maps', price: '5', breaks: B(['2', '8']) })
check('a bundle parses', 'line' in maps && maps.line.breaks[0]!.qty === 2 && maps.line.breaks[0]!.cents === 800)
check('a bundle formats the way she writes it',
  'line' in maps && formatLine(maps.line) === 'Maps: $5 or buy 2/$8')

const cloths = readLine({ label: 'Table cloths / Backpacks', price: '20', breaks: B(['2', '36']) })
check('the second example too',
  'line' in cloths && formatLine(cloths.line) === 'Table cloths / Backpacks: $20 or buy 2/$36')

const stickers = readLine({ label: 'Stickers/Maps/gift tags', price: '7', breaks: B(['', '']) })
check('and the one with no bundle',
  'line' in stickers && formatLine(stickers.line) === 'Stickers/Maps/gift tags: $7')

/* Half a bundle is the likeliest mistake on the form. */
check('a quantity with no price is refused', bad({ breaks: B(['2', '']) }) !== null)
check('a price with no quantity is refused', bad({ breaks: B(['', '8']) }) !== null)
/* Not refused, saved. "Buy 1 for $12" is what anybody types who reads those
   two boxes as "how many have you got": there is no multi-buy in a quantity
   of one, so the line is kept at its single price rather than thrown back.
   Drew hit the old dead end three times running. */
const one = readLine({ label: 'Ceramic Mug', price: '12', breaks: B(['1', '12']) })
check('a quantity of one saves as a plain price',
  'line' in one && one.line.breaks.length === 0)
check('and reads back as just the price',
  'line' in one && formatLine(one.line) === 'Ceramic Mug: $12')
check('a quantity of zero does the same',
  'line' in readLine({ label: 'Mug', price: '12', breaks: B(['0', '']) }))
check('a fractional quantity is refused', bad({ breaks: B(['2.5', '8']) }) !== null)

/* The quiet one: a bundle that is not a discount is a typo every time, and
   nobody notices until a shopper does the sum at the counter. */
check('a bundle dearer than singles is refused', bad({ breaks: B(['2', '12']) }) !== null)
check('a bundle equal to singles is refused', bad({ breaks: B(['2', '10']) }) !== null)
check('a bundle a cent cheaper is allowed', ok({ breaks: B(['2', '9.99']) }))
check('the refusal does the arithmetic for them',
  (bad({ breaks: B(['2', '12']) }) ?? '').includes('$10'))

/* ── the whole block ─────────────────────────────────────────────────── */

const lines: Line[] = [
  { label: 'Maps', priceCents: 500, breaks: [{ qty: 2, cents: 800 }] },
  { label: 'Stickers/Maps/gift tags', priceCents: 700, breaks: [] },
  { label: 'Table cloths / Backpacks', priceCents: 2000, breaks: [{ qty: 2, cents: 3600 }] },
]
check('the block is exactly what staff already read',
  makerBlock('MM15', "Maggie's Maps", lines) ===
  "MM15 Maggie's Maps:\nMaps: $5 or buy 2/$8\nStickers/Maps/gift tags: $7\nTable cloths / Backpacks: $20 or buy 2/$36")
check('a maker with no code still gets a heading',
  makerBlock(null, "Maggie's Maps", lines).startsWith("Maggie's Maps:"))

check('round prices draw no note', oddCentsNote(lines) === null)
check('odd cents draw one note',
  (oddCentsNote([{ label: 'A', priceCents: 750, breaks: [] }]) ?? '').includes('One of your prices'))
check('several odd prices are counted',
  (oddCentsNote([
    { label: 'A', priceCents: 750, breaks: [] },
    { label: 'B', priceCents: 199, breaks: [] },
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

/* ── "this is my list" ───────────────────────────────────────────────── */

const T0 = '2026-11-01T12:00:00.000Z'
const T1 = '2026-11-01T13:00:00.000Z'

check('nothing on it is empty', sendState(0, null) === 'empty')
/* The one this exists to stop: one line out of forty used to read as done. */
check('lines but never sent is unsent', sendState(3, null) === 'unsent')
check('sent and untouched is sent', sendState(3, T0, T0) === 'sent')
check('sent and changed since says so', sendState(3, T0, T1) === 'changed')
check('a change before sending does not count', sendState(3, T1, T0) === 'sent')
check('rubbish in the sent time reads as unsent', sendState(3, 'nope') === 'unsent')
check('no change time is just sent', sendState(3, T0) === 'sent')

check('an empty list offers no button', sendLabel('empty') === null)
check('an unsent list offers one', sendLabel('unsent') === 'This is my list')
check('a changed list asks again', (sendLabel('changed') ?? '').includes('updated'))
check('a settled list offers nothing to press', sendLabel('sent') === null)

check('an empty list is not done', listDone('empty') === false)
check('started but unsent is not done', listDone('unsent') === false)
check('sent is done', listDone('sent') === true)
/* A maker who adds three more lines in November has not undone anything. */
check('changed is still done', listDone('changed') === true)

/* House style: these strings are read by makers. */
const copy = [
  listNotice('not_open', 0), listNotice('open', 0), listNotice('open', 3),
  listNotice('locked', 0), listNotice('locked', 3),
  sendNotice('unsent') ?? '', sendNotice('sent', T0) ?? '', sendNotice('changed') ?? '',
  sendLabel('unsent') ?? '', sendLabel('changed') ?? '',
  oddCentsNote([{ label: 'A', priceCents: 750, breaks: [] }]) ?? '',
  bad({ breaks: B(['2', '12']) }) ?? '',
]
check('no fancy dashes and no exclamations in anything a maker reads',
  copy.every((t) => !t.includes('!')
    && !t.includes(String.fromCharCode(0x2014)) && !t.includes(String.fromCharCode(0x2013))))

/* ── more than one multi-buy on a line ───────────────────────────────── */

/* Drew, 30 October: "one for $10, two for $15, three for $20... it's the
   same product, like in a register you click into it and it's got three
   variants." The single price is one of them, so this is two breaks. */
const ladder = readLine({ label: 'Candles', price: '10', breaks: B(['2', '15'], ['3', '20']) })
check('a product carries more than one multi-buy',
  'line' in ladder && ladder.line.breaks.length === 2)
check('and reads back as one product with its variants',
  'line' in ladder && formatLine(ladder.line) === 'Candles: $10 or buy 2/$15 or 3/$20')
check('the single price is untouched',
  'line' in ladder && ladder.line.priceCents === 1000)

/* Fewest first, whatever order they were typed in: that is how a shelf card
   reads and how the register lists the variants. */
const jumbled = readLine({ label: 'Candles', price: '10', breaks: B(['3', '20'], ['2', '15']) })
check('breaks are ordered fewest first',
  'line' in jumbled && jumbled.line.breaks.map((b) => b.qty).join() === '2,3')

/* The quiet one. $7.50 each then $8.33 each is a ladder that goes the wrong
   way: a shopper buying three is better off buying two and one, and nobody
   notices until she does the sum at the counter. */
const backwards = readLine({ label: 'Candles', price: '10', breaks: B(['2', '15'], ['3', '25']) })
check('a multi-buy that is dearer each than the one above it is refused',
  'bad' in backwards)
check('and the refusal names both of them',
  'bad' in backwards && backwards.bad.includes('3 for $25') && backwards.bad.includes('2 for $15'))

check('every break still has to beat the single price',
  'bad' in readLine({ label: 'Candles', price: '10', breaks: B(['2', '15'], ['3', '31']) }))
check('the same quantity priced twice is refused',
  'bad' in readLine({ label: 'Candles', price: '10', breaks: B(['2', '15'], ['2', '16']) }))
check('a half filled second break is refused, not dropped',
  'bad' in readLine({ label: 'Candles', price: '10', breaks: B(['2', '15'], ['3', '']) }))
check('an untouched second break is simply ignored',
  'line' in readLine({ label: 'Candles', price: '10', breaks: B(['2', '15'], ['', '']) }))
check('gaps between the rows do not matter',
  'line' in readLine({ label: 'Candles', price: '10', breaks: B(['', ''], ['2', '15']) }))

/* And the whole ladder survives a round trip through the paste box, which is
   how a maker who already has it written out will enter it. */
const pasted = readPastedList('Candles: $10 or buy 2/$15 or 3/$20\nMugs: $12')
check('a ladder pastes in', pasted.lines[0]!.breaks.length === 2)
check('without disturbing the line under it', pasted.lines[1]!.label === 'Mugs')
check('and what the register shows can be pasted back',
  formatLine(pasted.lines[0]!) === 'Candles: $10 or buy 2/$15 or 3/$20')
check('three breaks is the ceiling the form offers', MAX_BREAKS === 3)

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('inventory lines: a price never comes from a float, and a bundle is always a discount')


/* ── Elise's own format, pasted straight in ──────────────────────────── */

/* Her example, exactly as the instructions shipped with the table state it. */
const elise = readPastedList([
  "MM15 Maggie's Maps:",
  'Maps: $5 or buy 2/$8',
  'Stickers/Maps/gift tags: $7',
  'Table cloths / Backpacks: $20 or buy 2/$36',
].join('\n'))

check('every priced line is read', elise.lines.length === 3)
check('and nothing is reported as broken', elise.bad.length === 0)
check('the maker heading is not a line', !elise.lines.some((l) => l.label.includes('Maggie')))
check('a multi-buy survives the round trip',
  formatLine(elise.lines[0]!) === 'Maps: $5 or buy 2/$8')
check('a label with slashes in it is kept whole',
  elise.lines[1]!.label === 'Stickers/Maps/gift tags')
check('and so is one with spaces around them',
  elise.lines[2]!.label === 'Table cloths / Backpacks')
check('the dearer multi-buy reads back',
  formatLine(elise.lines[2]!) === 'Table cloths / Backpacks: $20 or buy 2/$36')

/* What the card prints is what it takes back. A maker pasting last week's
   list out of her own email must land exactly where she started. */
const roundTrip = readPastedList(elise.lines.map(formatLine).join('\n'))
check('what the register shows can be pasted back in',
  JSON.stringify(roundTrip.lines) === JSON.stringify(elise.lines))

/* The shapes people actually paste. */
const loose = readPastedList([
  '- Mugs - $12',
  '* Prints $25',
  'Cards: 7',
  'Totes: $30, 2 for $50',
  'Pins: $4 buy 3/$10',
].join('\n'))
check('bullets, dashes and a missing dollar sign all read', loose.lines.length === 5)
check('a dash instead of a colon keeps the label', loose.lines[0]!.label === 'Mugs')
check('no separator at all still reads', loose.lines[1]!.label === 'Prints')
check('"2 for $50" is a multi-buy', loose.lines[3]!.breaks[0]!.qty === 2)
check('"buy 3/$10" is too', loose.lines[4]!.breaks[0]!.cents === 1000)

/* Nothing reaches the register from here that the form would have refused. */
const refused = readPastedList([
  'Good one: $10',
  'No price on this one',
  'Dearer in bulk: $5 or buy 2/$20',
].join('\n'))
check('the readable line is kept', refused.lines.length === 1)
check('and the other two come back', refused.bad.length === 2)
check('each with the line as they typed it',
  refused.bad[0]!.raw === 'No price on this one')
check('a bulk price that is not a discount is refused here too',
  refused.bad[1]!.why.includes('has to cost less'))
check('blank lines are not errors', readPastedList('\n\n  \n').bad.length === 0)
