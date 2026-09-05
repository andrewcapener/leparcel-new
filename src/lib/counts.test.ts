/**
 * A description that names how many exist must say the number in the capacity
 * column, not a number somebody typed next to it. "Only 6 chosen" survived one
 * day before Drew moved JR spaces to 8; the page would have promised six while
 * the system sold eight.
 */
import { fillCapacity } from './counts'

let failures = 0
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) { failures += 1; console.error(`  FAIL ${name}${detail ? `: ${detail}` : ''}`) }
}

const jr = { description: 'We provide the shelving. Only {{capacity}} chosen.', capacity: 8 }
check('fills from the column',
  fillCapacity(jr).description === 'We provide the shelving. Only 8 chosen.',
  fillCapacity(jr).description)

// An outdoor cap is per day, and the description says so itself rather than
// the filler gluing it on, which produced "Only 5 each day of these exist."
const outdoor = { description: 'Only {{capacity}} exist each day.', capacity: 5 }
check('the token is only ever the number',
  fillCapacity(outdoor).description === 'Only 5 exist each day.',
  fillCapacity(outdoor).description)

// Uncapped is the state every add-on was in before priority placement, and a
// page must never render the braces.
const uncapped = { description: 'Only {{capacity}} of these exist.', capacity: null }
check('uncapped reads as prose',
  fillCapacity(uncapped).description === 'Only a limited number of these exist.',
  fillCapacity(uncapped).description)

const plain = { description: 'Split one space with another maker.', capacity: null }
check('a description without the token is untouched',
  fillCapacity(plain) === plain)

check('every token is replaced',
  !fillCapacity({ description: '{{capacity}} and {{capacity}}', capacity: 3 }).description.includes('{{'))

if (failures) { console.error(`counts: ${failures} failure(s)`); process.exit(1) }
console.log('counts: descriptions take their number from the capacity column')
