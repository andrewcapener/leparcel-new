import { spreadsheetIdFrom, colLetter, LINKS_TAB, PAYMENTS_TAB } from './sheet-push'
import { LINK_COLUMNS, PAYMENT_COLUMNS } from './payment-export'

/**
 * The pure halves: which sheet, and how wide. Everything else in that module
 * is Google's to answer.
 */
let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

/* What somebody actually pastes. The real sheet's id is in the first two. */
const ID = '1qkK8tJwgwalcFrI0xTMnkZosdC_DSP3cgV47N6Do_dM'
check('an edit URL out of the address bar',
  spreadsheetIdFrom(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`) === ID)
check('a share URL with query junk on it',
  spreadsheetIdFrom(`https://docs.google.com/spreadsheets/d/${ID}/edit?usp=drivesdk&ouid=1061`) === ID)
check('a bare id', spreadsheetIdFrom(ID) === ID)
check('whitespace around it', spreadsheetIdFrom(`  ${ID}  `) === ID)
check('a Drive folder URL is not a sheet',
  spreadsheetIdFrom('https://drive.google.com/drive/folders/0ACTYWjGfTCG_Uk9PVA') === null)
check('empty is nothing', spreadsheetIdFrom('') === null)
check('a sentence is nothing', spreadsheetIdFrom('the fees sheet') === null)
/* Short enough to be a typo rather than an id. */
check('too short to be an id', spreadsheetIdFrom('abc123') === null)

/* Column letters. The payments file is fourteen wide today, so the bug this
   guards is the one that appears at twenty seven. */
check('one column', colLetter(1) === 'A')
check('the payments file today', colLetter(PAYMENT_COLUMNS.length) === 'N')
check('the links file today', colLetter(LINK_COLUMNS.length) === 'I')
check('the last single letter', colLetter(26) === 'Z')
/* Off by one here writes the header into the wrong range and silently drops
   a column: 27 is AA, not BA and not AZ. */
check('the first double letter', colLetter(27) === 'AA')
check('and the one after it', colLetter(28) === 'AB')
check('a full second round', colLetter(52) === 'AZ')
check('and over again', colLetter(53) === 'BA')

/* Read through String so this is a value comparison rather than a comparison
   of two const literal types, which the compiler rejects as pointless. The
   names are what a person looks for on the tab strip, so a rename is a thing
   to notice. */
check('the tabs are named for what they hold',
  String(LINKS_TAB) === 'Pay links' && String(PAYMENTS_TAB) === 'Payments')

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('sheet push: the id out of any link somebody pastes, and a column letter past Z')
export {}
