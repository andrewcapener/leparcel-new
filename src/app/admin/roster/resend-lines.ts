/**
 * The pure half of re-sending a booth fee invoice.
 *
 * Drew, on what the roster could not do: "you should be able to send other
 * invoices to them after they've paid", and "we should be able to modify line
 * items on their invoice, add things, remove things etc. needs a lot of
 * flexiblitly."
 *
 * The money arithmetic already exists (payments/invoice.ts) and the email
 * template already exists (email/booth-fee.ts). What was missing is the bit
 * between them: turning a CURRENT invoice into the rows that template wants,
 * deciding whether asking this maker for money again is safe at all, and
 * carrying the outcome back to the screen the staff member pressed from.
 *
 * All of it is here, pure, because the two files next door carry 'use server'
 * and may only export async functions: a helper exported from one of those is
 * a runtime 500 that both tsc and the build pass in silence. See
 * src/app/use-server-exports.test.ts.
 *
 * Integer cents throughout, formatted only at the edge with usd() (rule 1).
 * Nothing in here sends, writes, or settles anything.
 */
import type { Field } from '@/server/modules/email/shell'
import type { Invoice } from '@/server/modules/payments/invoice'
import { canCollect } from '@/server/modules/payments/booking-status'
import { paymentDueAt } from '@/server/modules/payments/deadline'
import { fmtDeadline } from '@/lib/dates'
import { plainDashes } from '@/lib/dashes'
import { usd } from '@/lib/money'

/* ═══════════════════════ may we invoice at all ═══════════════════════ */

/** Why a re-send was refused. Null means go ahead. */
export type ResendRefusal =
  /** No such booking, or it lost the row the invoice is built from. */
  | 'missing'
  /** Nothing is owed. A $0 invoice is not an invoice, it is a puzzle. */
  | 'settled'
  /** The space is gone, or a transfer is already in flight. */
  | 'released'
  /** No pay token on the booking, so the email would carry no way to pay. */
  | 'nolink'
  /** No address to send it to. */
  | 'noaddress'

export type ResendCheck = {
  status: string
  /** Straight off the current invoice, never a stored figure. */
  amountDueCents: number
  payToken: string | null | undefined
  email: string | null | undefined
}

/**
 * Whether this maker can be asked for money right now.
 *
 * The balance decides whether there is anything to ask for and the status
 * decides whether asking is safe, which is exactly the split canCollect()
 * already makes: a confirmed booking that grew a second day is invoiced for
 * the difference, and a booking with a bank transfer in flight is not
 * invoiced at all, because that is the shape of charging somebody twice for
 * the same money.
 *
 * It never looks at the deadline. A maker who added a day in October owes for
 * that day whether or not her original window has closed, and refusing here
 * would leave staff with an invoice they cannot deliver.
 */
export function resendProblem(c: ResendCheck): ResendRefusal | null {
  if (!c.email) return 'noaddress'
  if (!c.payToken || c.payToken.length < 32) return 'nolink'
  if (c.amountDueCents <= 0) return 'settled'
  if (!canCollect(c.status, c.amountDueCents)) return 'released'
  return null
}

/* ═══════════════════════ the rows on the email ═══════════════════════ */

/** Longest staff note that goes on a maker's invoice. */
export const NOTE_MAX = 300

/**
 * A staff note, fit to put in front of a maker.
 *
 * Collapsed to one line because it renders inside a single field row, and run
 * through plainDashes because it is typed or pasted and a phone turns a typed
 * hyphen into an en dash by itself (docs/12-VOICE.md rule 2).
 */
export function cleanNote(raw: string): string {
  return plainDashes(raw.replace(/\s+/g, ' ').trim()).slice(0, NOTE_MAX).trim()
}

/**
 * The invoice, as rows.
 *
 * The template appends its own strong "Total" row after these, so the last
 * thing a maker reads is what they owe today. That means the rows here have to
 * add up to that number, which is why a part paid invoice carries an "Already
 * paid" row for what has arrived: space $900, extra day $350, already paid
 * -$900, total $350. Showing the full total and charging the difference, with
 * nothing in between to explain it, is how a maker decides the invoice is
 * wrong and stops reading.
 */
