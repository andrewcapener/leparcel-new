'use server'

/**
 * Send a maker their booth fee invoice again, as it stands today.
 *
 * Drew, 24 Sept: "you should be able to send other invoices to them after
 * they've paid."
 *
 * Until now the fee email went out exactly once, at the moment of acceptance,
 * carrying the total from that moment. Everything since then, a second day, a
 * corner, a credit, a downgrade, existed on the roster and on the maker's page
 * and in no email anybody ever received. The maker with a changed order had to
 * be told by hand, or find out by opening a link she had been sent in
 * September.
 *
 * So this re-reads the invoice and sends what it says now. The CURRENT balance,
 * the lines that produced it, what has already arrived, and the same pay link,
 * which asks for the balance rather than the whole fee again.
 *
 * Three things it deliberately does not do.
 *
 * It does not mark anything paid, or move `status`, or touch what has arrived.
 * Payment state belongs to a verified Stripe webhook and to staff pressing
 * Mark paid (rule 5). This only asks.
 *
 * It does not change what is owed, so it does not bump `priceVersion` and does
 * not cancel a live Checkout Session. A half finished checkout for this
 * balance is still for this balance, and expiring it would take a maker who is
 * mid payment back to the beginning for nothing.
 *
 * And it does not send a $0 invoice. A settled booking is refused with a
 * notice, because an invoice for nothing is not information, it is a question.
 */
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { auditLog, bookings, shows, vendors } from '@/db/schema'
import { boothInvoice } from '@/server/modules/payments/booth'
import { boothFeeHtml, boothFeeText } from '@/server/modules/email/booth-fee'
import { mail } from '@/server/modules/email/send'
import { ADMIN_COOKIE, staffForSession } from '@/lib/adminAuth'
import { siteUrl } from '@/lib/site-url'
import {
  backTo, cleanNote, invoiceView, resendDeadline, resendProblem, resendSubject,
} from './resend-lines'

const TEMPLATE = 'booth_fee_resend'
/**
 * One message, recorded first and delivered second, through the one transport
 * this application has: src/server/modules/email/send.ts.
 *
 * This was a copy of that function. The copy existed because mail() used to
 * be private to actions.ts, which carries 'use server' where an exported
 * helper becomes a callable endpoint. Moving it out of that file removed the
 * reason, and can-send.test.ts counts the modules that can reach Resend
 * precisely so a second transport cannot quietly appear and drift.
 */
async function send(
  toEmail: string, subject: string, text: string, html: string,
): Promise<'sent' | 'logged' | 'failed'> {
  return mail(toEmail, subject, text, TEMPLATE, undefined, html)
}

/** Who pressed it (rule 3). The audit log carries a name, never an address. */
async function staffActor(): Promise<string> {
  try {
    const who = await staffForSession((await cookies()).get(ADMIN_COOKIE)?.value)
    return `staff:${who?.name ?? 'staff'}`
  } catch {
    return 'staff:staff'
  }
}

export async function resendBoothInvoice(fd: FormData): Promise<void> {
  const bookingId = String(fd.get('bookingId') ?? '')
  const note = cleanNote(String(fd.get('note') ?? ''))
  const back = String(fd.get('back') ?? '/admin/roster')
  /* Annotated `never` so the compiler knows the lines after a refusal are
     unreachable, the way `redirect()` itself does. */
  const go = (outcome: string): never => redirect(backTo(back, 'resend', outcome))

  const found = await boothInvoice(db, bookingId)
  if (!found) return go('missing')
  const { booking, invoice } = found

  const [vendor] = await db.select({
    email: vendors.email, shopName: vendors.shopName,
  }).from(vendors).where(eq(vendors.id, booking.vendorId)).limit(1)
  const [show] = await db.select({
    name: shows.name, paymentMethods: shows.paymentMethods,
    paymentDueAt: shows.paymentDueAt, paymentWindowHours: shows.paymentWindowHours,
  }).from(shows).where(eq(shows.id, booking.showId)).limit(1)
  if (!vendor || !show) return go('missing')

  const problem = resendProblem({
    status: booking.status,
    amountDueCents: invoice.amountDueCents,
    payToken: booking.payToken,
    email: vendor.email,
  })
  if (problem) return go(problem)

  const nowIso = new Date().toISOString()
  const due = resendDeadline({
    dueAtIso: booking.paymentDueAt,
    nowIso,
    fixedAt: show.paymentDueAt,
    windowHours: show.paymentWindowHours,
  })
  const { lines, totalLabel } = invoiceView(invoice, note)
  const bits = {
    /* The booking's own token, so there is no sign-in between a maker and the
       balance she is being asked for. */
    url: `${siteUrl()}/pay/${booking.payToken}`,
    shopName: vendor.shopName,
    showName: show.name,
    lines,
    totalLabel,
    deadline: due.label,
    /* Bank only means the date is when to START a transfer, because ACH takes
       about four business days and the template says so. */
    startOnly: show.paymentMethods === 'bank_only',
    vendorCode: booking.vendorCode,
  }

  const outcome = await send(
    vendor.email,
    resendSubject(show.name, invoice),
    boothFeeText(bits),
    boothFeeHtml(bits),
  )

  /* When the fee email last went out. The audit row below carries the previous
     value, so the first send is still readable in December (rule 3). Only on a
     real delivery: a row that says an invoice was emailed when Resend refused
     it is worse than a blank one. */
  const delivered = outcome === 'sent'
  if (delivered) {
    await db.update(bookings).set({ feeEmailAt: nowIso }).where(eq(bookings.id, booking.id))
  }

  /* Rule 3: actor, timestamp, before and after, reason. No address and no note
     text, because both can carry a maker's own words and neither belongs in a
     log (rule 9). The exact message is in the outbox row instead. */
  await db.insert(auditLog).values({
    id: randomUUID(),
    entity: 'booking',
    entityId: booking.id,
    action: 'booth_fee_resent',
    before: JSON.stringify({ feeEmailAt: booking.feeEmailAt }),
    after: JSON.stringify({
      feeEmailAt: delivered ? nowIso : booking.feeEmailAt,
      delivery: outcome,
      totalCents: invoice.totalCents,
      paidCents: invoice.paidCents,
      amountDueCents: invoice.amountDueCents,
      deadline: due.label,
      deadlineBasis: due.basis,
      noteIncluded: note.length > 0,
    }),
    actor: await staffActor(),
    reason: 'Booth fee invoice re-sent from the roster',
  })

  revalidatePath('/admin/roster')
  revalidatePath('/account')
  /* Three outcomes, three notices. A provider that refused the message is not
     the same thing as a deployment with no key on it, and telling a staff
     member the second when it was the first sends them hunting for an
     environment variable that is already there. */
  return go(outcome)
}
