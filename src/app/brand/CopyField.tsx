'use client'

import { useState } from 'react'

/**
 * The url, and a button that copies it.
 *
 * The url stays visible and selectable rather than hiding behind the button,
 * because clipboard access fails in more browsers than people expect and a
 * copy button with nothing to fall back to leaves you stuck.
 */
export function CopyField({ value }: { value: string }) {
  const [done, setDone] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setDone(true)
      setTimeout(() => setDone(false), 1600)
    } catch {
      /* No clipboard. The url is on screen and selectable, so say nothing. */
    }
  }

  return (
    <div className="copy">
      <code>{value}</code>
      <button type="button" onClick={copy} aria-live="polite">
        {done ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
