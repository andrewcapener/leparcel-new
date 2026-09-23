import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { siteUrl } from '@/lib/site-url'
import { usd } from '@/lib/money'
import { fmtDateTime } from '@/lib/dates'
import { planChase } from '@/server/modules/email/chase-send'
import { nextNineAmPacific, owedCents, pacificDay } from '@/server/modules/email/fee-chase'
import { PageHead, Stats, Stat } from '../ui'
import { ChaseForm, type Row } from './ChaseForm'

export const dynamic = 'force-dynamic'
/* Sixty two inserts and one call to Resend. Comfortably inside a minute and
   nowhere near the platform's default. */
export const maxDuration = 60

/**
 * Chase everyone whose booth fee is due today.
 *
 * The one screen in this admin that mails a crowd, and it is built to be read
 * before it is pressed. Everybody who would receive it is listed with their
 * own address and their own fee, everybody deliberately left out is listed
 * underneath with the reason, and the email itself is printed at the bottom
 * exactly as it will arrive.
 *
 * Drew's standing instruction since the roster import has been that nothing
 * reaches a maker unasked. This does not change that: no switch on Show
 * settings arms it, no job runs it, and nothing here sends until a person
 * ticks a list and presses a button. What it replaces is a mail merge out of
 * a spreadsheet, where a shifted column tells a maker she owes somebody
 * else's fee.
 */
export default async function ChasePage() {
  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  const now = new Date()
  const { plan, today, alreadySent } = await planChase(db, show.id, siteUrl(), now)

  const rows: Row[] = plan.send.map((c) => ({
    bookingId: c.booking.bookingId,
    code: c.booking.vendorCode,
    shop: c.booking.shopName,
    contact: c.booking.contactName,
    email: c.booking.email,
    track: c.booking.track,
    space: c.booking.spaceLabel,
    fee: usd(c.booking.totalCents),
    already: alreadySent.has(c.booking.email.toLowerCase()),
  }))

  const hasKey = Boolean(process.env.RESEND_API_KEY)
  const defaultAt = pacificLocalValue(nextNineAmPacific(now))
  const sample = plan.send[0]

  return (
    <div className="adm-narrow">
      <PageHead
        title="Chase the booth fee"
        sub={`${show.numeral} · ${show.name} · ${today} Pacific`}
      />

      <Stats cols={3}>
        <Stat label="Would be emailed" icon="mail" value={String(plan.send.length)} unit="makers" />
        <Stat label="Still owed" icon="money" value={usd(owedCents(plan))} />
        <Stat label="Left out" icon="shield" value={String(plan.held.length)} unit="with a reason" />
      </Stats>

      {!hasKey && (
        <p className="adm-note">
          <strong>No Resend key on this deployment.</strong> Nothing can leave. Pressing the
          button will still write every message to the outbox so you can see exactly what it
          would have sent, and will tell you it did not send.
        </p>
      )}

      <p className="adm-note">
        One email per maker, rendered from their own booking: their name, their space, their
        fee and their own pay link. Nothing is merged from a spreadsheet, so no column can
        shift and tell somebody they owe another maker&rsquo;s money.
      </p>

      {plan.send.length === 0 ? (
        <p className="adm-empty">
          Nobody has a booth fee due today. That is either very good news or the wrong day.
        </p>
      ) : (
        <ChaseForm rows={rows} defaultAt={defaultAt} />
      )}

      {plan.held.length > 0 && (
        <>
          <div className="adm-sec"><h2>Not being emailed</h2></div>
          <p className="adm-note">
            Everybody the roster holds who is not on the list above, and why. Nobody is ever
            dropped quietly: if a maker is missing from the send, she is here.
          </p>
          <table className="adm-tbl adm-tbl--tight">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Shop</th>
                <th scope="col">Fee</th>
                <th scope="col">Why not</th>
              </tr>
            </thead>
            <tbody>
              {plan.held.map((h) => (
                <tr key={h.booking.bookingId}>
                  <td className="mono">{h.booking.vendorCode}</td>
                  <td className="adm-nm">{h.booking.shopName}</td>
                  <td className="adm-money">{usd(h.booking.totalCents)}</td>
                  <td>{h.because}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {sample && (
        <>
          <div className="adm-sec"><h2>Exactly what arrives</h2></div>
          <p className="adm-note">
            {sample.booking.shopName}&rsquo;s copy, as it will land. Everyone else&rsquo;s is
            the same words with their own name, space, fee and link.
          </p>
          <p className="adm-note">
            <strong>Subject:</strong> {sample.subject}
          </p>
          <pre className="adm-code" style={{ whiteSpace: 'pre-wrap' }}>{sample.text}</pre>
        </>
      )}

      <div className="adm-sec"><h2>Before you press it</h2></div>
      <p className="adm-note">
        Match every Venmo and Zelle first, on the roster. A maker who paid you yesterday and
        gets chased today is the one phone call this email is supposed to prevent. Whatever is
        marked paid when you press this is what it believes.
      </p>
      <p className="adm-note">
        Scheduled sends are held by Resend, so once this says scheduled it will arrive whether
        or not this site is up. Pressing it twice on the same morning delivers once. A maker
        who pays after it is scheduled will still receive it, which is why the email says to
        ignore it if the money has already gone.
      </p>
      <p className="adm-note">
        Last checked {fmtDateTime(now.toISOString())}.
      </p>
    </div>
  )
}

/**
 * An instant as the value a datetime-local input wants, in Pacific.
 *
 * The input has no timezone of its own: it shows whatever string it is given.
 * Handing it a UTC ISO string would show nine in the morning to the browser
 * and mean two in the afternoon in Dana Point (rule 8).
 */
function pacificLocalValue(d: Date): string {
  const day = pacificDay(d)
  const t = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit',
  }).formatToParts(d)
  const h = String(Number(t.find((p) => p.type === 'hour')?.value ?? '0') % 24).padStart(2, '0')
  const m = t.find((p) => p.type === 'minute')?.value ?? '00'
  return `${day}T${h}:${m}`
}
