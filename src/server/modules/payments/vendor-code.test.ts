import { vendorCodeWords, vendorCodeLine } from './vendor-code'
import { payNote } from './manual'
import { hasFancyDash } from '@/lib/dashes'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const TRACKS = ['indoor', 'outdoor']

/* The bug this file exists to stop: an outdoor maker reading "Your Mermade
   ID: MM91" as a booth number and turning up looking for booth 91. */
check('outdoor is never called an ID', !/\bID\b/i.test(vendorCodeWords('outdoor').label))
check('outdoor is called a payment reference',
  vendorCodeWords('outdoor').label.toLowerCase().includes('payment reference'))
check('outdoor says it is not a booth number',
  (vendorCodeWords('outdoor').clarify ?? '').toLowerCase().includes('not your booth number'))
check('outdoor says where the booth number does come from',
  (vendorCodeWords('outdoor').clarify ?? '').toLowerCase().includes('assigned separately'))
/* The header band has no label column, so the code stands alone there unless
   something is put in front of it. */
check('outdoor labels the code in the header too',
  vendorCodeWords('outdoor').headerLabel !== null)

check('indoor keeps the words it has always had',
  vendorCodeWords('indoor').label === 'Your Mermade ID')
check('indoor needs no prefix in the header', vendorCodeWords('indoor').headerLabel === null)
check('indoor has nothing to disclaim', vendorCodeWords('indoor').clarify === null)

/* Both tracks must still ask for the code in the payment note. Matching a
   Venmo notification to a booking is done by a person reading that note, and
   a payment that arrives without it is a phone call. */
for (const t of TRACKS) {
  check(`${t} asks for the code in the payment note`,
    vendorCodeWords(t).note.toLowerCase().includes('in the note when you pay'))
  check(`${t} says something`,
    vendorCodeWords(t).note.length > 0 && vendorCodeWords(t).label.length > 0)
}

/* Neither track's LABEL may read as a space. The outdoor clarify line is the
   one place the words "booth number" are allowed, and only to deny them. */
for (const t of ['indoor', 'outdoor', 'both', '']) {
  const w = vendorCodeWords(t)
  const spaceish = /\b(booth|space|table|tent|stall)\s+number\b/i
  check(`${t || 'blank'} never labels the code as a booth or space number`, !spaceish.test(w.label))
  check(`${t || 'blank'} never calls it one in the payment note`, !spaceish.test(w.note))
}

/* Unknown, missing and `both` fall back to the wording every maker has had
   until now, rather than telling an indoor maker their ID is a reference. */
check('both falls back to indoor', vendorCodeWords('both').label === vendorCodeWords('indoor').label)
check('blank falls back to indoor', vendorCodeWords('').label === vendorCodeWords('indoor').label)
check('null falls back to indoor', vendorCodeWords(null).label === vendorCodeWords('indoor').label)
check('undefined falls back to indoor', vendorCodeWords(undefined).label === vendorCodeWords('indoor').label)
check('case and padding do not change the track',
  vendorCodeWords('  Outdoor ').label === vendorCodeWords('outdoor').label)

/* The line under the code. Paying instructions go away once the money is in;
   the booth-number correction does not, because the misreading does not. */
check('indoor says how to pay while something is owed',
  vendorCodeLine(vendorCodeWords('indoor'), true) === vendorCodeWords('indoor').note)
check('indoor says nothing at all once it is paid',
  vendorCodeLine(vendorCodeWords('indoor'), false) === null)
check('outdoor says both while something is owed',
  (vendorCodeLine(vendorCodeWords('outdoor'), true) ?? '').includes('when you pay')
  && (vendorCodeLine(vendorCodeWords('outdoor'), true) ?? '').includes('not your booth number'))
check('outdoor still denies the booth number once it is paid',
  vendorCodeLine(vendorCodeWords('outdoor'), false) === vendorCodeWords('outdoor').clarify)
check('a paid outdoor maker is not told to pay again',
  !(vendorCodeLine(vendorCodeWords('outdoor'), false) ?? '').includes('when you pay'))

/* docs/12-VOICE.md rule 2 and rule 8. These strings render on a maker's own
   page, and the outbound line is the one that is assembled rather than
   written, so it is checked as assembled. */
for (const t of TRACKS) {
  const w = vendorCodeWords(t)
  for (const owing of [true, false]) {
    const line = `${w.label} ${w.headerLabel ?? ''} ${vendorCodeLine(w, owing) ?? ''}`
    check(`${t} copy has no fancy dashes (owing=${owing})`, !hasFancyDash(line))
    check(`${t} copy has no exclamation points (owing=${owing})`, !line.includes('!'))
  }
}

/* The code is still the thing staff read off a Venmo notification, whatever
   we call it on screen. Renaming the label must never rename the note. */
check('the payment note still leads with the code',
  payNote('MM91', 'Holiday Show 2026').startsWith('MM91'))

if (failures) { console.error(`${failures} failed`); process.exit(1) }
console.log('vendor-code: ok')
