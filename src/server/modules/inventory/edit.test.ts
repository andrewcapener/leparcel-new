import { MAX_PRICE_CENTS, pendingEdits, priceProblem } from './edit'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

/* ── what counts as an edit ──────────────────────────────────────────── */

const lines = [
  { id: 'a', label: 'Stickers', priceCents: 500 },
  { id: 'b', label: 'Mugs', priceCents: 1200 },
  { id: 'c', label: 'Totes', priceCents: 2000 },
]

const edits = pendingEdits(lines, new Map([['a', 600], ['b', 1200]]))
check('a changed price is an edit', edits.length === 1 && edits[0].itemId === 'a')
check('it carries what it was', edits[0].fromCents === 500 && edits[0].toCents === 600)
/* The field somebody tabbed through. Logging it as a change would put a line
   in the audit trail saying a price moved from $12 to $12. */
check('an unchanged price is not an edit', !edits.some((e) => e.itemId === 'b'))
/* A line the form did not post at all, because the screen was showing a
   different maker or the row had gone. Never treated as a change to zero. */
check('an absent field is not an edit', !edits.some((e) => e.itemId === 'c'))
check('nothing submitted is no edits', pendingEdits(lines, new Map()).length === 0)

/* ── a price has to be a price ───────────────────────────────────────── */

check('an ordinary price is fine', priceProblem(600) === null)
check('a cent is fine', priceProblem(1) === null)
/* Both of these reach a till, and both are a typo rather than a decision. */
check('free is refused', priceProblem(0) !== null)
check('negative is refused', priceProblem(-500) !== null)
check('fractional cents are refused', priceProblem(10.5) !== null)
/* The missing decimal point: 4500 typed for $45. Caught at the counter
   rather than found in a statement. */
check('the missing decimal point is caught', priceProblem(4500_00) !== null)
check('the ceiling itself is allowed', priceProblem(MAX_PRICE_CENTS) === null)
check('a dollar over the ceiling is not', priceProblem(MAX_PRICE_CENTS + 1) !== null)

if (failures) {
  console.error(`${failures} failed`)
  process.exit(1)
}
console.log('inventory edit: only real changes are written, and never at a price that is not one')
