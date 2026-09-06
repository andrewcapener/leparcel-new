'use client'

import { useState } from 'react'

/**
 * The rehearsal link, with a button that copies it.
 *
 * A link this long is not something anybody retypes, and selecting it by hand
 * out of a paragraph is how half of it goes missing. The URL is still on
 * screen in full, because a copy button that silently fails leaves you with
 * nothing, and because seeing it is how you know which host it points at.
 */
export function RehearsalLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused, and there is nothing useful to say
      // about it: the URL is on screen and can be selected.
      setCopied(false)
    }
  }

  return (
    <div className="adm-share">
      <code className="adm-share__url">{url}</code>
      <button type="button" className="adm-btn" onClick={copy}>
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  )
}
