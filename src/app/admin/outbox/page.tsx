import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { emailOutbox } from '@/db/schema'
import { fmtDateTime } from '@/lib/dates'

export const dynamic = 'force-dynamic'

const LIMIT = 50

/** `application_received` reads as "Application received" to a person. */
const kindOf = (t: string) => {
  const s = t.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * The record of every message the system has sent. Scannable down four
 * columns (kind, recipient, subject, time), with the body opening in place
 * so checking what a maker actually received never costs a page load.
 */
export default async function Outbox() {
  const mails = await db.select().from(emailOutbox).orderBy(desc(emailOutbox.sentAt)).limit(LIMIT)

  const count = (s: string) => mails.filter((m) => m.deliveryStatus === s).length
  const failed = count('failed')

  const kinds = [...new Set(mails.map((m) => m.template))]
    .map((t) => ({ t, n: mails.filter((m) => m.template === t).length }))
    .sort((a, b) => b.n - a.n)

  const stats: Array<{ k: string; v: string; n: string; warn?: boolean }> = [
    { k: 'Messages', v: String(mails.length), n: `The last ${LIMIT}, newest first.` },
    { k: 'Delivered', v: String(count('sent')), n: 'Accepted by Resend.' },
    { k: 'Logged only', v: String(count('logged')), n: 'Recorded here, not sent. No API key set.' },
    { k: 'Failed', v: String(failed), n: 'Open the row for what came back.', warn: failed > 0 },
  ]

  return (
    <div style={{ padding: '26px 26px 80px' }}>
      <header className="op-head">
        <h1>Outbox</h1>
        <p className="lede">
          Every message the system sends, exactly as the maker receives it. Delivery runs through
          Resend when RESEND_API_KEY is set. &ldquo;Logged only&rdquo; means the message was
          recorded but sending is not configured. Open a row to read the body.
        </p>
      </header>

      {mails.length === 0 ? (
        <p style={{ color: 'var(--ink-3)', fontSize: 'var(--t-s)' }}>
          Nothing sent yet. Accept or decline someone in the jury queue.
        </p>
      ) : (
        <>
          <dl className="op-stats">
            {stats.map((s) => (
              <div key={s.k} data-warn={s.warn ? '1' : undefined}>
                <dt className="k">{s.k}</dt>
                <dd style={{ margin: 0 }}>
                  <span className="v">{s.v}</span>
                  <span className="n">{s.n}</span>
                </dd>
              </div>
            ))}
          </dl>

          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', marginBottom: 22 }}>
            <span className="k">By kind</span>
            {kinds.map((k) => (
              <span key={k.t} className="chip">{kindOf(k.t)} {k.n}</span>
            ))}
          </div>

          <div className="op-mail">
            <div className="hd" aria-hidden="true">
              <span className="k">Kind</span>
              <span className="k">To</span>
              <span className="k">Subject</span>
              <span className="k">Delivery</span>
              <span className="k at">Sent</span>
            </div>

            {mails.map((m) => (
              <details key={m.id}>
                <summary>
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
                  <span className="at">{fmtDateTime(m.sentAt)}</span>
                </summary>
                <div className="bd">
                  <div style={{ fontFamily: 'var(--font-g)', fontSize: 'var(--t-lead)', marginBottom: 10 }}>
                    {m.subject}
                  </div>
                  {m.deliveryDetail && (
                    <p className="op-note" style={{ marginBottom: 12, color: 'var(--warn)' }}>
                      {m.deliveryDetail}
                    </p>
                  )}
                  <pre>{m.body}</pre>
                </div>
              </details>
            ))}
          </div>

          <p className="op-note" style={{ marginTop: 20 }}>
            The row is written whether or not sending is configured, so this is the audit trail
            even on a machine with no key. Nothing here is editable and nothing is deleted.
          </p>
        </>
      )}
    </div>
  )
}
