'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The email, framed, at whatever height the email actually is.
 *
 * A fixed frame height cuts the message off partway down a row, which is the
 * one thing a preview must not do: the reason to look at this page is to see
 * the whole thing before a maker does. The frame is same-origin, so we measure
 * the document inside it and grow to that.
 *
 * The measuring runs from an effect rather than from `onLoad` alone, because a
 * frame near the top of the page usually finishes loading before React has
 * hydrated and its load event is gone by the time a handler exists. A
 * ResizeObserver on the inner document then keeps it right as fonts settle and
 * as the admin is resized.
 *
 * Without JavaScript the frame keeps the CSS height, which reads most of a
 * message and scrolls for the rest.
 */
export function EmailFrame({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [h, setH] = useState<number | null>(null)

  useEffect(() => {
    const frame = ref.current
    if (!frame) return
    let observer: ResizeObserver | undefined

    const fit = () => {
      const doc = frame.contentDocument
      if (!doc?.documentElement) return
      setH(Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0))
    }

    const watch = () => {
      fit()
      const root = frame.contentDocument?.documentElement
      const win = frame.contentWindow
      if (!root || !win) return
      // The observer belongs to the framed window: an observer made out here
      // would be watching an element from a different document.
      const R = (win as Window & typeof globalThis).ResizeObserver
      if (!R) return
      observer?.disconnect()
      observer = new R(fit)
      observer.observe(root)
    }

    // `complete` covers the frame that loaded before this component existed.
    if (frame.contentDocument?.readyState === 'complete') watch()
    frame.addEventListener('load', watch)
    return () => {
      frame.removeEventListener('load', watch)
      observer?.disconnect()
    }
  }, [src])

  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      style={h ? { height: `${h}px` } : undefined}
    />
  )
}
