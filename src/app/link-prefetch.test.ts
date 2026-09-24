import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A <Link> may not point at /api/.
 *
 * next/link prefetches. It fetches the href when the link enters the viewport,
 * before anybody has decided to press it, and a route handler under /api does
 * not know a prefetch from a click: it just runs.
 *
 * That is not theoretical. /api/preview?on=0 is the link in the launch preview
 * bar, and its whole job is to clear the preview cookie. As a <Link> it fired
 * the moment the bar scrolled into view for the one person it was aimed at, a
 * signed-in staff member, and the preview turned itself off part way through a
 * rehearsal with nothing on screen to explain it. It was read as the cookie
 * expiring and answered with a longer cookie, twice, which never touched the
 * cause.
 *
 * A plain <a> is not prefetched, and a route handler is not a page worth
 * client-navigating to anyway, so the rule is simply: anchors for /api.
 *
 * Only Link is checked. A form, a fetch or an anchor all wait to be asked.
 */

const ROOT = 'src'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx$/.test(p)) out.push(p)
  }
  return out
}

/* <Link ... href="/api/..."> with anything in between, including newlines,
   but not so greedy that it crosses out of the tag into a later one. */
const LINK_TO_API = /<Link\b[^>]*?href=(?:"|'|\{")\/api\//s

const offenders: string[] = []
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8')
  if (!/from ['"]next\/link['"]/.test(src)) continue
  /* Tag by tag, so one Link elsewhere in a big file cannot mask another. */
  for (const tag of src.match(/<Link\b[\s\S]*?>/g) ?? []) {
    if (LINK_TO_API.test(tag)) offenders.push(`${file}: ${tag.replace(/\s+/g, ' ').slice(0, 90)}`)
  }
}

if (offenders.length > 0) {
  console.error(
    'These <Link>s point at a route handler, which next/link will fetch '
    + 'before anybody clicks. Use a plain <a>.',
  )
  for (const o of offenders) console.error(`  ${o}`)
  process.exit(1)
}

console.log('link prefetch: no <Link> fires a route handler on its own')
