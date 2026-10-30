import { readShare, sharedWords, sharedForMaker, type PayoutParty } from './share-payouts'

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

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('shared payouts: one hop only, to an account that exists, and never a claim that Stripe is ready')
