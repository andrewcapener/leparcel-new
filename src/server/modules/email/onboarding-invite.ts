import { shell, button, paragraphs, rule, esc, BODY_FONT, MUTED } from './shell'
import type { ConnectState } from '@/server/modules/payments/connect'

/**
 * The one email that asks an indoor maker for the two things we need.
 *
 * Drew, 27 October: "we need to send them an email to say, hey, upload your
 * inventory here and set up your Stripe Connect account for automatic
 * payments after the show... they'll click on the link that's sent to them,
 * and then that will then shoot them to their outstanding items."
 *
 * Deciding WHO gets it is the whole risk here, which is why it is a pure
 * function with tests rather than a query with a where clause. A wrong answer
 * reaches forty people at once and cannot be taken back: asking a maker for
 * an item list she filed last week reads as nobody looking, and asking an
 * outdoor maker to set up payouts reads as nobody knowing what she booked.
 *
 * So the email is per maker, and it asks only for what that maker still owes.
 * Somebody who has done one of the two gets a shorter email about the other,
 * and somebody who has done both gets nothing at all.
 */

export type Need = 'payouts' | 'items'

export type InviteMaker = {
  bookingId: string
  vendorCode: string | null
  shopName: string
  contactName: string
  email: string
  /** The space they booked. Only indoor is ever asked for either of these. */
  track: string
  /** The booking's own status, so a released space is never chased. */
  bookingStatus: string
  applicationStatus: string
  /** Undefined when payouts are not configured on this deployment, which is
   *  not the same as a maker who has not started: one is our gap, the other
   *  is theirs, and only the second is worth an email. */
  payoutState?: ConnectState
  /** Live lines on their item list. */
  itemCount: number
  /** Whether they have told us the list is finished. A maker with lines on it
   *  who never pressed the button is still someone to ask. */
  itemsSent: boolean
}

export type Invite = { maker: InviteMaker; needs: Need[] }
export type Held = { maker: InviteMaker; because: string }
export type InvitePlan = { send: Invite[]; held: Held[] }

/**
 * Booking states where the space is gone and nothing should be asked.
 *
 * These are the real ones from the schema's enum. It used to read
 * ['cancelled', 'released', 'refunded', 'withdrawn'], three of which the
 * column cannot hold, and it was MISSING `forfeited`, which is the status a
 * booking actually takes when a maker misses the fee window and staff put
 * her space back in the pool. So the one maker the system had just emailed
 * "your space has gone back into the pool" was still on this list, ticked by
 * default, about to be asked for her prices and a Stripe identity check for a
 * space she no longer held.
 */
const GONE = new Set(['cancelled', 'forfeited'])

/**
 * What this maker still owes, or the sentence saying why they are left out.
 *
 * `itemsOpen` is whether the Show has an inventory date at all. With no date
 * there is nothing to link them to, so asking would send somebody to a page
 * with no list on it.
 */
export function inviteFor(
  m: InviteMaker, opts: { itemsOpen: boolean },
): { needs: Need[] } | { because: string } {
  if (m.track === 'outdoor') {
    return { because: 'Outdoor. They run their own register and keep 100%, so neither of these is theirs.' }
  }
  if (m.applicationStatus !== 'accepted') {
    return { because: `Not accepted (${m.applicationStatus}).` }
  }
  if (GONE.has(m.bookingStatus)) {
    return { because: `Their space is ${m.bookingStatus}.` }
  }
  if (!m.email.includes('@')) {
    return { because: 'No usable email address on file.' }
  }

  const needs: Need[] = []
  /* `ready` is Stripe's verdict and the only one that counts. Anything else,
     including an account half finished months ago, is still a thing to do. */
  if (m.payoutState !== undefined && m.payoutState !== 'ready') needs.push('payouts')
  if (itemsWanted(m, opts.itemsOpen)) needs.push('items')

  if (needs.length === 0) {
    return { because: payoutsConfigured(m) || opts.itemsOpen
      ? 'Already done everything we asked.'
      : 'Nothing to ask for yet: payouts are not switched on and no item date is set.' }
  }
  return { needs }
}

const payoutsConfigured = (m: InviteMaker) => m.payoutState !== undefined
/* Sent, AND with something on it. Somebody halfway through a list has not
   finished telling us and is exactly who this email is for; so is somebody
   who pressed the button and then removed every line, which used to read as
   finished because the flag is never cleared. */
