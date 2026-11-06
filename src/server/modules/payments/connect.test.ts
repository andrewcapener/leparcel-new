import {
  connectState, canBePaid, owesPayoutSetup, requirementList, requirementsInPlainWords,
  businessUrl,
  type ConnectFacts,
} from './connect'

/**
 * Getting PAID, as opposed to paying.
 *
 * The distinction these tests exist to hold: paying Mermade by bank transfer
 * does not create any of this. That debits an account once. A payout account
 * is the maker's own, carries an identity check, and is the only thing that
 * lets money move the other way. The whole payment-method decision was taken
 * on the opposite belief, so the two must never be conflated again in code.
 *
 * The rule every case below is really testing: `payouts_enabled` is Stripe's
 * verdict and nothing else stands in for it. A statement must never be paid
 * because our own columns looked agreeable.
 */

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const NONE: ConnectFacts = {
  stripeAccountId: null,
  payoutsEnabled: false,
  connectRequirements: '[]',
  connectDisabledReason: null,
}
const acct = (p: Partial<ConnectFacts> = {}): ConnectFacts =>
  ({ ...NONE, stripeAccountId: 'acct_123', ...p })

/* ── the five states ── */
check('no account at all is not started', connectState(NONE) === 'not_started')
check('an account Stripe says is good is ready',
  connectState(acct({ payoutsEnabled: true })) === 'ready')
check('an account with nothing blocking it and no payouts is unfinished',
  connectState(acct()) === 'unfinished')
check('pending verification is its own state, not a nag',
  connectState(acct({ connectDisabledReason: 'requirements.pending_verification' })) === 'in_review')
check('any other disabled reason needs a person',
  connectState(acct({ connectDisabledReason: 'rejected.fraud' })) === 'disabled')
check('and so does an overdue one',
  connectState(acct({ connectDisabledReason: 'requirements.past_due' })) === 'disabled')
/* Whitespace in a column must not invent a state. */
check('a blank disabled reason is not a hold',
  connectState(acct({ connectDisabledReason: '   ' })) === 'unfinished')

/* ── the one question statements may ask ──
   Everything else on the page is presentation. This decides whether money
   leaves, so it must be true in exactly one case. */
check('only ready can be paid', canBePaid(acct({ payoutsEnabled: true })))
for (const f of [
  NONE,
  acct(),
  acct({ connectDisabledReason: 'requirements.pending_verification' }),
  acct({ connectDisabledReason: 'rejected.fraud' }),
]) {
  check(`${connectState(f)} cannot be paid`, !canBePaid(f))
}
/* The trap this guards: Stripe can say payouts are on while still asking for
   something. Its answer wins either way, in both directions. */
check('Stripe saying yes wins over outstanding requirements',
  canBePaid(acct({ payoutsEnabled: true, connectRequirements: '["individual.id_number"]' })))
check('and an empty requirement list never implies yes',
  !canBePaid(acct({ connectRequirements: '[]' })))

/* ── who owes this at all ──
   An outdoor maker runs their own register and is never owed a cent, so
   asking them for an identity check would be asking for nothing. */
check('an outdoor maker owes no payout setup', !owesPayoutSetup('outdoor'))
check('an indoor maker does', owesPayoutSetup('indoor'))
check('and so does a both applicant, until a space places them',
  owesPayoutSetup('both'))
check('an unknown track errs towards asking', owesPayoutSetup(''))

/* ── the requirements column ──
   Written by a webhook from Stripe's JSON, so it can hold anything. A
   maker's page must not blow up because a column did. */
check('a good list parses', requirementList('["a","b"]').join('|') === 'a|b')
check('empty is empty', requirementList('[]').length === 0)
check('null is empty', requirementList(null).length === 0)
check('junk is empty, not a crash', requirementList('{oh no').length === 0)
check('an object is empty', requirementList('{"a":1}').length === 0)
check('non-strings inside are dropped', requirementList('["a",3,null]').join('|') === 'a')

