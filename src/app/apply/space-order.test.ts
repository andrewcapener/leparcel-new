/**
 * A maker's ranking has to survive the POST.
 *
 * Valerie, on the morning applications opened: "Was trying to put my days in
 * order of 1, 2 or 3 choice and when i would click Saturday as first choice,
 * Sunday as second and Friday as third it kept making Friday first."
 *
 * She was right. A checkbox posts in the order it sits in the document, never
 * in the order somebody ticked it, so the first requested space was always
 * whichever one we happened to list first. The hidden spaceOrder field is what
 * carries the real ranking, and this is the logic that reads it, kept in step
 * with the copy in src/app/actions.ts.
 */

/** The same sort the action does. */
function rank(posted: string[], order: string[]): string[] {
  if (order.length === 0) return posted
  const rankOf = (id: string) => {
    const i = order.indexOf(id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  return [...posted].sort((a, b) => rankOf(a) - rankOf(b))
}

let failures = 0
const check = (what: string, ok: boolean, detail = '') => {
  if (!ok) { failures++; console.error(`  FAIL ${what}${detail ? `: ${detail}` : ''}`) }
}
const eq = (a: string[], b: string[]) => a.join(',') === b.join(',')

// Valerie's case exactly. Friday is listed first; she wanted it last.
const listed = ['fri', 'sat', 'sun']
check("her ranking wins over ours",
  eq(rank(listed, ['sat', 'sun', 'fri']), ['sat', 'sun', 'fri']),
  rank(listed, ['sat', 'sun', 'fri']).join(','))

// One choice, the common case.
check('a single pick is unchanged', eq(rank(['sat'], ['sat']), ['sat']))

// Ticked in listed order: nothing should move.
check('agreeing with the listing changes nothing',
  eq(rank(listed, ['fri', 'sat', 'sun']), ['fri', 'sat', 'sun']))

// Backwards compatibility: a cached page posts no order at all.
check('no ranking falls back to document order', eq(rank(listed, []), listed))

// The ranking may only sort what was posted, never add to it. This is the
// property that stops a hand-built POST from smuggling a space in.
check('an id only in the ranking is not added',
  eq(rank(['sat'], ['boutique', 'sat']), ['sat']),
  rank(['sat'], ['boutique', 'sat']).join(','))
check('an id missing from the ranking still survives, at the end',
  eq(rank(['fri', 'sat'], ['sat']), ['sat', 'fri']),
  rank(['fri', 'sat'], ['sat']).join(','))

// A maker who unticks and reticks: the id appears once, at its new place.
check('reticking moves it to the end of the ranking',
  eq(rank(listed, ['sat', 'fri']), ['sat', 'fri', 'sun']),
  rank(listed, ['sat', 'fri']).join(','))

if (failures) { console.error(`space order: ${failures} failure(s)`); process.exit(1) }
console.log('space order: the first box a maker ticks is the space we book')
