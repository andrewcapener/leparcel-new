import {
  feeBucket, matchesFee, matchesTrack, asTrack, asFee, isFiltered, filterWords,
  FEE_FILTERS,
} from './filters'

/**
 * A filter that quietly drops a row is worse than no filter, because the row
 * it drops is the maker nobody chases. So: every status lands in exactly one
 * bucket, and every bucket is reachable.
 */
let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const ALL = ['awaiting_payment', 'payment_processing', 'confirmed', 'forfeited', 'cancelled']

check('unpaid is the chase list', feeBucket('awaiting_payment') === 'unpaid')
check('a transfer in flight is its own bucket', feeBucket('payment_processing') === 'clearing')
check('confirmed is paid', feeBucket('confirmed') === 'paid')
/* Both ways of losing a space are one bucket: which one is a question for the
   audit log, not for a filter strip. */
check('forfeited is released', feeBucket('forfeited') === 'released')
check('cancelled is released', feeBucket('cancelled') === 'released')
/* Never silently vanish. An unknown status has to appear somewhere, and the
   chase list is the safe place for it to turn up. */
check('an unknown status still shows up', feeBucket('banana') === 'unpaid')

/* Every status is caught by exactly one bucket, and by "all". */
for (const s of ALL) {
  const hits = FEE_FILTERS.filter((f) => f !== 'all' && matchesFee(s, f))
  check(`${s} lands in exactly one bucket`, hits.length === 1)
  check(`${s} is never hidden by All`, matchesFee(s, 'all'))
}
/* And every bucket is reachable, so no strip button is dead. */
for (const f of FEE_FILTERS) {
  if (f === 'all') continue
  check(`the ${f} filter matches something`, ALL.some((s) => matchesFee(s, f)))
}

check('indoor matches indoor', matchesTrack('indoor', 'indoor'))
check('indoor does not match outdoor', !matchesTrack('indoor', 'outdoor'))
check('everyone matches both', matchesTrack('indoor', 'all') && matchesTrack('outdoor', 'all'))

/* A typo in the url must show everything, never nothing. */
check('a junk track reads as all', asTrack('sideways') === 'all')
check('a junk fee reads as all', asFee('maybe') === 'all')
check('a missing value reads as all', asTrack(undefined) === 'all' && asFee(undefined) === 'all')
check('a real value survives', asTrack('outdoor') === 'outdoor' && asFee('unpaid') === 'unpaid')

check('nothing narrowed is not filtered', !isFiltered('all', 'all'))
check('one of them is enough', isFiltered('outdoor', 'all') && isFiltered('all', 'paid'))
check('no words when nothing is narrowed', filterWords('all', 'all') === '')
check('both read together', filterWords('outdoor', 'unpaid') === 'outdoor, not paid')
check('one alone reads alone', filterWords('indoor', 'all') === 'indoor')

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('roster filters: every status lands in exactly one bucket, and a typo shows everything')
export {}
