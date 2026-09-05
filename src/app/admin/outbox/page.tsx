import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { emailOutbox } from '@/db/schema'
import { fmtDateTime } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export default async function Outbox() {
  const mails = await db.select().from(emailOutbox).orderBy(desc(emailOutbox.sentAt)).limit(50)

  return (
    <div style={{ padding: '26px 26px 80px' }}>
      <h1 style={{ fontFamily: 'var(--font-c)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.012em', fontSize: 'var(--t-d2)', marginBottom: 8 }}>Outbox</h1>
      <p style={{ fontSize: 'var(--t-lbl)', color: 'var(--ink-3)', marginBottom: 26, maxWidth: 72 + 'ch' }}>
        Every message the system sends, exactly as the vendor receives it. Delivery runs through
        Resend when RESEND_API_KEY is set; &ldquo;logged&rdquo; means the message was recorded but
        sending is not configured.
      </p>

      {mails.length === 0 ? (
        <p style={{ color: 'var(--ink-3)', fontSize: 'var(--t-s)' }}>
          Nothing sent yet. Accept or decline someone in the jury queue.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 18, maxWidth: 760 }}>
          {mails.map((m) => (
            <article key={m.id} style={{ border: '1px solid var(--line)', background: '#FFFDF9' }}>
              <div style={{
                display: 'flex', gap: 14, alignItems: 'baseline', padding: '11px 16px',
                borderBottom: '1px solid var(--line)', background: 'var(--paper-2)',
              }}>
                <span className="chip">{m.template}</span>
                <span
                  className="chip"
                  data-warn={m.deliveryStatus === 'failed' ? '1' : undefined}
                  title={m.deliveryDetail || undefined}
                >
                  {m.deliveryStatus}
                </span>
                <span style={{ fontSize: 'var(--t-lbl)' }}>{m.toEmail}</span>
                <span style={{ marginLeft: 'auto', fontSize: 'var(--t-lbl-s)', color: 'var(--ink-3)' }}>
                  {fmtDateTime(m.sentAt)}
                </span>
              </div>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontFamily: 'var(--font-g)', fontSize: 'var(--t-lead)', marginBottom: 10 }}>
                  {m.subject}
                </div>
                <pre style={{
                  whiteSpace: 'pre-wrap', fontFamily: 'var(--font-j)', fontSize: 'var(--t-lbl)',
                  lineHeight: 1.62, color: 'var(--ink-2)', margin: 0,
                }}>{m.body}</pre>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
