import type { ApplicationStatus } from '@/db/schema'

/**
 * Whether the form is taking applications, taking waitlist entries, or shut.
 *
 * Drew, 22 Sept, the morning after the window closed: the page should still
 * take a real application, framed as the waiting list. The reason is on the
 * Show record already. Seventy eight makers owe a booth fee by the 23rd and
 * some of them will not pay, so spaces come back into the pool that week, and
 * backfilling them from an application somebody can actually read beats
 * emailing a stranger who left nothing but an address.
 *
 * Three modes rather than a boolean, because "not open" covers two opposite
 * situations. Before a window opens there is nothing to apply TO: the next
 * show has no dates, no prices and no spaces, so a form would be collecting
 * answers to questions nobody has set. After it closes there is a real show
 * with real spaces that may come free, which is a waiting list worth having.
 */
export type Intake =
  /** The window is open. A normal application. */
  | 'open'
  /** The window has closed. Still collected, as a waitlist entry. */
  | 'waitlist'
  /** Nothing to apply to yet. Email capture only. */
  | 'shut'

export type Window = 'before' | 'open' | 'closed'

export function intakeMode(window: Window, staffRehearsal = false): Intake {
  /* Staff rehearsing before launch submit real applications on purpose, so
     the emails, the Sheet and the jury queue are all exercised. That has to
     stay a normal application and not a waitlist entry, or the rehearsal
     stops rehearsing the thing it exists to test. */
  if (staffRehearsal) return 'open'
  if (window === 'open') return 'open'
  if (window === 'closed') return 'waitlist'
  return 'shut'
}

/** Whether a form submitted in this mode is allowed to create a row at all. */
export const intakeAccepts = (mode: Intake): boolean => mode !== 'shut'

/**
 * The status the row lands on.
 *
 * A waitlist entry is `waitlist` and not `new`, which keeps it out of the
 * review queue's undecided count. That count is the jury's workload for a
 * show whose roster is already set; a maker who applied the morning after
 * close is not part of it, and inflating it would make the badge lie about
 * what is waiting on somebody.
 */
export function intakeStatus(mode: Intake): ApplicationStatus {
  return mode === 'waitlist' ? 'waitlist' : 'new'
}

/** What the page calls itself. */
export function intakeWords(mode: Intake) {
  if (mode === 'waitlist') {
    return {
      title: 'Join the waitlist',
      submit: 'Join the waitlist',
      sending: 'Sending',
      thanks: 'You are on the waitlist',
    }
  }
  return {
    title: 'Maker Application',
    submit: 'Submit application',
    sending: 'Sending',
    thanks: 'Thank You For Applying!',
  }
}
