/**
 * What Mermade needs from a maker, in order, with the state of each.
 *
 * This is the spine of the maker's dashboard. Before it existed, /account was
 * an invoice with some facts around it: a maker could see what they owed and
 * nothing about what else was coming, which meant every other requirement
 * arrived as a surprise email and a deadline they had already half missed.
 *
 * Pure, and tested, for the same reason the money functions are. Each row
 * decides whether somebody is allowed on the floor in November, and the rule
 * for who owes what is not obvious: an indoor maker never owes a seller's
 * permit because Mermade is the retailer of record for their sales, and an
 * outdoor maker always does because Publication 111 makes it Mermade's record
 * to hold at up to $1,000 a head. Written once here, read by the maker's page
 * and by the admin, instead of a condition copied into both and drifting.
 *
 * Deliberately NOT a progress bar. A maker with three of five ticks is not
 * sixty percent of the way to selling; they are either clear for load-in or
 * they are not, and a bar invites them to feel finished while something that
 * blocks them is outstanding.
 */
import { owesPermit, permitState, permitNeedsMaker, type PermitState } from './permit'

export type ItemState =
  /** Nothing to do: not yet asked, or does not apply to this maker. */
  | 'waiting'
  /** Their turn. */
  | 'todo'
  /** Done. */
  | 'done'
  /** Their turn, and the date has passed. */
  | 'overdue'

export type ChecklistItem = {
  key: string
  title: string
  /** One sentence, in the maker's terms, about what this actually is. */
  detail: string
  state: ItemState
  /** ISO, when there is a real date. Never invented. */
  dueAt?: string
  /** Where on this page to do it, when it can be done here. */
  href?: string
  /** The button on the row, when there is a real thing to press. A task list
   *  whose rows only describe the task makes the maker go and find the place
   *  to do it, which for two of these three is an email they have to compose
   *  from scratch. Only set when the state is theirs to act on. */
  action?: { label: string; href: string }
  /** True when not being done stops them selling. */
  blocksLoadIn: boolean
}

export type ChecklistInput = {
  /** Application status: only an accepted maker has anything to do. */
  applicationStatus: string
  track: string
  /** Booking, when one exists. */
  booking?: {
    status: string
    paymentDueAt: string
  }
  sellerPermit: string
  occasionalSeller: boolean
  /** What the maker answered on the application: have, occasional, unsure.
   *  Null for indoor, where nobody is asked. */
  permitStatus: string | null
  /** Whether they carry their own liability cover. Recorded and shown to
   *  staff, never asked for on the checklist: it is recommended, not
   *  required, and this list is only what a maker must do. */
  hasCoi: boolean
  /** Show dates, for the deadlines that are not per booking. */
  loadInAt: string
  /** Onboarding call times for THIS maker's track, one per line. Empty means
   *  the times are not set yet, and the row does not appear at all: asking
   *  somebody to choose from nothing is worse than not asking. */
  onboardingSlots?: string
  /** What they already chose, if anything. */
  onboardingSlot?: string | null
  /** When the item list is wanted. Indoor only. Null until somebody sets it. */
  inventoryDueAt?: string | null
  nowIso: string
  /** Where to send a document there is no upload for yet. Passed in rather
   *  than imported so this file stays pure and testable. */
  contactEmail: string
  /** True when bank transfer is the only way to pay, which makes the booth
   *  fee deadline a deadline to START rather than to have paid. */
  startOnly?: boolean
}

/* A pre-addressed, pre-titled draft. The address is already written out in
   the row's detail, so this saves a copy and paste rather than hiding
   anything: a maker who prefers their own client still has it in words. */
const mailto = (email: string, subject: string) =>
  `mailto:${email}?subject=${encodeURIComponent(subject)}`