export function invoiceFields(invoice: Invoice, note = ''): Field[] {
  const rows: Field[] = []
  /* First, because it is the answer to "why am I getting this again". */
  if (note) rows.push({ label: 'What changed', value: note })
  for (const l of invoice.lines) rows.push({ label: l.label, value: usd(l.amountCents) })
  if (invoice.paidCents > 0) {
    rows.push({ label: 'Already paid', value: usd(-invoice.paidCents) })
  }
  return rows
}

/** What the template's Total row says: the balance, never the whole fee. */
export function dueLabel(invoice: Invoice): string {
  return usd(invoice.amountDueCents)
}

/** Both halves of what the template needs, in one call. */
export function invoiceView(
  invoice: Invoice, note = '',
): { lines: Field[]; totalLabel: string } {
  return { lines: invoiceFields(invoice, note), totalLabel: dueLabel(invoice) }
}

/**
 * The subject line.
 *
 * Two of them, because a maker who has paid nothing and a maker who owes the
 * balance on an order that changed are reading two different emails, and an
 * inbox is the one place that distinction has to survive being skimmed.
 */
export function resendSubject(showName: string, invoice: Invoice): string {
  return invoice.paidCents > 0
    ? `Your booth fee balance: ${showName}`
    : `Your booth fee: ${showName}`
}

/* ═══════════════════════ the date on the email ═══════════════════════ */

export type DeadlineChoice = {
  /** Rendered Pacific, ready to drop into the template (rule 8). */
  label: string
  /** Which date it is, so the audit row can say. */
  basis: 'booking' | 'window'
}

/**
 * When the balance is due.
 *
 * The booking's own deadline, while it is still ahead of us. That is the date
 * on the roster, the date the forfeit job reads, and the date the maker was
 * already told.
 *
 * Once it has passed, that date cannot go in this email. The template says
 * "pay to confirm your space by X", and naming a date in the past is the kind
 * of false sentence fee-chase.ts refuses to send for the same reason. So the
 * fallback is the Show's own payment policy applied from now: the later of the
 * fixed date and the window floor, which is the same function and the same
 * two columns that set the deadline when a maker is accepted. Nothing is
 * invented here and nothing on the booking is rewritten: this is the date in
 * the sentence, not a new deadline for forfeiting anybody.
 */
export function resendDeadline(input: {
  dueAtIso: string | null | undefined
  nowIso: string
  /** Show.paymentDueAt, the fixed date for this show. */
  fixedAt: string | null | undefined
  /** Show.paymentWindowHours, the floor. */
  windowHours: number
}): DeadlineChoice {
  const due = input.dueAtIso ? Date.parse(input.dueAtIso) : NaN
  const now = Date.parse(input.nowIso)
  if (Number.isFinite(due) && Number.isFinite(now) && due > now) {
    return { label: fmtDeadline(input.dueAtIso as string), basis: 'booking' }
  }
  const fresh = paymentDueAt({
    fixedAt: input.fixedAt,
    windowHours: input.windowHours,
    acceptedAtIso: input.nowIso,
  })
  return { label: fmtDeadline(fresh), basis: 'window' }
}

/* ═══════════════════════ staff input ═══════════════════════ */

/**
 * Dollars in a box to integer cents, or null for anything that is not money.
 *
 * Stricter than Number() on purpose. Number('1e4') is 10000 and Number('')
 * is 0, so a slip of the hand becomes a $10,000 line or a silent zero, and
 * neither belongs on a maker's invoice. A leading minus is kept: it is how a
 * line comes off.
 *
 * Parsed through a rounding step rather than a float multiply, because
 * 2.9 * 100 is 289.99999999999994 in this language and a booth fee is not the
 * place to find that out (rule 1).
 */
