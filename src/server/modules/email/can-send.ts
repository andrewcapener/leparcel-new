/**
 * Every way this system can put an email in front of a person, in one list.
 *
 * Drew, 22 Sept 2026: "quadruple check that we don't send automated emails to
 * anyone." Four greps through actions.ts is not a check anybody can repeat,
 * and it stops being true the moment somebody flips a switch on Show
 * settings. So the answer is a screen, built from the same values the sending
 * code reads, and this is the pure half of it.
 *
 * There is exactly one function in the codebase that transmits mail, `mail()`
 * in src/app/actions.ts, and it has nine call sites. All nine are below. If a
 * tenth is ever added, it belongs here on the same commit, and the test next
 * door is the thing that will be wrong if it is not.
 */

export type MailFacts = {
  /** Without this nothing leaves the building, whatever else is set. */
  hasApiKey: boolean
  /** Show.decisionEmails: accepted, declined, waitlisted, space released. */
  decisionEmails: string
  /** Show.paymentEmail: the booth fee email with the pay link in it. */
  paymentEmail: string
  /** Whether an application can still be submitted at all. */
  applicationsOpen: boolean
  /** A Drip account is configured, so joining the list pushes a subscriber. */
  dripConfigured: boolean
}

/** How much a person has to do before this one goes out. */
export type Sets =
  /** Nobody has to do anything. This is what "automated" means. */
  | 'on its own'
  /** A staff member pressed a button about this maker, just now. */
  | 'staff press a button'
  /** The person receiving it asked for it, seconds earlier. */
  | 'they ask for it'

export type MailPath = {
  /** What the message is. */
  what: string
  /** Who opens it. */
  to: 'the maker' | 'Mermade'
  sets: Sets
  /** What actually triggers it, in words. */
  trigger: string
  /** Can it go out right now. */
  armed: boolean
  /** Why it is armed or not, said plainly. */
  because: string
}

export function mailPaths(f: MailFacts): MailPath[] {
  /* The master fact. Resend is the only transport and every path runs through
     the same function, so no key means no mail regardless of any switch. */
  const key = f.hasApiKey
  const decisions = key && f.decisionEmails === 'on'
  const payment = key && f.paymentEmail === 'on'

  const off = (switchName: string) => `${switchName} is off on Show settings.`
  const noKey = 'No Resend key on this deployment, so nothing can leave at all.'

  return [
    {
      what: 'Booth fee, with their pay link',
      to: 'the maker',
      sets: 'staff press a button',
      trigger: 'Accepting one maker in the review queue.',
      armed: payment,
      because: !key ? noKey
        : payment ? 'Accepting a maker mails them their pay link.'
          : off('Email the booth fee'),
    },
    {
      what: 'Accepted, declined or waitlisted',
      to: 'the maker',
      sets: 'staff press a button',
      trigger: 'Deciding one maker in the review queue.',
      armed: decisions,
      because: !key ? noKey
        : decisions ? 'Deciding on a maker mails them the decision.'
          : off('Email makers when you decide'),
    },
    {
      what: 'Space released, fee never arrived',
      to: 'the maker',
      sets: 'staff press a button',
      trigger: 'Pressing Release unpaid spaces on the roster.',
      armed: decisions,
      because: !key ? noKey
        : decisions ? 'Releasing a space mails the maker it belonged to.'
          : off('Email makers when you decide'),
    },
    {
      what: 'Accepting the whole roster from the sheet',
      to: 'the maker',
      sets: 'staff press a button',
      trigger: 'Accept from the sheet.',
      /* Not a switch. The bulk importer calls nothing that can send, and the
         reason is in src/server/modules/roster/apply.ts: a bulk run is the
         worst possible place to discover a switch was on. */
      armed: false,
      because: 'Never sends, whatever these switches say. It cannot.',
    },
    {
      what: 'Their sign-in link',
      to: 'the maker',
      sets: 'they ask for it',
      trigger: 'A maker typing their email and pressing the button, seconds earlier.',
      armed: key,
      because: key
        ? 'Only ever to the address that just asked. Turning this off would stop makers signing in to pay.'
        : noKey,
    },
    {
      what: 'We have your application',
      to: 'the maker',
      sets: 'they ask for it',
      trigger: 'Somebody submitting an application.',
      armed: key && f.applicationsOpen,
      because: !key ? noKey
        : f.applicationsOpen
          ? 'A receipt to whoever just applied, and only to them.'
          : 'Applications are closed, so nobody can trigger it.',
    },
    {
      what: 'Somebody wrote in',
      to: 'Mermade',
      sets: 'they ask for it',
      trigger: 'A visitor sending the contact form.',
      armed: key,
      because: key ? 'Goes to Mermade, never to a maker.' : noKey,
    },
    {
      what: 'New application',
      to: 'Mermade',
      sets: 'on its own',
      trigger: 'An application arriving.',
      armed: key && f.applicationsOpen,
      because: !key ? noKey
        : f.applicationsOpen
          ? 'Goes to staff, never to a maker.'
          : 'Applications are closed, so nobody can trigger it.',
    },
  ]
}

/**
 * The one-line answer: can anything reach a maker without a person choosing
 * it, maker by maker, right now.
 *
 * A maker asking for their own sign-in link does not count and must not: it
 * is the door they walk through to pay, and counting it would make the only
 * honest answer "yes" forever.
 */
export function anythingBroadcasts(paths: MailPath[]): MailPath[] {
  return paths.filter((p) => p.armed && p.to === 'the maker' && p.sets !== 'they ask for it')
}

/** Anything at all that a person outside Mermade could receive. */
export function armedToMakers(paths: MailPath[]): MailPath[] {
  return paths.filter((p) => p.armed && p.to === 'the maker')
}
