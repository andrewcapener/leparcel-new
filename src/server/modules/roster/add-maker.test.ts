import { feeFromDollars, readNewMaker, type NewMaker } from './add-maker'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const form = (over: Partial<NewMaker> = {}): NewMaker => ({
  shopName: 'Holy Sits', contactName: 'Allison', email: 'allison@holysits.com',
  spaceTypeId: 'sp-3x6', fee: '', instagram: '', phone: '',
  reason: 'paid before we had her on a list',
  ...over,
})
const ok = (o: Partial<NewMaker> = {}) => 'ready' in readNewMaker(form(o))
const bad = (o: Partial<NewMaker> = {}) => {
  const r = readNewMaker(form(o))
  return 'bad' in r ? r.bad : null
}
const ready = (o: Partial<NewMaker> = {}) => {
  const r = readNewMaker(form(o))
  if (!('ready' in r)) throw new Error(`expected ready, got ${r.bad}`)
  return r.ready
}

/* ── the fee comes out of text ───────────────────────────────────────── */

const cents = (s: string) => {
  const r = feeFromDollars(s)
  return r && 'cents' in r ? r.cents : null
}
check('empty means the list price', feeFromDollars('') === null)
check('whole dollars', cents('280') === 28000)
check('a dollar sign is fine', cents('$280') === 28000)
check('a comma is fine', cents('$1,200') === 120000)
/* 4.10 * 100 is 409.99999999999994 and would short the fee by a cent. */
check('the float trap', cents('4.10') === 410)
check('cents are kept', cents('280.50') === 28050)
check('words are refused', feeFromDollars('free') !== null && 'bad' in feeFromDollars('free')!)
check('negatives are refused', 'bad' in (feeFromDollars('-5') as object))
check('three decimals are refused', 'bad' in (feeFromDollars('1.005') as object))
check('absurd is refused', 'bad' in (feeFromDollars('200000') as object))

/* ── the form ────────────────────────────────────────────────────────── */

check('a complete form is accepted', ok())
check('no shop name is refused', bad({ shopName: '  ' }) !== null)
check('no contact is refused', bad({ contactName: '' }) !== null)
check('no space is refused', (bad({ spaceTypeId: '' }) ?? '').includes('space'))

check('a bad address is refused', bad({ email: 'allison' }) !== null)
check('an address with no dot is refused', bad({ email: 'allison@localhost' }) !== null)
check('the address is lowercased', ready({ email: 'Allison@HolySits.com' }).email === 'allison@holysits.com')

/* The one rule that exists because this path skips the jury entirely. */
check('a reason is required', (bad({ reason: '' }) ?? '').includes('audit log'))
check('a one letter reason is not a reason', bad({ reason: 'x' }) !== null)

check('an empty fee means the list price', ready().priceCents === null)
check('a typed fee is carried in cents', ready({ fee: '280' }).priceCents === 28000)
check('a bad fee is refused', (bad({ fee: 'about $300' }) ?? '').includes('number'))

check('an at sign is stripped from the handle',
  ready({ instagram: '@holysits' }).instagram === 'holysits')
check('an empty handle is null', ready().instagram === null)
check('an empty phone is null', ready().phone === null)
check('inner whitespace is collapsed',
  ready({ shopName: 'Holy   Sits' }).shopName === 'Holy Sits')

/* House style: staff read these, and the refusals are the copy most likely
   to be seen at speed. */
const copy = [
  bad({ shopName: '' }), bad({ contactName: '' }), bad({ email: 'x' }),
  bad({ spaceTypeId: '' }), bad({ reason: '' }), bad({ fee: 'lots' }),
].filter((x): x is string => x !== null)
check('every refusal says what to do', copy.length === 6)
check('no fancy dashes and no exclamations',
  copy.every((t) => !t.includes('!')
    && !t.includes(String.fromCharCode(0x2014)) && !t.includes(String.fromCharCode(0x2013))))

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('add a maker: the fee never comes from a float, and nobody joins the roster without a reason')
