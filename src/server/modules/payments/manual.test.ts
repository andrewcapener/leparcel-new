import {
  venmoUser, payNote, venmoUrl, manualOptions, offersManualPay,
  zelleToken, zelleQrUrl,
} from './manual'

/**
 * Venmo and Zelle. Every one of these payments is matched by a person, so the
 * thing under test is whether that person is reading a code or guessing.
 */

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

/* Handles get typed by hand into an admin box, with whatever the phone's
   keyboard added. None of it belongs in a url. */
check('a leading at sign is dropped', venmoUser('@MermadeMarket') === 'MermadeMarket')
check('several are too', venmoUser('@@MermadeMarket') === 'MermadeMarket')
check('surrounding space is dropped', venmoUser('  MermadeMarket  ') === 'MermadeMarket')
check('inner space is dropped', venmoUser('Mermade Market') === 'MermadeMarket')
check('an empty handle stays empty', venmoUser('   ') === '')

/* The note IS the reconciliation. The MM code leads, because payment apps
   truncate and because it is the only part staff need. */
const note = payNote('MM07', 'Fall 2026')
check('the note leads with the code', note.startsWith('MM07'))
check('and names the show for whoever reads a statement later', note.includes('Fall 2026'))

/* Dollars, not cents: Venmo's parameter is a dollar figure, and getting this
   wrong bills somebody $28,000 for a $280 space. */
const url = venmoUrl('@MermadeMarket', 28000, note)
check('the amount is dollars with two decimals', url.includes('amount=280.00'))
check('a price with cents survives', venmoUrl('x', 31250, 'n').includes('amount=312.50'))
check('a small fee survives', venmoUrl('x', 6000, 'n').includes('amount=60.00'))
check('the handle is cleaned in the url', url.includes('recipients=MermadeMarket'))
check('and never carries the at sign', !url.includes('%40MermadeMarket'))
check('it is a pay, not a request', url.includes('txn=pay'))

/* The note is user-ish text going into a query string. Spaces and anything
   else must be escaped, or the link truncates at the first space and the
   amount is lost with it. */
const spaced = venmoUrl('x', 100, 'MM07 booth fee Fall 2026')
check('spaces in the note are escaped', !spaced.includes('note=MM07 booth'))
check('and the note survives intact',
  new URL(spaced).searchParams.get('note') === 'MM07 booth fee Fall 2026')
check('an ampersand in a show name cannot split the query',
  new URL(venmoUrl('x', 100, 'MM07 & co')).searchParams.get('amount') === '1.00')

/* Nothing is offered that has not been configured. A QR pointing nowhere is
   worse than no section: it takes a maker's money to an empty handle. */
check('no handles means nothing is offered', !offersManualPay({ venmoHandle: '', zelleContact: '' }))
check('whitespace is not a handle',
  !offersManualPay({ venmoHandle: '  ', zelleContact: ' ' }))
check('an at sign alone is not a handle',
  !offersManualPay({ venmoHandle: '@', zelleContact: '' }))
check('either one alone is enough',
  offersManualPay({ venmoHandle: '@m', zelleContact: '' })
  && offersManualPay({ venmoHandle: '', zelleContact: 'pay@x.com' }))

const both = manualOptions(
  { venmoHandle: '@MermadeMarket', zelleContact: 'hello@mermademarket.com' },
  28000, 'MM07', 'Fall 2026',
)
check('both are offered', both.length === 2)
/* Venmo first: it is the one that can actually be tapped. Zelle lives inside
   each bank's own app and has no universal link. */
check('the tappable one comes first', both[0]!.kind === 'venmo')
check('the venmo handle is shown with its at sign for a human',
  both[0]!.kind === 'venmo' && both[0].handle === '@MermadeMarket')
check('every option carries the same note', both[0]!.note === both[1]!.note)
check('and the note is the code', both[1]!.note.startsWith('MM07'))

check('only zelle configured offers only zelle',
  manualOptions({ venmoHandle: '', zelleContact: 'a@b.com' }, 100, 'MM01', 'S')
    .every((o) => o.kind === 'zelle'))
check('nothing configured offers nothing',
  manualOptions({ venmoHandle: '', zelleContact: '' }, 100, 'MM01', 'S').length === 0)

/* ── Zelle ──
   Their bank's own code decoded to a documented payload, so the code is
   generated rather than stored as an uploaded picture. The assertion that
   matters is that what we build is what their bank built. */
const THEIRS = 'https://enroll.zellepay.com/qr-codes?data=eyJ0b2tlbiI6Ijk0OTY3MjgwMTkiLCJuYW1lIjoiTUVSTUFERSBNQVJLRVQgTExDIEFjY291bnRzIn0='
check('the generated code matches the one the bank produced',
  zelleQrUrl('949-672-8019', 'MERMADE MARKET LLC Accounts') === THEIRS)
/* A person types a phone number with separators. Their bank's payload had
   none, and a token with dashes in it is a payment that goes nowhere. */
check('a typed phone number loses its separators', zelleToken('949-672-8019') === '9496728019')
check('and its spaces and brackets', zelleToken('(949) 672 8019') === '9496728019')
check('an email is left exactly alone', zelleToken('hello@mermademarket.com') === 'hello@mermademarket.com')
check('the same number typed two ways makes one code',
  zelleQrUrl('949-672-8019', 'X') === zelleQrUrl('(949) 672-8019', 'X'))

/* No name, no code. A wrong recipient name on a payment screen is how a maker
   decides the page is a scam, so a missing one draws nothing at all. */
check('no registered name means no code', zelleQrUrl('949-672-8019', '') === null)
check('and no contact means no code', zelleQrUrl('', 'Name') === null)
check('whitespace is neither', zelleQrUrl('  ', '  ') === null)

const z = manualOptions(
  { venmoHandle: '', zelleContact: '949-672-8019', zelleName: 'MERMADE MARKET LLC Accounts' },
  28000, 'MM07', 'Fall 2026',
)[0]!
check('the zelle option carries its code', z.kind === 'zelle' && z.url === THEIRS)
check('the contact is shown as typed, not as tokenised',
  z.kind === 'zelle' && z.contact === '949-672-8019')
/* Zelle without a name still has to be payable: the number is the path that
   always works, and the code is only a shortcut. */
const noName = manualOptions(
  { venmoHandle: '', zelleContact: '949-672-8019' }, 28000, 'MM07', 'Fall 2026',
)[0]!
check('zelle with no registered name is still offered', noName.kind === 'zelle')
check('it just has no code to scan', noName.kind === 'zelle' && noName.url === null)

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('manual pay: the MM code travels with the money, the Zelle code matches the bank\u2019s, and nothing unconfigured is ever offered')
export {}
