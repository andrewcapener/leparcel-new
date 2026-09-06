import { activeShow } from '@/db/queries'
import { siteUrl } from '@/lib/site-url'
import { previews, previewContext } from '@/server/modules/email/previews'
import { PageHead } from '../ui'
import { EmailFrame } from './EmailFrame'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Emails' }

/**
 * Every email the system sends, as the person receiving it will see it.
 *
 * The team writes the copy and never sees the result until a maker gets one,
 * which is a bad moment to notice a wrong date. So each is rendered here
 * against the live Show record: change the roster date at /admin/show and this
 * page changes with it.
 *
 * Both parts are shown. The plain text is not a lesser version, it is what
 * arrives when a client refuses HTML and it is what /admin/outbox stores, so
 * it is worth reading too.
 */
export default async function EmailsPage() {
  const show = await activeShow()
  if (!show) throw new Error('No active show.')
  const items = previews(show, siteUrl())

  return (
    <>
      <PageHead
        title="Emails"
        sub={<>What we send, as it arrives. Built from {previewContext(show)}, so it changes when the show does.</>}
      />

      <div className="adm-emails">
        {items.map((p) => (
          <section key={p.id} className="adm-email" aria-labelledby={`${p.id}-h`}>
            <header className="adm-email__head">
              <h2 className="adm-email__title" id={`${p.id}-h`}>{p.name}</h2>
              <dl className="adm-email__meta">
                <div><dt>To</dt><dd>{p.who}</dd></div>
                <div><dt>Sent</dt><dd>{p.when}</dd></div>
                <div><dt>Subject</dt><dd>{p.subject}</dd></div>
              </dl>
            </header>

            <div className="adm-email__frame">
              {/* An email is a whole document with its own body and ground, so
                  it gets a frame rather than being poured into this page. */}
              <EmailFrame
                src={`/admin/emails/render?id=${encodeURIComponent(p.id)}`}
                title={`${p.name}, as it arrives`}
              />
            </div>

            <details className="adm-email__text">
              <summary>The plain text version</summary>
              <pre>{p.text}</pre>
            </details>
          </section>
        ))}
      </div>
    </>
  )
}