/* ── plain words ──
   The point of the whole column. "currently_due: individual.id_number" tells
   a maker nothing, and a maker who thinks they finished and did not finds out
   on statement day in November. */
const said = requirementsInPlainWords(['individual.id_number', 'external_account'])
check('Stripe field names become sentences', said[0] === 'Your Social Security number')
check('and so do the ones that are not about identity',
  said[1] === 'The bank account you want to be paid into')
check('two keys that mean one thing are said once',
  requirementsInPlainWords(['business_profile.mcc', 'business_profile.product_description'])
    .length === 1)
/* Never hidden. A maker stuck on a requirement nobody mapped is exactly the
   person who needs to be told something. */
const odd = requirementsInPlainWords(['individual.political_exposure'])
check('an unmapped key still says something', odd.length === 1)
check('and says it in words, not in Stripe', odd[0] === 'Political exposure')
check('every requirement produces a line',
  requirementsInPlainWords(['individual.first_name', 'individual.last_name']).length === 2)
/* Nothing outstanding must render nothing, not an empty bullet. */
check('no requirements means no lines', requirementsInPlainWords([]).length === 0)


/* ── what we send Stripe as the maker's site ──
   The account is created before a maker can do anything, so a string Stripe
   refuses here does not degrade her setup, it blocks it entirely. MM16 typed
   a bare domain and could not start at all. */
check('a bare domain is sent with a scheme',
  businessUrl({ website: 'besodelsolboutique.com' }) === 'https://besodelsolboutique.com/')
check('and so is one with www',
  businessUrl({ website: 'www.brookelbm.com' }) === 'https://www.brookelbm.com/')
check('a real URL is left alone',
  businessUrl({ website: 'https://shop.example.com/store' }) === 'https://shop.example.com/store')
check('an Instagram handle becomes her Instagram',
  businessUrl({ website: '', instagram: '@brookelbm' }) === 'https://instagram.com/brookelbm')
check('nothing typed sends nothing', businessUrl({ website: null, instagram: '' }) === null)
/* The point of the whole thing: never hand Stripe something it will refuse. */
check('a phone number is not a URL', businessUrl({ website: '(949) 555-1021' }) === null)
check('a sentence is not a URL', businessUrl({ website: 'I sell at markets' }) === null)
check('and a scheme we do not allow is never passed on',
  businessUrl({ website: 'javascript:alert(1)' }) === null)


/* ── nothing on this list is ever a mystery ──
   Drew, 6 November, reading MM?? after Stripe put payouts on hold: a list
   that ended "Ip". That is tos_acceptance.ip falling through to its last
   word, and an IP address is not an errand anybody can run: Stripe writes it
   down when she presses accept. A maker reads this list as things to go and
   find, so a line she cannot act on is worse than no line. */
check('accepting the terms is one line, however Stripe asks for it',
  requirementsInPlainWords(['tos_acceptance.date', 'tos_acceptance.ip', 'tos_acceptance.user_agent'])
    .length === 1)
check('and it reads as the act, not the field',
  requirementsInPlainWords(['tos_acceptance.ip'])[0]?.includes('terms') === true)
check('a date of birth is one errand, not three',
  requirementsInPlainWords(['individual.dob.day', 'individual.dob.month', 'individual.dob.year'])
    .length === 1)
check('and so is an address',
  requirementsInPlainWords(['individual.address.line1', 'individual.address.city',
    'individual.address.state', 'individual.address.postal_code']).length === 1)
/* The guard that matters: no line may come back as a bare Stripe field name
   dressed up, because that is what "Ip" was. */
const SHOWN = requirementsInPlainWords([
  'tos_acceptance.ip', 'tos_acceptance.user_agent', 'business_type',
  'individual.dob.month', 'individual.address.postal_code', 'external_account',
])
check('every line is a sentence a maker could act on',
  SHOWN.every((t) => t.split(' ').length > 1))

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('connect: payouts_enabled is Stripe’s verdict, and only ready can be paid')
export {}
