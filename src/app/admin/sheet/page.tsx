import { db } from '@/db'
import { activeShow } from '@/db/queries'
import { serviceAccount } from '@/server/modules/sheets/google-auth'
import { LINKS_TAB, PAYMENTS_TAB } from '@/server/modules/roster/sheet-push'
import { PageHead } from '../ui'
import { PushForm } from './PushForm'

export const dynamic = 'force-dynamic'
/* Two tabs, a clear and a write each, against Google. Comfortably inside a
   minute, but not inside the platform's default. */
export const maxDuration = 60

/**
 * Put the payment tabs in the team's own sheet.
 *
 * The girls work from a Google Sheet, not from this admin, so the roster has
 * to reach them where they already are. This writes two tabs into a sheet
 * they already have open: the pay links to mail merge from, and the payment
 * tracking to watch.
 *
 * The one step nobody guesses is the sharing. A service account is a user
 * with an email address, and a sheet it has never been shared with answers
 * 403 with a message about permissions that sends people to IAM. So the
 * address is on this page, in front of the button that needs it.
 */
export default async function SheetPush() {
  const show = await activeShow()
  if (!show) throw new Error('No active show. Run `npm run db:seed`.')

  const sa = serviceAccount()
  /* Only ever a sheet somebody named for THIS job. It used to fall back to
     SHEETS_SPREADSHEET_ID, which is the applications sync sheet: a default
     that is confidently wrong, and pressing the button without reading the
     field would have written the payment tabs into the wrong document. An
     empty field asks a question; a wrong one answers it. */
  /* The sheet this show is connected to, remembered from the last successful
     send. That is what the automatic refresh pushes into, so showing it here
     is showing where the live tabs actually go. */
  const connected = show.paymentSheetId?.trim() ?? ''
  const configured = connected
    ? `https://docs.google.com/spreadsheets/d/${connected}/edit`
    : process.env.PAYMENT_SHEET_URL?.trim() ?? ''

  return (
    <div className="adm-narrow">
      <PageHead
        title="Send to Google Sheet"
        sub={`${show.numeral} · ${show.name} · two tabs, replaced each time`}
      />

      <p className="adm-note">
        Writes <strong>{LINKS_TAB}</strong>, every accepted maker with their own payment link, and{' '}
        <strong>{PAYMENTS_TAB}</strong>, the same makers with what they owe and what has arrived.
        Both are replaced on every send, so they are never out of date and never doubled up.
        Anything typed in a column to the right of either table is left alone.
      </p>

      {sa ? (
        <>
          <div className="adm-sec"><h2>Before the first send</h2></div>
          <p className="adm-note">
            Open the sheet, press <strong>Share</strong>, and give this address the{' '}
            <strong>Editor</strong> role. It is the account this site already uses to write
            applications to a sheet, and it is the one step that is not obvious: a sheet it has
            never been shared with answers with a permissions error that reads like a broken key.
          </p>
          <p className="adm-code" style={{ userSelect: 'all' }}>{sa.email}</p>
        </>
      ) : (
        <p className="adm-note">
          <strong>No Google service account on this deployment.</strong> Nothing can be written
          to a sheet until GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are set. Until
          then, the two downloads in the sidebar are the same data as files.
        </p>
      )}

      {connected && (
        <>
          <div className="adm-sec"><h2>Live</h2></div>
          <p className="adm-note" role="status">
            <strong>Connected, and keeping itself up to date.</strong> Every payment that lands,
            every Venmo or Zelle you match by hand and every space you release refreshes both
            tabs on its way past. Nobody has to press anything. If Google is slow or unreachable
            the payment still records exactly as it should and the tabs catch up on the next one,
            or when you press the button below.
          </p>
          <p className="adm-code" style={{ userSelect: 'all' }}>{configured}</p>
        </>
      )}

      <div className="adm-sec"><h2>{connected ? 'Refresh now' : 'Send'}</h2></div>
      <PushForm defaultLink={configured} />

      <p className="adm-note">
        A pay link lets whoever holds it open that maker&rsquo;s invoice and pay it. That is what
        makes it worth emailing, and what makes this sheet worth keeping to the people sending
        the emails.
      </p>
    </div>
  )
}
