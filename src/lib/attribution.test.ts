/**
 * Attribution is attacker-controlled input that lands in the database and
 * renders in the admin, so what it stores has to be boring by construction.
 */

export {}   // a module, so its locals do not collide with the other test scripts

import { attributionFrom, attributionLabel } from './attribution'

let failures = 0
const check = (what: string, ok: boolean, detail = '') => {
  if (!ok) { failures++; console.error(`  FAIL ${what}${detail ? `: ${detail}` : ''}`) }
}

// The tagged ad link.
check('utm params become one compact string',
  attributionFrom('?utm_source=meta&utm_medium=paid&utm_campaign=fall26_applications&utm_content=warm')
    === 'meta/paid/fall26_applications/warm')
check('and it labels as a Meta ad',
  attributionLabel('meta/paid/fall26_applications/warm') === 'Meta ad (warm)')

// A Meta click whose query got stripped somewhere along the way.
check('fbclid alone still says Meta', attributionFrom('?fbclid=IwAR123') === 'meta/paid/untagged')
check('utms win over fbclid',
  attributionFrom('?utm_source=meta&utm_medium=paid&fbclid=x').startsWith('meta/paid'))

// Nothing at all.
check('no query is direct', attributionFrom('') === '')
check('and reads as Direct', attributionLabel('') === 'Direct')

// A referrer, host only.
check('a referrer keeps only the host',
  attributionFrom('', 'https://www.instagram.com/p/abc?q=secret') === 'referral/instagram.com')
check('our own pages are not a referral',
  attributionFrom('', 'https://mermademarket.com/faq') === '')
check('a broken referrer is ignored', attributionFrom('', 'not a url') === '')

/* ── the part that matters: nothing dangerous is ever stored ───────────── */
const nasty = attributionFrom('?utm_source=<script>alert(1)</script>&utm_medium=a"b')
check('no angle brackets survive', !nasty.includes('<') && !nasty.includes('>'), nasty)
check('no quotes survive', !nasty.includes('"'), nasty)
check('the letters do survive, so it is still readable', nasty.includes('script'), nasty)

const long = attributionFrom('?utm_source=' + 'x'.repeat(500) + '&utm_campaign=' + 'y'.repeat(500))
check('it is length capped', long.length <= 160, String(long.length))

check('a semicolon or backslash is dropped',
  !attributionFrom('?utm_source=a;b\\c').includes(';'))

if (failures) { console.error(`attribution: ${failures} failure(s)`); process.exit(1) }
console.log('attribution: tagged clicks recorded, nothing dangerous stored')
