import { Fragment } from 'react'
import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { emailOutbox } from '@/db/schema'
import { fmtDate, fmtDateTime } from '@/lib/dates'

export const dynamic = 'force-dynamic'

const LIMIT = 50

/** Five columns, shared by the header row and every message row. */
const MAIL_COLS = {
  '--op-cols': '84px 156px minmax(150px,1fr) minmax(0,1.75fr) 88px 58px',
} as React.CSSProperties

/** `application_received` reads as "Application received" to a person. */
const kindOf = (t: string) => {
  const s = t.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * "Sep 5, 10:04 AM" → "10:04 AM". The day is the heading over the run, so
 * the row only carries the time. Derived from fmtDateTime rather than a new
 * formatter so the Pacific conversion stays in one place (CLAUDE.md rule 8).
 */
const timeOf = (iso: string) => {
  const parts = fmtDateTime(iso).split(', ')
  return parts.length > 1 ? parts.slice(1).join(', ') : parts[0]
}

/**
 * The record of every message the system has sent. Grouped by the day it went
 * out and scannable across time, kind, recipient and subject, with the body
 * opening in place so checking what a maker actually received never costs a
 * page load.
 */
export default async function Outbox() {
  const mails = await db.select().from(emailOutbox).orderBy(desc(emailOutbox.sentAt)).limit(LIMIT)

  const count = (s: string) => mails.filter((m) => m.deliveryStatus === s).length
  const failed = count('failed')

  const kinds = [...new Set(mails.map((m) => m.template))]
    .map((t) => ({ t, n: mails.filter((m) => m.template === t).length }))
    .sort((a, b) => b.n - a.n)

  /* Newest first, so a run of messages sent on one day is already contiguous
     and the days fall out of one pass. */
  const days: Array<{ day: string; items: typeof mails }> = []
  for (const m of mails) {
    const day = fmtDate(m.sentAt)
    const open = days[days.length - 1]
    if (open && open.day === day) open.items.push(m)
    else days.push({ day, items: [m] })
  }

  const stats: Array<{ k: string; v: string; n: string; warn?: boolean }> = [
    { k: 'Messages', v: String(mails.length), n: `The last ${LIMIT}, newest first.` },
    { k: 'Delivered', v: String(count('sent')), n: 'Accepted by Resend.' },
    { k: 'Logged only', v: String(count('logged')), n: 'Recorded here, not sent. No API key set.' },
    { k: 'Failed', v: String(failed), n: 'Open the row for what came back.', warn: failed > 0 },
  ]

  return (
    <div className="op-page">
      <header className="op-head">
        <span className="eb">Record</span>
        <h1 className="t">Outbox</h1>
        <p className="lede">
          Every message the system sends, exactly as the maker receives it. Delivery runs through
          Resend when RESEND_API_KEY is set. &ldquo;Logged only&rdquo; means the message was
          recorded but sending is not configured. Open a row to read the body.
        </p>
      </header>

      {mails.length === 0 ? (
        <p className="op-empty">
          Nothing sent yet. Accept or decline someone in the jury queue and the message lands here.
        </p>
      ) : (
        <>
          <div className="op-reads">
            {stats.map((s) => (
              <div className="op-read" key={s.k} data-warn={s.warn ? '1' : undefined}>
                <span className="k">{s.k}</span>
                <span className="v">{s.v}</span>
                <span className="n">{s.n}</span>
              </div>
            ))}
          </div>

          <div className="op-kinds">
            <span className="k">By kind</span>
            {kinds.map((k) => (
              <span key={k.t} className="chip">{kindOf(k.t)} · {k.n}</span>
            ))}
          </div>

          <div className="op-sec">
            <h2>Messages</h2>
            <span className="c">
              {days.length} {days.length === 1 ? 'day' : 'days'}
            </span>
          </div>

          <div className="op-mail" style={MAIL_COLS}>
            <div className="hd" aria-hidden="true">
              <span className="k">Sent</span>
              <span className="k">Kind</span>
              <span className="k">To</span>
              <span className="k">Subject</span>
              <span className="k">Delivery</span>
              <span />
            </div>

            {days.map((d) => (
              <Fragment key={d.day}>
                <h3 className="op-day">
                  {d.day}
                  <span className="c">
                    {d.items.length} {d.items.length === 1 ? 'message' : 'messages'}
                  </span>
                </h3>

                {d.items.map((m) => (
                  <details key={m.id}>
                    <summary>
                      <span className="at">{timeOf(m.sentAt)}</span>
                      <span>
                        <span className="chip">{kindOf(m.template)}</span>
                      </span>
                      <span className="to">{m.toEmail}</span>
                      <span className="sj">{m.subject}</span>
                      <span>
                        <span
                          className="chip"
                          data-s={m.deliveryStatus === 'sent' ? 'accepted' : undefined}
                          data-warn={m.deliveryStatus === 'failed' ? '1' : undefined}
                        >
                          {m.deliveryStatus === 'logged' ? 'Logged' : m.deliveryStatus}
                        </span>
                      </span>
                      <span className="ex" aria-hidden="true" />
                    </summary>
                    <div className="bd">
                      <div className="sub">{m.subject}</div>
                      {m.deliveryDetail && (
                        <p className="op-note" style={{ color: 'var(--warn)', marginBottom: 12 }}>
                          {m.deliveryDetail}
                        </p>
                      )}
                      <pre>{m.body}</pre>
                    </div>
                  </details>
                ))}
              </Fragment>
            ))}
          </div>

          <div className="op-foot">
            <p className="op-note">
              The row is written whether or not sending is configured, so this is the audit trail
              even on a machine with no key. Nothing here is editable and nothing is deleted.
            </p>
            <p className="op-note">
              Times are Pacific. The list holds the last {LIMIT} messages, newest first.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
