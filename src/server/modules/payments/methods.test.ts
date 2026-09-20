import {
  stripeMethods, settlesInsideWindow, deadlineMeans, offersCard, offersBank,
  type PaymentMethods,
} from './methods'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const ALL: PaymentMethods[] = ['card_and_bank', 'bank_only', 'card_only']

check('both offers both', stripeMethods('card_and_bank').join() === 'us_bank_account,card')
/* Order is money. Checkout renders these in the order given and preselects
   the first, so this single assertion is worth most of a thousand dollars
   across a full show: bank is 0.8% capped at $5, card is 2.9% plus thirty
   cents. Card stays available, and one tap away, for anybody whose bank will
   not link. It is simply not the default. */
check('and puts the cheap one first', stripeMethods('card_and_bank')[0] === 'us_bank_account')
check('while still offering the card as the way out',
  stripeMethods('card_and_bank').includes('card'))
check('bank only offers only the bank', stripeMethods('bank_only').join() === 'us_bank_account')
check('card only offers only the card', stripeMethods('card_only').join() === 'card')

/* The rule that must never be empty: a policy that offers nothing would be a
   Checkout Session Stripe rejects, on the one screen a maker has to use. */
for (const p of ALL) check(`${p} offers at least one method`, stripeMethods(p).length > 0)

/* The timing consequence, which is the whole reason this file is pure. */
check('bank only cannot settle inside the window', !settlesInsideWindow('bank_only'))
check('card settles inside the window', settlesInsideWindow('card_only'))
check('both settles inside the window, because card is available',
  settlesInsideWindow('card_and_bank'))

check('bank only asks makers to START by the deadline',
  deadlineMeans('bank_only') === 'start your transfer by')
check('anything with a card asks makers to BE PAID by the deadline',
  deadlineMeans('card_and_bank') === 'be paid by' && deadlineMeans('card_only') === 'be paid by')

check('card is offered unless bank only', offersCard('card_and_bank') && offersCard('card_only') && !offersCard('bank_only'))
check('bank is offered unless card only', offersBank('card_and_bank') && offersBank('bank_only') && !offersBank('card_only'))

/* An unknown value from a database written by an older or newer deploy must
   fall back to offering MORE ways to pay, never fewer. Being one migration
   behind can never be the reason a maker cannot pay before a deadline. */
const unknown = 'something_else' as PaymentMethods
check('an unknown policy still offers both', stripeMethods(unknown).join() === 'us_bank_account,card')
check('an unknown policy keeps the ordinary deadline wording', deadlineMeans(unknown) === 'be paid by')

if (failures) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('payment methods: bank only never settles inside the window, and nothing ever offers zero ways to pay')
export {}
