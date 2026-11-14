'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Pull the figures again every minute, without anybody pressing anything.
 *
 * A dashboard somebody has to refresh is a dashboard that is quietly wrong
 * on a wall for an hour. router.refresh re-runs the server component and
 * swaps the result in, so the page never blanks and nothing is lost if the
 * register is slow to answer.
 */
export function Refresh({ every = 60 }: { every?: number }) {
  const router = useRouter()
  const [ago, setAgo] = useState(0)

  useEffect(() => {
    const tick = setInterval(() => setAgo((n) => n + 1), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    if (ago < every) return
    setAgo(0)
    router.refresh()
  }, [ago, every, router])

  return (
    <button
      type="button"
      className="sx-refresh"
      onClick={() => { setAgo(0); router.refresh() }}
    >
      {ago < 2 ? 'Just now' : `${ago}s ago`}
      <span aria-hidden="true"> &middot; refresh</span>
    </button>
  )
}
