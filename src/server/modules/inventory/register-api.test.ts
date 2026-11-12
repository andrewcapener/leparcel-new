import { findLine, type ApiLine } from './register-api'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const lines: ApiLine[] = [
  { id: 'a', label: 'Sticker pack', priceCents: 500 },
  { id: 'b', label: 'Enamel pin', priceCents: 500 },
  { id: 'c', label: 'Tote bag', priceCents: 2000 },
  { id: 'd', label: 'Mug', priceCents: 1200 },
]

const got = (f: ReturnType<typeof findLine>) => ('line' in f ? f.line.id : null)

/* ── by id, which is what a caller does after listing ────────────────── */

check('an id finds it', got(findLine(lines, { itemId: 'c' })) === 'c')
check('an unknown id is refused', got(findLine(lines, { itemId: 'zz' })) === null)
/* The id is exact, so it must not be second-guessed by a price that
   disagrees: the caller has already said precisely what they mean. */
check('an id wins over a price', got(findLine(lines, { itemId: 'c', fromCents: 9999 })) === 'c')

/* ── by name ─────────────────────────────────────────────────────────── */

check('a name finds it', got(findLine(lines, { match: 'tote' })) === 'c')
check('case does not matter', got(findLine(lines, { match: 'TOTE BAG' })) === 'c')
check('part of the name is enough', got(findLine(lines, { match: 'mug' })) === 'd')
check('a name nobody has is refused', got(findLine(lines, { match: 'candle' })) === null)

/* ── by price ────────────────────────────────────────────────────────── */

check('a unique price finds it', got(findLine(lines, { fromCents: 2000 })) === 'c')
/* The whole reason this file exists. Two things cost $5, so "change her five
   dollar one to six" is not an instruction, it is a question. Guessing would
   change a price on the wrong product and nobody would find it until the
   statement. */
const ambiguous = findLine(lines, { fromCents: 500 })
check('a shared price is refused, not guessed', got(ambiguous) === null)
check('and it says how many matched', 'bad' in ambiguous && ambiguous.bad.includes('2'))
check('and hands back the candidates', 'candidates' in ambiguous && ambiguous.candidates!.length === 2)

/* Name and price together are how an ambiguous one gets resolved without
   anybody reading an id out loud. */
check('name and price together', got(findLine(lines, { match: 'pin', fromCents: 500 })) === 'b')
check('a name at the wrong price is refused', got(findLine(lines, { match: 'pin', fromCents: 2000 })) === null)

/* ── nothing to go on ────────────────────────────────────────────────── */

check('an empty selector is refused', got(findLine(lines, {})) === null)
check('a blank name is not a selector', got(findLine(lines, { match: '   ' })) === null)
check('an empty list is refused', got(findLine([], { match: 'mug' })) === null)

/* The refusal has to be readable, because it comes back as the answer to a
   sentence somebody typed on a phone. */
const miss = findLine(lines, { fromCents: 777 })
check('a missing price says the price', 'bad' in miss && miss.bad.includes('$7.77'))
const whole = findLine(lines, { fromCents: 300 })
check('whole dollars read as whole dollars', 'bad' in whole && whole.bad.includes('$3'))

if (failures) {
  console.error(`${failures} failed`)
  process.exit(1)
}
console.log('register api: a line is named exactly, and an ambiguous one is refused rather than guessed')
