import { parsePhotos, thumbnailFor, needsThumbnail, isOwnPhotoUrl } from './thumbnail'

/**
 * The square a maker is shown by. The rule that matters most is that a staff
 * choice never destroys what the maker sent: clear it and their own first
 * photograph comes back.
 */
let failures = 0
function ok(what: string, cond: boolean, detail = '') {
  if (!cond) { console.error(`FAIL ${what}${detail ? `\n     ${detail}` : ''}`); failures++ }
}
const eq = (what: string, got: unknown, want: unknown) =>
  ok(what, JSON.stringify(got) === JSON.stringify(want),
    `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)

const BASE = 'https://qobjvearelvdcvdcffhn.supabase.co'
const own = (n: string) => `${BASE}/storage/v1/object/public/application-photos/${n}.jpg`

/* ── where the square comes from ── */
eq("a maker's own first photo, when staff have not chosen",
  thumbnailFor({ photos: JSON.stringify([own('a'), own('b')]) }),
  { url: own('a'), source: 'uploaded' })

eq('a staff choice wins over it',
  thumbnailFor({ thumbnailUrl: own('chosen'), photos: JSON.stringify([own('a')]) }),
  { url: own('chosen'), source: 'chosen' })

eq('and clearing the choice hands the maker their own photo back',
  thumbnailFor({ thumbnailUrl: null, photos: JSON.stringify([own('a')]) }),
  { url: own('a'), source: 'uploaded' })

eq('nothing at all', thumbnailFor({ photos: '[]' }), { url: null, source: 'none' })
eq('an empty choice is not a choice',
  thumbnailFor({ thumbnailUrl: '   ', photos: '[]' }), { url: null, source: 'none' })

/* ── one bad row must never take down a grid of ninety two ── */
eq('corrupt JSON reads as no photos', parsePhotos('{not json'), [])
eq('null reads as no photos', parsePhotos(null), [])
eq('an object is not a list', parsePhotos('{"a":1}'), [])
eq('non-strings are dropped', parsePhotos('["' + own('a') + '",3,null,true]'), [own('a')])
eq('blank entries are dropped', parsePhotos('["","  ","' + own('a') + '"]'), [own('a')])

eq('who still needs one', needsThumbnail({ photos: '[]' }), true)
eq('and who does not', needsThumbnail({ photos: JSON.stringify([own('a')]) }), false)
eq('a staff choice counts as having one',
  needsThumbnail({ thumbnailUrl: own('c'), photos: '[]' }), false)

/* ── only our own storage is ever stored or rendered ── */
ok('our own bucket is fine', isOwnPhotoUrl(own('a'), BASE))
ok('somebody else’s server is not',
  !isOwnPhotoUrl('https://evil.example.com/a.jpg', BASE))
ok('nor a lookalike host',
  !isOwnPhotoUrl('https://qobjvearelvdcvdcffhn.supabase.co.evil.com/storage/v1/object/public/x', BASE))
ok('nor plain http', !isOwnPhotoUrl(own('a').replace('https:', 'http:'), BASE))
ok('nor a javascript url', !isOwnPhotoUrl('javascript:alert(1)', BASE))
ok('nor a data url', !isOwnPhotoUrl('data:image/png;base64,AAAA', BASE))
ok('nor the private object path', !isOwnPhotoUrl(
  `${BASE}/storage/v1/object/sign/application-photos/a.jpg`, BASE))
ok('and with no project configured it fails closed', !isOwnPhotoUrl(own('a'), ''))
ok('a trailing slash on the base does not matter', isOwnPhotoUrl(own('a'), `${BASE}/`))

if (failures > 0) { console.error(`\n${failures} failure(s).`); process.exit(1) }
console.log("thumbnail: a staff choice never destroys the maker's own photo, and only our own storage is rendered")
