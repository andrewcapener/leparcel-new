import { cleanLinkUrl, instagramUrl, makerLink } from './maker-link'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

check('a bare domain becomes https',
  cleanLinkUrl('mermademarket.com') === 'https://mermademarket.com/')
check('an http url is left as http',
  cleanLinkUrl('http://example.com/shop') === 'http://example.com/shop')
check('spacing does not matter', cleanLinkUrl('  example.com/a  ') === 'https://example.com/a')
check('empty is no link', cleanLinkUrl('') === null && cleanLinkUrl(null) === null)

/* This field becomes an href on a page shoppers read. */
check('javascript is refused', cleanLinkUrl('javascript:alert(1)') === null)
check('and refused however it is spelled',
  ['JavaScript:alert(1)', 'java\nscript:alert(1)', 'java\tscript:alert(1)',
    ' javascript:alert(1)'].every((t) => cleanLinkUrl(t) === null))
check('data and vbscript and file are refused',
  cleanLinkUrl('data:text/html,<script>') === null
  && cleanLinkUrl('vbscript:msgbox') === null
  && cleanLinkUrl('file:///etc/passwd') === null)
check('a protocol relative url is refused', cleanLinkUrl('//evil.com') === null)
check('a host with no dot is refused',
  cleanLinkUrl('localhost:3000') === null && cleanLinkUrl('intranet') === null)
check('nonsense is refused', cleanLinkUrl('http://') === null)

check('a handle becomes an instagram url',
  instagramUrl('@mermademarket') === 'https://instagram.com/mermademarket'
  && instagramUrl('mermademarket') === 'https://instagram.com/mermademarket')
check('a pasted instagram url is taken as one',
  instagramUrl('https://instagram.com/mermademarket') === 'https://instagram.com/mermademarket')
check('a handle with spaces or markup is refused',
  instagramUrl('two handles @a @b') === null)
check('no handle is no link', instagramUrl('') === null && instagramUrl(null) === null)

/* The order Elise depends on: her override wins, and clearing it hands the
   maker's own answer back rather than nothing. */
check('the staff override wins',
  makerLink({ linkUrl: 'shop.example.com', website: 'old.example.com', instagram: '@x' })
  === 'https://shop.example.com/')
check('clearing it falls back to the website',
  makerLink({ linkUrl: null, website: 'old.example.com', instagram: '@x' })
  === 'https://old.example.com/')
check('then to instagram',
  makerLink({ linkUrl: '', website: '', instagram: '@x' }) === 'https://instagram.com/x')
check('and a maker who gave us nothing is not a link',
  makerLink({ linkUrl: null, website: null, instagram: '' }) === null)
/* A bad override must not silently publish, but must not erase her real
   answer either. */
check('a refused override falls through rather than publishing',
  makerLink({ linkUrl: 'javascript:alert(1)', website: 'ok.example.com', instagram: '' })
  === 'https://ok.example.com/')

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('maker link: the staff override wins, and nothing but http or https ever reaches an href')
