/**
 * Two jobs. Prove plainDashes substitutes by meaning, and stand as the guard
 * that stops en dashes coming back into shipped copy.
 *
 * The guard is the reason this runs in `npm test`. Copy arrives by paste, from
 * a Shopify export, a phone, or a document, and every one of those sources
 * produces en dashes without being asked. Three had already reached the live
 * application page that way.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { plainDashes, hasFancyDash } from './dashes'

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  if (!ok) { failures += 1; console.error(`  FAIL ${name}${detail ? `: ${detail}` : ''}`) }
}

/* ── substitution ───────────────────────────────────────────────────────── */

const CASES: Array<[string, string]> = [
  // A range joins what is either side of it, however it was spaced.
  ['Friday 13 November, 9 – 6pm', 'Friday 13 November, 9 to 6pm'],
  ['Friday 13 November, 9am–6pm', 'Friday 13 November, 9am to 6pm'],
  ['5,000–6,000 visitors', '5,000 to 6,000 visitors'],
  ['Nov 13 – Nov 15', 'Nov 13 to Nov 15'],
  // An em dash ends a clause, so it becomes a comma and loses the space before.
  ['supportive—from the start', 'supportive, from the start'],
  ['detailed — hang with us', 'detailed, hang with us'],
  // Plain hyphens are not what this is about.
  ['Load-in and take-down', 'Load-in and take-down'],
  ['Thursday 12 November, 1-7pm', 'Thursday 12 November, 1-7pm'],
  ['12ft wide, 3ft deep', '12ft wide, 3ft deep'],
  // Nothing to do.
  ['Sunday 15 November at 5pm sharp', 'Sunday 15 November at 5pm sharp'],
  ['', ''],
]
for (const [input, want] of CASES) {
  const got = plainDashes(input)
  check(`plainDashes(${JSON.stringify(input)})`, got === want, `got ${JSON.stringify(got)}`)
  check('output is clean', !hasFancyDash(got), got)
}
check('idempotent', CASES.every(([i]) => plainDashes(plainDashes(i)) === plainDashes(i)))

/* ── the guard ──────────────────────────────────────────────────────────── */

/** Files whose job is to handle dashes, and so must be allowed to name them. */
const ALLOWED = new Set([
  'src/lib/dashes.ts', 'src/lib/dashes.test.ts',
  // schedule.ts parses the dash a phone produces; its test has to type one.
  'src/lib/schedule.ts', 'src/lib/schedule.test.ts',
])
/** Where user-facing strings live. Comments are excluded below, docs are not
 *  shipped, and the vendored theme under public/ is checked separately. */
const ROOTS = ['src']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(p)) out.push(p)
  }
  return out
}

/** Strip comments, so a dash in an explanation is not a failure. Crude on
 *  purpose: it only has to avoid false alarms, and a string that looks like a
 *  comment is not something we lose sleep over. */
function withoutComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

const FANCY = /[‐-―−]/
for (const root of ROOTS) {
  for (const file of walk(root)) {
    if (ALLOWED.has(file.replace(/\\/g, '/'))) continue
    const body = withoutComments(readFileSync(file, 'utf8'))
    // Both the literal character and the \uXXXX escape, because the copy
    // ported out of Shopify arrived escaped and that is how three of them
    // reached the live site unnoticed.
    const literal = FANCY.test(body)
    const escaped = /\\u201[0-5]|\\u2212/.test(body)
    check(`no dash in ${file}`, !literal && !escaped,
      literal ? 'literal dash character' : escaped ? 'escaped \\u201x dash' : '')
  }
}

if (failures) {
  console.error(`dashes: ${failures} failure(s)`)
  process.exit(1)
}
console.log('dashes: substitution holds, and no en or em dash is in shipped copy')
