import { backTo } from './back'

let failures = 0
const eq = (what: string, got: unknown, want: unknown) => {
  if (!Object.is(got, want)) {
    console.error(`FAIL ${what}\n     got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)
    failures++
  }
}

/* The bug this exists for: the return path already carries the list she was
   looking at, so a second ? swallows the outcome and the screen says nothing. */
eq('an existing query gets an ampersand',
  backTo('/admin/thumbnails?show=all', 'set'), '/admin/thumbnails?show=all&thumb=set')
eq('a bare path gets a question mark',
  backTo('/admin/thumbnails', 'set'), '/admin/thumbnails?thumb=set')
eq('every outcome travels the same way',
  backTo('/admin/thumbnails?show=missing', 'foreign'),
  '/admin/thumbnails?show=missing&thumb=foreign')

/* `back` is a form field, so it is somebody else's input. */
eq('another site is refused', backTo('https://evil.example.com', 'set'), '/admin/thumbnails?thumb=set')
eq('a protocol-relative url is refused', backTo('//evil.example.com', 'set'), '/admin/thumbnails?thumb=set')
eq('a path outside the admin is refused', backTo('/apply', 'set'), '/admin/thumbnails?thumb=set')
eq('and so is nonsense', backTo('', 'set'), '/admin/thumbnails?thumb=set')

if (failures > 0) { console.error(`\n${failures} failure(s).`); process.exit(1) }
console.log('thumbnail back: the outcome survives the return path, and only our own paths are followed')
