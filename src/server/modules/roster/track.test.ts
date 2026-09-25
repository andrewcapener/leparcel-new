import { moveProblem, tradingTrack, moveNotice } from './track'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

/* The case this exists for: Sunsea candles, paid, indoor, should be outdoor. */
check('a paid booking can still be moved across tracks',
  moveProblem({ holdsSpace: true, fromTrack: 'indoor', toTrack: 'outdoor' }) === undefined)
check('and back the other way',
  moveProblem({ holdsSpace: true, fromTrack: 'outdoor', toTrack: 'indoor' }) === undefined)
/* Sunsea again: moved to outdoor, landed on Friday, needs Saturday. Same
   track, already paid, and no other control will take it. */
check('a same track move is allowed, because the paid space control will not do it',
  moveProblem({ holdsSpace: true, fromTrack: 'outdoor', toTrack: 'outdoor', fromSpaceId: 'fri', toSpaceId: 'sat' }) === undefined)
check('only a genuine no-op is refused',
  moveProblem({ holdsSpace: true, fromTrack: 'outdoor', toTrack: 'outdoor', fromSpaceId: 'fri', toSpaceId: 'fri' }) === 'same_space')
check('a released booking has nothing to move',
  moveProblem({ holdsSpace: false, fromTrack: 'indoor', toTrack: 'outdoor' }) === 'released')
check('a missing space on either side refuses',
  moveProblem({ holdsSpace: true, fromTrack: undefined, toTrack: 'outdoor' }) === 'missing'
  && moveProblem({ holdsSpace: true, fromTrack: 'indoor', toTrack: undefined }) === 'no_space')

/* What she DOES beats what she applied as, everywhere it decides money or
   paperwork. Sunsea applied indoor and stands outdoors. */
check('the booked space decides the track, not the application',
  tradingTrack('outdoor', 'indoor') === 'outdoor')
check('and the application is the fallback when there is no space',
  tradingTrack(undefined, 'indoor') === 'indoor')

check('the move notice says the fee did not change',
  (moveNotice('moved') ?? '').includes('fee is unchanged'))
check('every notice is dash free and unexcited',
  ['moved', 'same_space', 'released', 'missing', 'no_space'].every((c) => {
    const t = moveNotice(c) ?? ''
    return t.length > 0 && !t.includes('!')
      && !t.includes(String.fromCharCode(0x2014)) && !t.includes(String.fromCharCode(0x2013))
  }))
check('an unknown code says nothing', moveNotice('nope') === null)

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('track move: a paid maker can be recategorised, and the booked space decides the track')