export function centsFromDollars(typed: string): number | null {
  const cleaned = typed.replace(/[$,\s]/g, '')
  if (!/^-?\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null
  const cents = Math.round(Number(cleaned) * 100)
  return Number.isSafeInteger(cents) ? cents : null
}

/* ═══════════════════════ getting back ═══════════════════════ */

/**
 * Where to send a staff member back to, carrying the outcome.
 *
 * The roster path already has a query string on it, because it remembers which
 * track and which fee state she was looking at. Appending with a second `?`
 * makes one parameter called `track` whose value is `outdoor?resend=sent`, so
 * the notice never renders and the press looks exactly like a press that did
 * nothing. Same bug, same fix as src/app/admin/thumbnails/back.ts.
 *
 * Only our own admin paths: `back` arrives in a form field, and a redirect
 * that follows anything a form says is an open redirect.
 */
export function backTo(back: string, key: string, outcome: string): string {
  const safe = back.startsWith('/admin/') && !back.startsWith('//') ? back : '/admin/roster'
  return `${safe}${safe.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(outcome)}`
}

/* ═══════════════════════ what the screen says ═══════════════════════ */

/**
 * The notice for every outcome of a re-send, in one place.
 *
 * Here rather than in the page because the page is a Server Component that
 * may not import from a 'use server' file's neighbours by accident, and
 * because copy a person reads after pressing a money button is worth a test.
 * Precise, never ambiguous about money or dates (docs/12-VOICE.md rule 9).
 */
export function resendNotice(code: string): string | null {
  switch (code) {
    case 'sent':
      return 'Invoice sent. It shows what they owe now, not the original total, '
        + 'and their pay link asks for that same balance.'
    case 'logged':
      return 'No mail key on this deployment, so nothing left the building. '
        + 'The invoice is written to the outbox exactly as the maker would have read it.'
    case 'failed':
      return 'The mail provider refused it, so the maker has not been told. '
        + 'The invoice and the reason are both in the outbox. Nothing about what '
        + 'they owe has changed.'
    case 'settled':
      return 'Nothing is owed on that booking, so no invoice went out. '
        + 'Add a line to their invoice first, then send it.'
    case 'released':
      return 'That booking is not one we can ask for money on: either the space '
        + 'has gone back to the pool, or a bank transfer is already on its way '
        + 'and a second ask is how somebody pays twice.'
    case 'nolink':
      return 'That booking has no pay link, so the email would have named no way '
        + 'to pay. Nothing was sent.'
    case 'noaddress':
      return 'No email address on that maker, so nothing was sent.'
    case 'missing':
      return 'That booking is no longer there. Nothing was sent.'
    default:
      return null
  }
}

/**
 * The notice for editing a line, including the outcomes addBoothCharge and
 * voidBoothCharge already use, so the roster can render one `charge` slot.
 */
export function chargeNotice(code: string): string | null {
  switch (code) {
    case 'edited':
      return 'Line replaced. The old amount stays on the invoice as a voided row '
        + 'with who changed it and why, the new one counts, and any half finished '
        + 'checkout of theirs was cancelled.'
    case 'same':
      return 'That is already what the line says, so nothing changed.'
    case 'voided':
      return 'That line was already taken off, so there was nothing to edit.'
    case 'mismatch':
      return 'That line belongs to a different booking. Nothing was changed.'
    case 'bad':
      return 'That line was not changed. It needs a description and an amount that '
        + 'is a real number of dollars, and a minus sign is how you take money off.'
    case 'missing':
      return 'That line is no longer there. Nothing was changed.'
    default:
      return null
  }
}

/**
 * The notice after taking an add-on off a booking.
 *
 * Separate from chargeNotice because an add-on is a different thing to a
 * charge line, and because the paid case has to be said out loud: taking a
 * $100 tent off a maker who already paid $950 does not move a cent by itself.
 * Somebody still has to send her the $100 (docs/12-VOICE.md rule 9: never
 * ambiguous about money).
 */
export function addonNotice(code: string): string | null {
  switch (code) {
    case 'voided':
      return 'Add-on taken off. It stays on the invoice as a voided row with who '
        + 'removed it and why, the balance is recalculated, and any half finished '
        + 'checkout of theirs was cancelled. If they already paid for it, this does '
        + 'not refund them: send the money back and note it here.'
    case 'already':
      return 'That add-on was already off the invoice, so nothing changed.'
    case 'missing':
      return 'That add-on is no longer there. Nothing was changed.'
    default:
      return null
  }
}

