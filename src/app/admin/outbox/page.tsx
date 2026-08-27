import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { emailOutbox } from '@/db/schema'
import { fmtDateTime } from '@/lib/dates'

export const dynamic = 'force-dynamic'

export default async function Outbox() {
  const mails = await db.select().from(emailOutbox).orderBy(desc(emailOutbox.sentAt)).limit(50)

  return (
    <div style={{ padding: '26px 26px 80px' }}>
      <h1 style={{ fontFamily: 'var(--font-c)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.012em', fontSize: 34, marginBottom: 8 }}>Outbox</h1>
      <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 26, maxWidth: 72 + 'ch' }}>
        The prototype writes mail here instead of sending it, so you can read exactly what a vendor
        receives at each step. Swap for Resend + React Email at the same call site in{' '}
        <code>src/app/actions.ts</code>.
      </p>

      {mails.length === 0 ? (
        <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>
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
                <span style={{ fontSize: 13 }}>{m.toEmail}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>
                  {fmtDateTime(m.sentAt)}
                </span>
              </div>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontFamily: 'var(--font-g)', fontSize: 19, marginBottom: 10 }}>
                  {m.subject}
                </div>
                <pre style={{
                  whiteSpace: 'pre-wrap', fontFamily: 'var(--font-j)', fontSize: 13.5,
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
