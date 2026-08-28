// Runs during the Vercel build (see vercel.json buildCommand), after seeding
// and before `next build`. Records what ./mermade.db contained at that moment
// into public/build-info.json, which is served statically — so a deployed
// site can always be compared against the database state its build produced.
import Database from 'better-sqlite3'
import { statSync, writeFileSync } from 'fs'

const db = new Database('./mermade.db', { readonly: true })
const count = (t) => db.prepare(`select count(*) c from ${t}`).get().c
const info = {
  builtAt: new Date().toISOString(),
  commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
  dbSize: statSync('./mermade.db').size,
  shows: count('shows'),
  applications: count('applications'),
  bookings: count('bookings'),
}
db.close()
writeFileSync('public/build-info.json', JSON.stringify(info, null, 2) + '\n')
console.log('build-info:', JSON.stringify(info))
