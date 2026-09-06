/**
 * A guard, not a unit test.
 *
 * The application form's action bar renders one of two buttons in the same
 * slot: "Next" (type="button") on steps 1 to 3, "Submit application"
 * (type="submit") on step 4. Rendered without distinct keys React treats them
 * as the same element and patches `type` on the one DOM node instead of
 * swapping the node.
 *
 * That patch lands inside the click. React flushes a discrete event's update
 * before the browser runs the click's activation behaviour, so the button a
 * maker pressed as "Next" on step 3 had become a submit button by the time
 * the browser acted on the press, and the form submitted:
 *
 *   · a maker who had already signed filed their application from step 3,
 *     without ever seeing the step they were heading for;
 *   · a maker who had not got the whole error summary thrown at them and was
 *     bounced back to step 1.
 *
 * Nothing that can be unit tested catches this — it needs a real browser and
 * a real click — so this stands in the way of the keys being tidied away.
 * If you restructure the action bar, the rule to keep is: the Next button and
 * the Submit button must never be the same DOM node.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  if (!ok) { failures += 1; console.error(`  FAIL ${name}${detail ? `: ${detail}` : ''}`) }
}

const src = readFileSync(join(import.meta.dirname, 'ApplyForm.tsx'), 'utf8')

// The two buttons, found by the thing that makes each one what it is.
const nextBtn = /<button\b[^>]*onClick=\{\(\) => go\(step \+ 1\)\}[^>]*>/s.exec(src)?.[0]
  ?? /<button\b(?=[^>]*ap-nav__next)(?=[^>]*type="button")[^>]*>/s.exec(src)?.[0]
const submitBtn = /<button\b(?=[^>]*ap-nav__next)(?=[^>]*type="submit")[^>]*>/s.exec(src)?.[0]

check('the Next button is in the action bar', Boolean(nextBtn))
check('the Submit button is in the action bar', Boolean(submitBtn))

const keyOf = (tag: string | undefined) => tag && /key="([^"]+)"/.exec(tag)?.[1]
const nextKey = keyOf(nextBtn)
const submitKey = keyOf(submitBtn)

check('the Next button carries a key', Boolean(nextKey),
  'without one React reuses the submit button\'s DOM node and step 3\'s Next submits the form')
check('the Submit button carries a key', Boolean(submitKey),
  'without one React reuses the Next button\'s DOM node and step 3\'s Next submits the form')
check('the two keys differ', Boolean(nextKey && submitKey && nextKey !== submitKey),
  `both are ${JSON.stringify(nextKey)}`)

// The Next button must stay type="button". A submit button anywhere but the
// last step also makes Enter in a text field file a half-finished application.
check('the Next button is type="button"', Boolean(nextBtn?.includes('type="button"')))

if (failures > 0) {
  console.error(`\nnav-buttons: ${failures} failure(s)`)
  process.exit(1)
}
console.log('nav-buttons: ok')
