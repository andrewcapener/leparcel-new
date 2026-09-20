'use client'

import { useState } from 'react'

/**
 * The payment link for one maker, and the record that somebody sent it.
 *
 * The team accept makers by hand and write their own acceptance emails, so
 * nothing in this system tells a maker they are in. This is what staff paste
 * into the email they write.
 *
 * The "Sent" tick is not decoration. The forfeit path releases unpaid spaces
 * when the window runs out whether or not anybody wrote to the maker, so
 * without a record of who has been contacted somebody can be accepted, never
 * told, and released anyway. The roster reads this to show who is still in
 * the dark.
 *
 * Copying is the one thing here that needs the browser, which is why this is
 * the only client component on the page. The fallback matters: the clipboard
 * API is unavailable over plain http and can be refused outright, so the link
 * is always visible as selectable text rather than living only behind a
 * button that may quietly do nothing.
 */
export function PayLink({ url, sent }: { url: string; sent: boolean }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* Refused or unavailable. The input below still holds the link, so the
         person selects it by hand rather than being told nothing happened. */
      setCopied(false)
    }
  }

  return (
    <div className="adm-paylink">
      <button className="adm-btn-q" type="button" onClick={copy} data-on={sent ? '1' : undefined}>
        {copied ? 'Copied' : 'Copy pay link'}
      </button>
      <input
        className="adm-paylink__url"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Payment link, select to copy by hand"
      />
    </div>
  )
}
