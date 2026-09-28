import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

/**
 * A booking is never created without its space row.
 *
 * Since 0055, /makers and /admin/lineup read booking_spaces, not
 * bookings.space_type_id. A booking inserted without a matching space row is
 * a maker who holds a space, has a pay link, owes money, and appears nowhere
 * on the public lineup. Nothing throws, nothing logs, and the first person to
 * notice is the maker asking why she is not on the website.
 *
 * That is exactly what happened the first time: the backfill in 0055 caught
 * every booking that existed and none of the three places that create one.
 *
 * So the whole tree is counted rather than trusted, the same way
 * can-send.test.ts counts the modules that can reach Resend.
 */
let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const root = new URL('../', import.meta.url)
const files = readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name))
  .map((e) => join(e.parentPath, e.name))

const creators = files.filter((f) => readFileSync(f, 'utf8').includes('.insert(bookings)'))
const short = (f: string) => f.replace(/^.*\/src\//, 'src/')

check(`every file that creates a booking also creates its space row, checked ${creators.length}`,
  creators.length > 0 && creators.every((f) => readFileSync(f, 'utf8').includes('.insert(bookingSpaces)')))

for (const f of creators) {
  check(`${short(f)} creates a booking_spaces row`,
    readFileSync(f, 'utf8').includes('.insert(bookingSpaces)'))
}

/* The three known ones. A fourth appearing is not an error, but it has to be
   seen: this list is how somebody notices a new path exists at all. */
check(`the creators are the three expected ones, found ${creators.map(short).sort().join(', ')}`,
  creators.length === 3
  && creators.some((f) => short(f) === 'src/app/actions.ts')
  && creators.some((f) => short(f) === 'src/server/modules/roster/apply.ts')
  && creators.some((f) => short(f) === 'src/db/seed.ts'))

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('booking spaces: no booking is created without the space row the lineup reads')
