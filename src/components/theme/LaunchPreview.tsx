'use client'

import { useEffect, useState } from 'react'
import { PREVIEW_COOKIE } from '@/lib/preview-cookie'

/**
 * The launch preview bar.
 *
 * It used to be a `cookies()` read inside SiteShell. SiteShell wraps every
 * public page, so that one read made the entire public site uncacheable:
 * every visitor to the homepage woke a serverless function and waited on a
 * cold Postgres connection before seeing a word. On 24 Sept the first visit
 * after a quiet spell took ninety seconds and looked exactly like an outage.
 *
 * A staff-only preview flag was never worth that. So the flag is read in the
 * browser here, which costs a moment after hydration and costs the public
 * nothing, because the page it sits on is now served from cache with no
 * server work at all.
 *
 * The catch is what that buys and what it does not. A cached page cannot
 * render differently for the previewer, so the announcement bar and the
 * application window on it are the live ones. The pages where the preview
 * has to be faithful, above all /apply, are dynamic anyway: they read the
 * cookie on the server and render `<PreviewBar faithful />` themselves. Each
 * bar says which of the two it is, because a preview that quietly lies about
 * what it is previewing is worse than none.
 */

export function PreviewBar({ faithful = false }: { faithful?: boolean }) {
  return (
    <div className="preview-bar" role="status">
      <strong>Launch preview.</strong>{' '}
      {faithful
        ? (
          <>
            This browser is being shown the site as it will read once
            applications open. Nobody else sees this. The form will accept a
            submission from you, and it makes a real application, so delete it
            from the admin when you are done.
          </>
        )
        : (
          <>
            The preview is on in this browser. The application page will read
            as it will once applications open, and a submission from you makes
            a real application. This page is the live one, the same as
            everyone else sees.
          </>
        )}
      {' '}
      {/* A plain anchor, deliberately. /api/preview is a route handler, not a
          page, and next/link PREFETCHES: it fires GET /api/preview?on=0 as
          soon as this bar enters the viewport, and for the signed-in staff
          member the bar is aimed at, that request is the one that clears the
          cookie. The preview then switched itself off, seemingly at random,
          which is what was blamed on the session cookie and fixed by giving
          it a twelve hour life. An anchor is not prefetched, so the preview
          now ends when somebody clicks this and not before. */}
      <a href="/api/preview?on=0">Turn it off</a>
    </div>
  )
}

export function LaunchPreview() {
  const [on, setOn] = useState(false)

  useEffect(() => {
    /* document.cookie throws in no browser, but it is empty in plenty of
       them, so an absent cookie simply means not previewing. */
    try {
      setOn(document.cookie.split('; ').some((c) => c === `${PREVIEW_COOKIE}=1`))
    } catch { setOn(false) }
  }, [])

  return on ? <PreviewBar /> : null
}
