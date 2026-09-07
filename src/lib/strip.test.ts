/**
 * The filmstrip must never show the same maker twice in a row.
 *
 * Drew, the morning it shipped: "there were a bunch at the beginning that
 * were the same person." 213 and 214 are one maker at one booth and they were
 * neighbours. The fix was an order, not a shuffle, and this is what keeps it
 * an order: the rules are written down here so the next person to add a
 * photograph finds out immediately if they broke one.
 *
 * The strip LOOPS, so these are checked around the cycle, last against first.
 */

export {}   // a module, so its locals do not collide with the other test scripts

import { stripFrames, rotated } from './content'

/* Who and what is in each frame. Kept here rather than in content.ts because
   it is test knowledge: it exists to express the rules, not to render. */
const MAKER: Record<string, string> = {
  'mermade-213.jpg': 'timeka', 'mermade-214.jpg': 'timeka',
}
const STILL_LIFE = new Set(['mermade-23.jpg', 'mermade-27.jpg', 'mermade-123.jpg'])
const LANDSCAPE = new Set(['mermade-23.jpg', 'mermade-183.jpg', 'mermade-214.jpg'])

let failures = 0
const check = (what: string, ok: boolean, detail = '') => {
  if (!ok) { failures++; console.error(`  FAIL ${what}${detail ? `: ${detail}` : ''}`) }
}

/** Every neighbouring pair, including the wrap from last back to first. */
function pairs<T>(list: readonly T[]): Array<[T, T]> {
  return list.map((x, i) => [x, list[(i + 1) % list.length]] as [T, T])
}

const files = stripFrames.map((f) => f.file)

for (const [a, b] of pairs(files)) {
  check('no maker follows herself', !(MAKER[a] && MAKER[a] === MAKER[b]), `${a} then ${b}`)
  check('no two still lifes in a row', !(STILL_LIFE.has(a) && STILL_LIFE.has(b)), `${a} then ${b}`)
  check('no two landscapes in a row', !(LANDSCAPE.has(a) && LANDSCAPE.has(b)), `${a} then ${b}`)
}

check('every frame is used once', new Set(files).size === files.length)
check('every frame has alt text', stripFrames.every((f) => f.alt.trim().length > 8))

/* Rotation is what makes the strip different each visit, and it is only safe
   because it preserves every pair above. Check that at every offset, which is
   the whole argument for rotating rather than shuffling. */
for (let by = 0; by < files.length; by++) {
  const turned = rotated(stripFrames, by).map((f) => f.file)
  check(`rotation by ${by} keeps every frame`, new Set(turned).size === files.length)
  for (const [a, b] of pairs(turned)) {
    check(`rotation by ${by} keeps makers apart`,
      !(MAKER[a] && MAKER[a] === MAKER[b]), `${a} then ${b}`)
    check(`rotation by ${by} keeps still lifes apart`,
      !(STILL_LIFE.has(a) && STILL_LIFE.has(b)), `${a} then ${b}`)
  }
}

// Rotation is arithmetic on an index, so it must survive nonsense.
check('a negative offset wraps', rotated(stripFrames, -1)[0]?.file === files[files.length - 1])
check('an offset past the end wraps', rotated(stripFrames, files.length)[0]?.file === files[0])
check('an empty list is left alone', rotated([], 3).length === 0)

if (failures) { console.error(`strip: ${failures} failure(s)`); process.exit(1) }
console.log('strip: no maker follows herself, at any rotation')