/** The options, in order, with blank lines and stray whitespace dropped. */
export function slotOptions(raw: string | undefined): string[] {
  return (raw ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
}

const past = (iso: string | undefined, nowIso: string) => {
  if (!iso) return false
  const due = Date.parse(iso)
  const now = Date.parse(nowIso)
  return Number.isFinite(due) && Number.isFinite(now) && now > due
}

/** `todo` becomes `overdue` once its date has gone. Nothing else changes. */
const withDate = (state: ItemState, dueAt: string | undefined, nowIso: string): ItemState =>
  state === 'todo' && past(dueAt, nowIso) ? 'overdue' : state

export function checklistFor(input: ChecklistInput): ChecklistItem[] {
  const accepted = input.applicationStatus === 'accepted'
  const booking = input.booking

  /* 1 · The booth fee. The only item with a hard, per maker deadline, and the
     only one that can lose them the space rather than just hold up load-in. */
  const paid = booking?.status === 'confirmed'
  const clearing = booking?.status === 'payment_processing'
  const lost = booking?.status === 'forfeited' || booking?.status === 'cancelled'
  const feeState: ItemState = !accepted || !booking
    ? 'waiting'
    : paid || clearing || lost
      ? 'done'
      : 'todo'

  const items: ChecklistItem[] = [
    {
      key: 'fee',
      title: 'Booth fee',
      detail: clearing
        ? 'Your bank transfer is on its way. Nothing more to do while it clears.'
        : paid
          ? 'Paid. Your space is held.'
          : lost
            ? 'This space went back into the pool.'
            : accepted
              ? input.startOnly
                ? 'Start your bank transfer to confirm your space. It is held from the moment you do.'
                : 'Pay to confirm your space.'
              : 'Set once you are accepted.',
      state: withDate(feeState, booking?.paymentDueAt, input.nowIso),
      dueAt: booking?.paymentDueAt,
      href: '#booth-fee',
      action: feeState === 'todo'
        ? { label: input.startOnly ? 'Start your transfer' : 'Pay your booth fee', href: '#booth-fee' }
        : undefined,
      blocksLoadIn: true,
    },
  ]

  /* 2 · Seller's permit, outdoor only. Not a deadline of ours: it gates
     load-in, which is why the date shown is load-in and not something
     invented earlier to create urgency. */
  if (owesPermit(input.track)) {
    const permit = permitState({
      track: input.track,
      permitStatus: input.permitStatus,
      sellerPermit: input.sellerPermit,
      occasionalSeller: input.occasionalSeller,
    })
    /* Only when it is still theirs to do. Everybody outdoor answered this on
       the application, so once they have, it is a fact in their profile
       rather than a task: Drew, 10 Sept, "permitting should almost just be
       part of their profile info". A declaration we owe a form against, or a
       request for help, is OUR homework and does not belong on their list. */
    const mine = permitNeedsMaker(permit)
    /* Say back what they already told us. They answered this on the
       application, and a dashboard that asks again for something already
       given is the fastest way to make a careful maker feel unheard. Only
       `unanswered` is a fresh ask. */
    const DETAIL: Record<PermitState, string> = {
      not_required: '',
      on_file: 'Your permit number is on file. Nothing more needed.',
      promised: `You told us you have a permit and we do not have the number yet. Send it to ${input.contactEmail} and this is done.`,
      occasional_declared: 'You told us you are an occasional seller, so we will send you the CDTFA-410-D to sign. Watch for it, and there is nothing to do until it arrives.',
      occasional_documented: 'Your occasional seller form is on file. Nothing more needed.',
      unsure: 'You asked us to help you work out whether you need one. We will be in touch before load-in, and this will not hold you up.',
      unanswered: `You sell for your own account outside, so the state requires us to hold your permit number. Send it to ${input.contactEmail}, or tell us you have no permit and we will send the occasional seller form.`,
    }
    /* Waiting, not todo, when the ball is with us: they answered and we owe
       them a form or a conversation. Chasing somebody for our own homework
       is worse than saying nothing. */
    if (mine) {
      items.push({
        key: 'permit',
        title: "California seller's permit",
        detail: DETAIL[permit],
        state: withDate(!accepted ? 'waiting' : 'todo', input.loadInAt, input.nowIso),
        dueAt: input.loadInAt,
        /* Only where the maker has something to send. `unsure` is a request
           for help we owe them, and a button labelled as if it were their
           job to act would be the wrong instruction. */
        action: accepted && permit !== 'unsure'
          ? {
              label: 'Email your permit number',
              href: mailto(input.contactEmail, "Seller's permit"),
            }
          : undefined,
        blocksLoadIn: true,
      })
    }
  }

  /* 3 · Insurance. NOT a row, deliberately.
     Drew, 20 Sept 2026: "we don't require insurance. That is just
     recommended so remove that."

     The list is headed "What we need from you", and a recommendation is not
     something we need. Leaving it on with a softer label would be worse than
     removing it: every row here is something a maker has to act on, and one
     that turns out to be optional teaches them the others might be too.

     `hasCoi` is still collected on the application and still shown to staff,
     because knowing who carries cover is useful. It just stops being a
     reason anybody is chased, and stops blocking load-in. */

  /* 4 · The onboarding call. Only where times exist for this maker's track:
     Hillary's outdoor slots are set and the indoor ones are not, so the
     outdoor half of the roster can be asked tonight and the indoor half is
     not shown an empty question.

     "Not needed" is one of the options rather than a way of skipping the row,
     because a maker who has decided they do not want a call has answered, and
     a list that keeps asking is a list people stop reading. */
  const slots = slotOptions(input.onboardingSlots)
  if (slots.length > 0) {
    const picked = (input.onboardingSlot ?? '').trim()
    items.push({
      key: 'call',
      title: 'Your onboarding call',
      detail: picked
        ? `You chose: ${picked}. Change it here any time before the show.`
        : 'Pick a time that suits you, or tell us you do not need one. It is a short call about how the day runs.',
      state: !accepted ? 'waiting' : picked ? 'done' : 'todo',
      href: '#call',
      action: accepted && !picked ? { label: 'Pick a time', href: '#call' } : undefined,
      /* Never a blocker. Somebody who skips the call still sells. */
      blocksLoadIn: false,
    })
  }

  /* 5 · Item list. Indoor only: Mermade rings those sales, so Mermade needs
     the catalogue, and an outdoor maker runs their own register. Hillary,
     20 Sept: "don't do inventory for outside ppl... we'll get a million
     questions!"

     The upload does not exist yet. The date does, so the row now names it
     rather than promising vaguely that we will be in touch. */
  if (input.track !== 'outdoor') {
    const due = input.inventoryDueAt ?? undefined
    items.push({
      key: 'items',
      title: 'Your item list',
      detail: due
        ? 'What you are bringing, with prices, so the register knows your work. We will open the upload before the date below and write to you when it is ready.'
        : 'What you are bringing, with prices, so the register knows your work. We will open this and write to you when it is ready.',
      /* Still `waiting`, even with a date on it: there is nothing for a maker
         to do until the upload opens, and a row that says "your turn" with no
         way to take it is the thing this list exists to avoid. */
      state: 'waiting',
      dueAt: due,
      blocksLoadIn: false,
    })
  }

  return items
}

/** What the maker sees at the top: the one thing to do next, or nothing. */
export function nextAction(items: ChecklistItem[]): ChecklistItem | undefined {
  return items.find((i) => i.state === 'overdue') ?? items.find((i) => i.state === 'todo')
}

/**
 * Clear for load-in: nothing blocking is outstanding.
 *
 * `alsoBlocked` exists because the visible list is deliberately not the whole
 * truth. A maker who declared themselves an occasional seller has no permit
 * row, since the next move is ours, but their 410-D is not signed and they are
 * NOT clear. Reading clearance off the rows alone would have told them they
 * were fine, which is the one thing this sentence must never get wrong.
 */
export function clearForLoadIn(items: ChecklistItem[], alsoBlocked = false): boolean {
  return !alsoBlocked && items.every((i) => !i.blocksLoadIn || i.state === 'done')
}
