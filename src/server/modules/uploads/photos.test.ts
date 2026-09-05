/**
 * The photograph rules, tested where they are load-bearing: the key format
 * that keeps a hand-built POST inside its own prefix, and the byte sniff that
 * decides what an uploaded object really is. Both of those are the only thing
 * standing between a public bucket and whatever anyone feels like putting in
 * it, so neither gets to be "probably right".
 *
 * Run by `npm test`.
 */
import {
  MAX_PHOTOS, isPhotoKey, isPhotoType, parsePhotoKeys, photoKey, sniffPhotoType,
} from './photos'

let failures = 0
function check(name: string, cond: boolean) {
  if (!cond) { failures += 1; console.error(`  ✗ ${name}`) }
}

const SHOW = 'fall-2026'
const A = '11111111-2222-3333-4444-555555555555'
const B = '66666666-7777-8888-9999-aaaaaaaaaaaa'

/* ── keys ── */
const good = photoKey(SHOW, A, B, 'image/jpeg')
check('a minted key round-trips', good === `applications/${SHOW}/${A}/${B}.jpg` && isPhotoKey(good))
check('heic keeps its extension', photoKey(SHOW, A, B, 'image/heic').endsWith('.heic'))
check('another bucket is refused', !isPhotoKey(`vendor-documents/${SHOW}/${A}/${B}.jpg`))
check('traversal is refused', !isPhotoKey(`applications/../../${A}/${B}.jpg`))
check('a foreign extension is refused', !isPhotoKey(`applications/${SHOW}/${A}/${B}.svg`))
check('a short id is refused', !isPhotoKey(`applications/${SHOW}/${A}/abc.jpg`))
check('an absolute url is refused', !isPhotoKey(`https://evil.example/${B}.jpg`))

/* ── the posted field ── */
const many = Array.from({ length: MAX_PHOTOS + 3 }, (_, i) =>
  photoKey(SHOW, A, `${'0'.repeat(7)}${i}-7777-8888-9999-aaaaaaaaaaaa`, 'image/png'))
// The cap is a knob (MAX_PHOTOS), so this asserts the property that holds at
// any setting: what comes back is the leading run of what went in.
const ordered = [good, ...many]
check('order is preserved', parsePhotoKeys(JSON.stringify(ordered))
  .every((k, i) => k === ordered[i]))
check('over the cap is trimmed', parsePhotoKeys(JSON.stringify(many)).length === MAX_PHOTOS)
check('duplicates collapse', parsePhotoKeys(JSON.stringify([good, good])).length === 1)
check('junk entries are dropped', parsePhotoKeys(JSON.stringify([good, 7, null, '../x'])).length === 1)
check('malformed json is empty', parsePhotoKeys('{oh no').length === 0)
check('an empty field is empty', parsePhotoKeys('').length === 0)
check('a non-array is empty', parsePhotoKeys('"a string"').length === 0)

/* ── the bytes ── */
const bytes = (...n: number[]) => new Uint8Array(n)
const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0))
const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}
const pad = (n: number) => new Uint8Array(n)

check('jpeg', sniffPhotoType(join(bytes(0xff, 0xd8, 0xff, 0xe0), pad(20))) === 'image/jpeg')
check('png', sniffPhotoType(join(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), pad(16))) === 'image/png')
check('webp', sniffPhotoType(join(ascii('RIFF'), pad(4), ascii('WEBP'), pad(12))) === 'image/webp')
check('heic', sniffPhotoType(join(pad(4), ascii('ftyp'), ascii('heic'), pad(12))) === 'image/heic')
check('heif', sniffPhotoType(join(pad(4), ascii('ftyp'), ascii('mif1'), pad(12))) === 'image/heif')

check('an mp4 is not a photograph', sniffPhotoType(join(pad(4), ascii('ftyp'), ascii('isom'), pad(12))) === null)
check('a pdf is not a photograph', sniffPhotoType(join(ascii('%PDF-1.7'), pad(16))) === null)
check('an svg is not a photograph', sniffPhotoType(join(ascii('<svg xmlns="http'), pad(8))) === null)
check('a zip is not a photograph', sniffPhotoType(join(bytes(0x50, 0x4b, 0x03, 0x04), pad(20))) === null)
check('a riff that is not webp', sniffPhotoType(join(ascii('RIFF'), pad(4), ascii('WAVE'), pad(12))) === null)
check('an empty file is nothing', sniffPhotoType(new Uint8Array(0)) === null)
check('a truncated jpeg is nothing', sniffPhotoType(bytes(0xff, 0xd8)) === null)

/* ── the allowlist ── */
check('jpeg is allowed', isPhotoType('image/jpeg'))
check('gif is not', !isPhotoType('image/gif'))
check('svg is not', !isPhotoType('image/svg+xml'))

if (failures > 0) {
  console.error(`photos: ${failures} failed`)
  process.exit(1)
}
console.log('photos: key format, posted field, and byte sniff all pass')
