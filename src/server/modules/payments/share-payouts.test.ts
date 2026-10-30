import {
  readShare, sharedWords, sharedForMaker, payingAccount,
  type PayoutParty, type PayoutColumns,
} from './share-payouts'
import { connectState } from './connect'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const p = (over: Partial<PayoutParty> = {}): PayoutParty => ({
  id: 'v1', shopName: 'Sweet Sisters Crafts', vendorCode: 'MM19',
  stripeAccountId: null, payoutsViaVendorId: null, ...over,
})
const mum = p({ id: 'v2', shopName: 'Five sisters make', vendorCode: 'MM18',
  stripeAccountId: 'acct_123' })

const ok = readShare(p(), mum, 'same mother, two daughters, one account')
check('a maker can be paid through another maker who has an account', 'ok' in ok)
check('and it is that account the money goes to',
  'ok' in ok && ok.accountId === 'acct_123')
check('and whose it is, is recorded', 'ok' in ok && ok.ownerId === 'v2')

/* Every refusal names the maker: staff doing this are reading two MM codes
   that differ by one digit. */
const noReason = readShare(p(), mum, '  ')
check('a reason is required', 'bad' in noReason)
check('because it goes in the record', 'bad' in noReason && noReason.bad.includes('record'))

const missing = readShare(p(), undefined, 'because')
check('an unknown number is refused', 'bad' in missing)

const self = readShare(p(), p(), 'because')
check('a maker cannot be paid through themselves', 'bad' in self)
check('and is told which maker that was',
  'bad' in self && self.bad.includes('Sweet Sisters Crafts'))

/* The one that would look fine and fail in December. */
const noAccount = readShare(p(), p({ id: 'v3', shopName: 'Holy Sits', vendorCode: 'MM34' }), 'because')
check('an account that does not exist cannot be shared', 'bad' in noAccount)
check('and the fix is named',
  'bad' in noAccount && noAccount.bad.includes('finish theirs first'))

/* No chains: A through B through C is a thing nobody can follow later, and
   it breaks the moment any of the three changes. */
const chained = readShare(p(), p({
  id: 'v4', shopName: 'Chickticks', vendorCode: 'MM6',
  stripeAccountId: 'acct_999', payoutsViaVendorId: 'v2',
}), 'because')
check('a chain is refused', 'bad' in chained)
check('and points at the maker who actually owns the account',
  'bad' in chained && chained.bad.includes('whoever owns'))

/* Two sentences, because two people read them and only one of them did it. */
check('staff are told whose account it is',
  sharedWords(mum) === 'Paid through MM18 Five sisters make.')
check('and it still reads without a number',
  sharedWords({ shopName: 'Five sisters make', vendorCode: null })
    === 'Paid through Five sisters make.')
check('the maker is told there is nothing for her to do',
  sharedForMaker(mum).includes('nothing for you to do'))
check('and is never asked to undo it',
  !sharedForMaker(mum).toLowerCase().includes('change'))

/* ── reading it back ──
   The half that was missing the first time this shipped: the write landed,
   and every screen that counts payouts went on reading her own empty column,
   so she still showed as owing one and would have been emailed about it. */
const cols = (over: Partial<PayoutColumns> = {}): PayoutColumns => ({
  stripeAccountId: null, payoutsEnabled: false,
  connectRequirements: '', connectDisabledReason: null, ...over,
})
const hers = { ...cols(), payoutsViaVendorId: 'v2' }
const mums = cols({ stripeAccountId: 'acct_123', payoutsEnabled: true })
const owners = new Map<string, PayoutColumns>([['v2', mums]])

check('a maker pointed at another account reads that account',
  payingAccount(hers, owners) === mums)
check('so she counts as ready once it is',
  connectState(payingAccount(hers, owners)) === 'ready')
check('a maker on her own account is left alone',
  payingAccount({ ...cols(), payoutsViaVendorId: null }, owners).stripeAccountId === null)
/* An owner outside the loaded set is the one case where guessing would be
   worse than saying nothing: she is reported as not set up, which is what
   her own row says, rather than as ready on an account nobody checked. */
check('an owner who was not loaded never reads as ready',
  connectState(payingAccount({ ...cols(), payoutsViaVendorId: 'nobody' }, owners)) === 'not_started')

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('shared payouts: one hop only, to an account that exists, and never a claim that Stripe is ready')
