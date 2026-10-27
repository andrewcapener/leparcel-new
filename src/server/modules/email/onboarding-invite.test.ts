import {
  inviteFor, invitePlan, inviteSubject, needLines, inviteText,
  inviteIdempotencyKey, planNotice, type InviteMaker,
} from './onboarding-invite'

let failures = 0
const check = (n: string, ok: boolean) => { if (!ok) { failures++; console.error(`FAIL: ${n}`) } }

const maker = (over: Partial<InviteMaker> = {}): InviteMaker => ({
  bookingId: 'b1', vendorCode: 'MM04', shopName: 'The Mending Table',
  contactName: 'Jo', email: 'jo@example.com',
  track: 'indoor', bookingStatus: 'confirmed', applicationStatus: 'accepted',
  payoutState: 'not_started', itemCount: 0,
  ...over,
})
const open = { itemsOpen: true }

const needsOf = (m: InviteMaker, o = open) => {
  const r = inviteFor(m, o)
  return 'needs' in r ? r.needs : null
}
const heldFor = (m: InviteMaker, o = open) => {
  const r = inviteFor(m, o)
  return 'because' in r ? r.because : null
}

/* ── who is asked ────────────────────────────────────────────────────── */

check('an indoor maker with neither done is asked for both',
  (needsOf(maker()) ?? []).length === 2)

/* The one that would read as nobody looking: a maker who filed her list last
   week being asked for it again. */
check('a maker who filed her list is only asked for payouts',
  JSON.stringify(needsOf(maker({ itemCount: 6 }))) === JSON.stringify(['payouts']))
check('a maker whose payouts are live is only asked for the list',
  JSON.stringify(needsOf(maker({ payoutState: 'ready' }))) === JSON.stringify(['items']))
check('a maker who has done both is left out',
  heldFor(maker({ payoutState: 'ready', itemCount: 3 })) === 'Already done everything we asked.')

/* Stripe's verdict is the only one that counts: an account started in
   September and never finished is still a thing to do. */
check('an unfinished payout account still counts as outstanding',
  (needsOf(maker({ payoutState: 'unfinished' })) ?? []).includes('payouts'))
check('an account under review still counts',
  (needsOf(maker({ payoutState: 'in_review' })) ?? []).includes('payouts'))
check('a disabled account still counts',
  (needsOf(maker({ payoutState: 'disabled' })) ?? []).includes('payouts'))

/* ── who is not ──────────────────────────────────────────────────────── */

check('an outdoor maker is never asked',
  (heldFor(maker({ track: 'outdoor' })) ?? '').startsWith('Outdoor'))
check('and the reason says why, not just no',
  (heldFor(maker({ track: 'outdoor' })) ?? '').includes('keep 100%'))
check('a waitlisted maker is not asked',
  (heldFor(maker({ applicationStatus: 'waitlist' })) ?? '').includes('Not accepted'))
check('a declined maker is not asked',
  heldFor(maker({ applicationStatus: 'declined' })) !== null)
check('a released space is not chased',
  (heldFor(maker({ bookingStatus: 'released' })) ?? '').includes('released'))
check('a cancelled space is not chased',
  heldFor(maker({ bookingStatus: 'cancelled' })) !== null)
check('a maker with no address is left out, visibly',
  (heldFor(maker({ email: 'none' })) ?? '').includes('email'))

/* Our own gaps are not somebody else's homework. */
check('payouts not configured here means only the list is asked for',
  JSON.stringify(needsOf(maker({ payoutState: undefined }))) === JSON.stringify(['items']))
check('no item date means only payouts are asked for',
  JSON.stringify(needsOf(maker(), { itemsOpen: false })) === JSON.stringify(['payouts']))
check('neither configured means nobody is emailed at all',
  (heldFor(maker({ payoutState: undefined }), { itemsOpen: false }) ?? '')
    .includes('Nothing to ask for yet'))

/* ── the cohort ──────────────────────────────────────────────────────── */

const plan = invitePlan([
  maker({ bookingId: 'a' }),
  maker({ bookingId: 'b', itemCount: 4 }),
  maker({ bookingId: 'c', track: 'outdoor' }),
  maker({ bookingId: 'd', payoutState: 'ready', itemCount: 2 }),
], open)
check('the cohort splits', plan.send.length === 2 && plan.held.length === 2)
check('everybody lands in exactly one list',
  plan.send.length + plan.held.length === 4)
check('the notice counts what matters',
  planNotice(plan) === '2 makers, 1 asked for both, 2 left out.')
check('an empty cohort says so plainly',
  planNotice({ send: [], held: [] }) === 'Nobody needs this email right now.')

/* ── the words ───────────────────────────────────────────────────────── */

check('two things reads as two', inviteSubject(['items', 'payouts'], 'Fall 2026') === 'Two things before Fall 2026')
check('one thing names the thing', inviteSubject(['items'], 'Fall 2026') === 'Your item list for Fall 2026')
check('and the other one too', inviteSubject(['payouts'], 'Fall 2026').includes('payouts'))

check('the list line carries the date when there is one',
  needLines(['items'], 'November 6')[0]!.includes('November 6'))
check('and reads fine without one',
  needLines(['items'], null)[0]!.includes('One line per price'))
check('the payout line says what it buys them',
  needLines(['payouts'], null)[0]!.includes('nothing to chase'))
check('the list is explained as prices, not stock',
  needLines(['items'], null)[0]!.includes('not one line per item'))

const text = inviteText({ url: 'https://x.test/a', showName: 'Fall 2026', needs: ['items', 'payouts'], itemsDue: null })
check('the text version carries the link', text.includes('https://x.test/a'))
check('and both asks', text.includes('item list') && text.includes('payout account'))

/* ── one press, one delivery ─────────────────────────────────────────── */

check('the same cohort is the same key',
  inviteIdempotencyKey('s1', 'b1', ['items', 'payouts'])
  === inviteIdempotencyKey('s1', 'b1', ['payouts', 'items']))
check('a different maker is a different key',
  inviteIdempotencyKey('s1', 'b1', ['items']) !== inviteIdempotencyKey('s1', 'b2', ['items']))
check('a different show is a different key',
  inviteIdempotencyKey('s1', 'b1', ['items']) !== inviteIdempotencyKey('s2', 'b1', ['items']))
/* A maker who has since filed her list is genuinely a different email, so it
   must not be deduplicated against the one she already had. */
check('different needs are a different key',
  inviteIdempotencyKey('s1', 'b1', ['items']) !== inviteIdempotencyKey('s1', 'b1', ['items', 'payouts']))

/* House style: every one of these is read by a maker. */
const copy = [
  ...needLines(['items', 'payouts'], 'November 6'),
  inviteSubject(['items', 'payouts'], 'Fall 2026'),
  inviteSubject(['items'], 'Fall 2026'),
  inviteSubject(['payouts'], 'Fall 2026'),
]
check('no fancy dashes and no exclamations in anything a maker reads',
  copy.every((t) => !t.includes('!')
    && !t.includes(String.fromCharCode(0x2014)) && !t.includes(String.fromCharCode(0x2013))))

if (failures > 0) { console.error(`\n${failures} check(s) failed.`); process.exit(1) }
console.log('onboarding invite: nobody is asked for what they already did, and no outdoor maker is asked at all')
