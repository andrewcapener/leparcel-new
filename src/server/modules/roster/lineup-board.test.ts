import { orderedIds, orderChanges, visibilityChanges, boardNotice } from './lineup-board'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const known = ['a', 'b', 'c', 'd']

check('a clean post keeps its order',
  orderedIds('c,a,d,b', known).join(',') === 'c,a,d,b')
/* The quiet failure this exists to stop: a maker whose id did not survive the
   round trip keeps her place rather than disappearing. */
check('a maker missing from the post keeps her place',
  orderedIds('c,a', known).join(',') === 'c,a,b,d')
check('ids that are not on the board are ignored',
  orderedIds('c,zzz,a', known).join(',') === 'c,a,b,d')
check('a duplicate keeps its first position',
  orderedIds('c,a,c,b', known).join(',') === 'c,a,b,d')
check('empty and junk fall back to the board order',
  orderedIds('', known).join(',') === 'a,b,c,d'
  && orderedIds(' , ,', known).join(',') === 'a,b,c,d')

check('only the rows that moved are written',
  orderChanges(['a', 'b', 'c'], new Map([['a', 0], ['b', 9], ['c', 2]]))
    .map((c) => c.id).join(',') === 'b')
check('a maker who has never been placed is written',
  orderChanges(['a'], new Map([['a', null]])).length === 1)
check('nothing to do writes nothing',
  orderChanges(['a', 'b'], new Map([['a', 0], ['b', 1]])).length === 0)

/* A browser does not send an unchecked box, so absence means hidden, and that
   is only safe because `known` bounds what the board could touch. */
const v = visibilityChanges(['a', 'c'], known, new Set(['c', 'd']))
check('an unticked box hides, a ticked one lists',
  v.hide.join(',') === 'b' && v.list.join(',') === 'c')
check('a maker who was never on the board is never touched',
  visibilityChanges(['a'], ['a'], new Set(['zzz'])).hide.length === 0)
check('no change means no writes',
  visibilityChanges(['a', 'b'], ['a', 'b'], new Set()).hide.length === 0
  && visibilityChanges(['a', 'b'], ['a', 'b'], new Set()).list.length === 0)

check('the notice counts what happened',
  boardNotice(3, 1, 0) === 'Saved: 3 makers moved, 1 taken off. The public lineup is updated.')
check('one maker is singular', boardNotice(1, 0, 0).includes('1 maker moved'))
check('nothing is said plainly', boardNotice(0, 0, 0) === 'Nothing changed.')
check('the notice carries no fancy dash and no exclamation',
  [boardNotice(3, 1, 2), boardNotice(0, 0, 0)].every((t) =>
    !t.includes('!') && !t.includes(String.fromCharCode(0x2014)) && !t.includes(String.fromCharCode(0x2013))))

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('lineup board: a dropped id keeps its place, and only what moved is written')
