import { chargePresets, dollarsField, presetFill, type AddOnRow } from './presets'

/**
 * The quick fills on a maker's page.
 *
 * Worth a test for two reasons. The dollars string is money leaving integer
 * cents for a text box and coming back again, which is the one conversion in
 * this feature that can be wrong by a factor of a hundred. And the track
 * filter decides whether an indoor maker is ever offered a $60 outdoor endcap
 * or a tent, which is a wrong fee on a real invoice rather than a cosmetic
 * slip.
 */

let failures = 0
function ok(what: string, cond: boolean, detail = '') {
  if (!cond) { console.error(`FAIL ${what}${detail ? `\n     ${detail}` : ''}`); failures++ }
}
const eq = (what: string, got: unknown, want: unknown) =>
  ok(what, Object.is(got, want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)

/* ── cents to the dollars box ── */

eq('a round hundred', dollarsField(10_000), '100.00')
eq('the indoor endcap', dollarsField(4_000), '40.00')
eq('the outdoor endcap', dollarsField(6_000), '60.00')
eq('an odd number of cents', dollarsField(45_099), '450.99')
eq('a single cent', dollarsField(1), '0.01')
eq('nine cents pads', dollarsField(9), '0.09')
eq('nothing', dollarsField(0), '0.00')
eq('a credit keeps its minus', dollarsField(-45_000), '-450.00')
eq('a credit of one cent', dollarsField(-1), '-0.01')
ok('a fractional cent is refused', (() => {
  try { dollarsField(12.5); return false } catch { return true }
})())

/* Round trip: whatever the box says, parsing it the way addBoothCharge does
   has to give back the cents we started from. That parse is
   Math.round(Number(typed) * 100), so this is the property that matters. */
for (let c = -250_000; c <= 250_000; c += 37) {
  const back = Math.round(Number(dollarsField(c)) * 100)
  ok(`round trip ${c}`, back === c, `dollarsField gave ${dollarsField(c)}, parsed ${back}`)
}

/* ── which presets a booking is offered ── */

const ADDONS: AddOnRow[] = [
  { code: 'SHARE', name: 'Share your space', track: null, priceCents: 10_000 },
  { code: 'ENDCAP-IN', name: 'Corner or endcap, inside', track: 'indoor', priceCents: 4_000 },
  { code: 'ENDCAP-OUT', name: 'Corner or endcap, outside', track: 'outdoor', priceCents: 6_000 },
  { code: 'TENT_10X10', name: 'Use one of our tents', track: 'outdoor', priceCents: 10_000 },
]

const inside = chargePresets(ADDONS, 'indoor')
eq('indoor is offered two', inside.length, 2)
eq('and the share is one of them', inside[0]?.code, 'SHARE')
eq('the indoor endcap is the other', inside[1]?.code, 'ENDCAP-IN')
eq('at its own price', inside[1]?.dollars, '40.00')
ok('and never the outdoor endcap', !inside.some((p) => p.code === 'ENDCAP-OUT'))
ok('and never a tent', !inside.some((p) => p.code === 'TENT_10X10'))

const outside = chargePresets(ADDONS, 'outdoor')
eq('outdoor is offered three', outside.length, 3)
eq('with the outdoor endcap at $60', outside.find((p) => p.code === 'ENDCAP-OUT')?.dollars, '60.00')

eq('a free add-on is not a line', chargePresets(
  [{ code: 'FREE', name: 'Nothing', track: null, priceCents: 0 }], 'indoor',
).length, 0)
eq('nor is a negative one', chargePresets(
  [{ code: 'ODD', name: 'Owed back', track: null, priceCents: -100 }], 'indoor',
).length, 0)
eq('no add-ons, no presets', chargePresets([], 'indoor').length, 0)

/* ── filling the form ── */

eq('a pressed preset fills the description', presetFill(inside, 'SHARE').description,
  'Share your space')
eq('and the amount', presetFill(inside, 'SHARE').dollars, '100.00')
eq('whitespace around the code is tolerated', presetFill(inside, ' SHARE ').dollars, '100.00')
eq('an unknown code fills nothing', presetFill(inside, 'TENT_10X10').description, '')
eq('and no amount either', presetFill(inside, 'TENT_10X10').dollars, '')
eq('no code fills nothing', presetFill(inside, undefined).description, '')
eq('nor does an empty one', presetFill(inside, '').dollars, '')

if (failures) {
  console.error(`presets: ${failures} failure(s)`)
  process.exit(1)
}
console.log('presets: dollars round trip holds, and a maker is only offered their own track')