const itemsWanted = (m: InviteMaker, itemsOpen: boolean) =>
  itemsOpen && !(m.itemsSent && m.itemCount > 0)

/** The whole cohort, split into who gets one and who does not. */
export function invitePlan(
  makers: InviteMaker[], opts: { itemsOpen: boolean },
): InvitePlan {
  const send: Invite[] = []
  const held: Held[] = []
  for (const maker of makers) {
    const r = inviteFor(maker, opts)
    if ('needs' in r) send.push({ maker, needs: r.needs })
    else held.push({ maker, because: r.because })
  }
  return { send, held }
}

/* ───────────────────────────── the words ───────────────────────────── */

export function inviteSubject(needs: Need[], showName: string): string {
  if (needs.length === 2) return `Two things before ${showName}`
  return needs[0] === 'items'
    ? `Your item list for ${showName}`
    : `Setting up your payouts for ${showName}`
}

/** One line per thing, in the maker's terms rather than ours. */
export function needLines(needs: Need[], itemsDue: string | null): string[] {
  const out: string[] = []
  if (needs.includes('items')) {
    out.push(itemsDue
      ? `Your item list. What you are bringing and what it costs, so the register knows your work. One line per price, not one line per item. Due ${itemsDue}.`
      : 'Your item list. What you are bringing and what it costs, so the register knows your work. One line per price, not one line per item.')
  }
  if (needs.includes('payouts')) {
    out.push('Your payout account. Set it up once and your share of what sells lands in your own account after the show, with nothing to chase.')
  }
  return out
}

/**
 * The email.
 *
 * Short on purpose. It is a page of two tasks with a button to the page that
 * has them, and every sentence that is not one of those two is a sentence
 * somebody reads instead of pressing the button.
 */
export function inviteHtml({
  url, shopName, showName, needs, itemsDue, vendorCode,
}: {
  url: string
  shopName: string
  showName: string
  needs: Need[]
  itemsDue: string | null
  vendorCode: string | null
}): string {
  const both = needs.length === 2
  return shell({
    webFonts: true,
    eyebrow: `${showName} · ${shopName}`,
    heading: both ? 'Two things before the show' : 'One thing before the show',
    sub: both
      ? 'Both live on your account page, and the button below opens it.'
      : 'It lives on your account page, and the button below opens it.',
    inner:
      paragraphs(needLines(needs, itemsDue))
      + button({ href: url, label: 'Open your account' })
      + rule()
      + `<p style="margin:0;font:400 13px/1.6 ${BODY_FONT};color:${MUTED};">`
      + (vendorCode
        ? `Your Mermade ID is ${esc(vendorCode)}. Keep it on anything you send us.`
        : 'Reply to this email if anything here looks wrong.')
      + '</p>',
    footer: 'Mermade Market · Dana Point, California',
  })
}

/** The same thing as text, for the outbox and for clients that want it. */
export function inviteText({
  url, showName, needs, itemsDue,
}: {
  url: string
  showName: string
  needs: Need[]
  itemsDue: string | null
}): string {
  const head = needs.length === 2
    ? `Two things before ${showName}:`
    : `One thing before ${showName}:`
  return [head, '', ...needLines(needs, itemsDue).map((l) => `- ${l}`), '', url].join('\n')
}

/**
 * One key per show, per maker, per set of needs.
 *
 * A second press with the same cohort is the same key and so the same
 * delivery (rule 4). A maker who has since filed her list has different needs
 * and a different key, which is correct: that is a different email.
 */
export function inviteIdempotencyKey(
  showId: string, bookingId: string, needs: Need[],
): string {
  return `onboarding:${showId}:${bookingId}:${[...needs].sort().join('+')}:v1`
}

/** What the screen says before anybody presses anything. */
export function planNotice(plan: InvitePlan): string {
  const n = plan.send.length
  if (n === 0) return 'Nobody needs this email right now.'
  const both = plan.send.filter((s) => s.needs.length === 2).length
  const bits = [`${n} ${n === 1 ? 'maker' : 'makers'}`]
  if (both > 0) bits.push(`${both} asked for both`)
  if (plan.held.length > 0) bits.push(`${plan.held.length} left out`)
  return `${bits.join(', ')}.`
}
