import { checklistFor, nextAction, clearForLoadIn, type ChecklistInput } from './checklist'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const NOW = '2026-10-01T12:00:00Z'
const LOAD_IN = '2026-11-13T15:00:00Z'
const SOON = '2026-10-03T12:00:00Z'
const GONE = '2026-09-20T12:00:00Z'

const base: ChecklistInput = {
  applicationStatus: 'accepted',
  track: 'indoor',
  booking: { status: 'awaiting_payment', paymentDueAt: SOON },
  sellerPermit: '',
  occasionalSeller: false,
  permitStatus: null,
  hasCoi: false,
  loadInAt: LOAD_IN,
  nowIso: NOW,
  contactEmail: 'hello@mermademarket.com',
}
const at = (i: ChecklistInput, key: string) => checklistFor(i).find((x) => x.key === key)

/* Who is asked for what. Wrong in either direction costs money or goodwill. */
check('indoor is never asked for a permit', !at(base, 'permit'))
check('outdoor is asked for a permit', Boolean(at({ ...base, track: 'outdoor' }, 'permit')))
check('both is asked for a permit', Boolean(at({ ...base, track: 'both' }, 'permit')))
check('indoor is asked for an item list', Boolean(at(base, 'items')))
check('outdoor is not: they run their own register',
  !at({ ...base, track: 'outdoor' }, 'items'))
check('everybody is asked for insurance',
  Boolean(at(base, 'coi')) && Boolean(at({ ...base, track: 'outdoor' }, 'coi')))

/* An applicant who has not been accepted is not chased for anything. */
const applicant = checklistFor({ ...base, applicationStatus: 'new', booking: undefined })
check('an undecided applicant has nothing to do',
  applicant.every((i) => i.state === 'waiting'))
check('an undecided applicant is shown what is coming', applicant.length >= 3)

/* The booth fee, through its whole life. */
check('unpaid and in date is todo', at(base, 'fee')!.state === 'todo')
check('unpaid and past its date is overdue',
  at({ ...base, booking: { status: 'awaiting_payment', paymentDueAt: GONE } }, 'fee')!.state === 'overdue')
check('paid is done',
  at({ ...base, booking: { status: 'confirmed', paymentDueAt: GONE } }, 'fee')!.state === 'done')
/* The one that matters: a bank transfer in flight must never read as overdue,
   however far past the deadline. The maker did their part. */
check('a transfer clearing past the deadline is done, not overdue',
  at({ ...base, booking: { status: 'payment_processing', paymentDueAt: GONE } }, 'fee')!.state === 'done')
check('a released space is not still nagging',
  at({ ...base, booking: { status: 'forfeited', paymentDueAt: GONE } }, 'fee')!.state === 'done')

/* Compliance items settle either way. */
const outdoor = { ...base, track: 'outdoor' }

/* What they already told us on the application. The whole point: a maker who
   answered this question must not be asked it again. */
/* Answered questions leave the list entirely. They belong in the profile,
   where the answer is read back. Only what is still theirs to do stays. */
check('an occasional seller has no permit row at all',
  !at({ ...outdoor, permitStatus: 'occasional' }, 'permit'))
check('somebody who asked for help has no permit row',
  !at({ ...outdoor, permitStatus: 'unsure' }, 'permit'))
check('a permit already on file has no row',
  !at({ ...outdoor, permitStatus: 'have', sellerPermit: '123456789' }, 'permit'))
check('a signed 410-D has no row', !at({ ...outdoor, occasionalSeller: true }, 'permit'))

const promised = at({ ...outdoor, permitStatus: 'have', sellerPermit: '' }, 'permit')!
check('saying "I have one" without the number is still their turn', promised.state === 'todo')
check('and it says we already know they have one', promised.detail.includes('You told us you have a permit'))

const never = at({ ...outdoor, permitStatus: null }, 'permit')!
check('never answered is a fresh ask', never.state === 'todo')

/* When a permit row does appear, it explains itself. */
for (const st of ['have', null]) {
  const row = at({ ...outdoor, permitStatus: st, sellerPermit: '' }, 'permit')!
  check(`permit ${st ?? 'unanswered'} explains itself`, row.detail.length > 15)
}
check('insurance on file settles insurance',
  at({ ...base, hasCoi: true }, 'coi')!.state === 'done')

/* What to do next, and whether they can load in. */
const paidClear: ChecklistInput = {
  ...base, booking: { status: 'confirmed', paymentDueAt: GONE }, hasCoi: true,
}
check('nothing left means no next action', !nextAction(checklistFor(paidClear)))
check('nothing blocking outstanding means clear for load-in',
  clearForLoadIn(checklistFor(paidClear)))
check('an unpaid fee is not clear for load-in', !clearForLoadIn(checklistFor(base)))

/* The list is deliberately not the whole truth, so clearance cannot be read
   off it alone. An occasional seller with no signed 410-D shows no permit row
   and is still not clear. */
const declaredClear: ChecklistInput = {
  ...paidClear, track: 'outdoor', permitStatus: 'occasional',
}
check('an occasional seller shows no permit row',
  !checklistFor(declaredClear).some((i) => i.key === 'permit'))
check('and the rows alone would wrongly say clear',
  clearForLoadIn(checklistFor(declaredClear)))
check('so the permit is asked directly, and they are not clear',
  !clearForLoadIn(checklistFor(declaredClear), true))
check('the item list never blocks load-in',
  checklistFor(paidClear).find((i) => i.key === 'items')!.blocksLoadIn === false)

/* Overdue is surfaced ahead of merely due, because it is the thing about to
   cost them something. */
const both = checklistFor({
  ...base, track: 'outdoor',
  booking: { status: 'awaiting_payment', paymentDueAt: GONE },
})
check('an overdue item is the next action', nextAction(both)!.state === 'overdue')
check('and it is the booth fee, not the permit', nextAction(both)!.key === 'fee')

/* Every row says something in the maker's terms, in every state. A blank
   detail line is how a dashboard becomes a wall of unexplained labels. */
for (const t of ['indoor', 'outdoor', 'both']) {
  for (const st of ['new', 'accepted']) {
    for (const row of checklistFor({ ...base, track: t, applicationStatus: st })) {
      check(`${t}/${st}/${row.key} explains itself`, row.detail.length > 15)
      check(`${t}/${st}/${row.key} has a title`, row.title.length > 2)
    }
  }
}

/* Every item a maker can act on says HOW. A row that says "your turn" with
   no way to act is worse than no row: there is no upload for insurance yet,
   so it has to name the address to send it to. */
for (const row of checklistFor({ ...base, track: 'outdoor' })) {
  if (row.state === 'todo' && !row.href) {
    check(`${row.key} says how to do it`, row.detail.includes('@'))
  }
}

/* Bank only changes what the fee row asks for. */
const startOnly = checklistFor({ ...base, startOnly: true }).find((i) => i.key === 'fee')!
check('bank only asks makers to start a transfer', startOnly.detail.includes('Start your bank transfer'))
check('otherwise it just says pay',
  checklistFor(base).find((i) => i.key === 'fee')!.detail.startsWith('Pay to confirm'))

/* A missing or unreadable date never invents urgency. */
check('an unreadable deadline is not overdue',
  at({ ...base, booking: { status: 'awaiting_payment', paymentDueAt: 'nope' } }, 'fee')!.state === 'todo')

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('maker checklist: only the right makers are asked, and a transfer in flight never reads as late')
export {}
