/**
 * The two curation rules Elise asked for, and the two directions they must
 * stay open in. A rule that quietly blocks the wrong people is worse than no
 * rule, because nobody reports the application they gave up on.
 */
import { spaceAllowed, blockedCodes } from './eligibility'

let failures = 0
function check(what: string, ok: boolean, detail = '') {
  if (!ok) { failures++; console.error(`  FAIL ${what}${detail ? `: ${detail}` : ''}`) }
}

// Apparel and the 3x4.
check('apparel cannot take a 3x4', !spaceAllowed('IN-3x4', 'Apparel').ok)
check('and is told why', /apparel/i.test(
  (spaceAllowed('IN-3x4', 'Apparel') as { reason: string }).reason))
check('ceramics can take a 3x4', spaceAllowed('IN-3x4', 'Ceramics').ok)
check('vintage can take a 3x4', spaceAllowed('IN-3x4', 'Vintage').ok)
check('apparel can take a 3x6', spaceAllowed('IN-3x6', 'Apparel').ok)
check('apparel can take a 3x12', spaceAllowed('IN-3x12', 'Apparel').ok)

// Treats on a Shelf.
check('treats can take the shelf', spaceAllowed('IN-TREAT', 'Treats').ok)
check('candles cannot', !spaceAllowed('IN-TREAT', 'Candles').ok)
check('apparel cannot', !spaceAllowed('IN-TREAT', 'Apparel').ok)

// Open by default, in both directions.
check('a space with no rule is open to everyone', spaceAllowed('IN-3x8', 'Apparel').ok)
check('an unknown code is open', spaceAllowed('OUT-FRI', 'Apparel').ok)
check('no category chosen yet blocks nothing', spaceAllowed('IN-3x4', undefined).ok)
check('nor for the shelf', spaceAllowed('IN-TREAT', undefined).ok)
check('nor an empty string', spaceAllowed('IN-3x4', '').ok)

// What the server refuses.
check('apparel is blocked from both', blockedCodes('Apparel').sort().join(',') === 'IN-3x4,IN-TREAT',
  blockedCodes('Apparel').join(','))
check('treats is blocked from nothing', blockedCodes('Treats').length === 0,
  blockedCodes('Treats').join(','))
check('ceramics is blocked from the shelf only', blockedCodes('Ceramics').join(',') === 'IN-TREAT',
  blockedCodes('Ceramics').join(','))
check('no category blocks nothing', blockedCodes(undefined).length === 0)

if (failures) { console.error(`spaces: ${failures} failure(s)`); process.exit(1) }
console.log('spaces: apparel is off the 3x4, the shelf is baked goods only, everything else is open')
