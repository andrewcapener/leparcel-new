'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The YouTube player their background-video sections lazy-load over the
 * poster frame.
 *
 * The poster is always rendered underneath, so this only ever adds motion.
 * It waits for the player to answer before revealing itself: a blocked embed
 * still fires the iframe's `load` event for its error page, and showing that
 * would put a grey rectangle where the photograph was.
 *
 * It used to be desktop only, on the reasoning that a phone arriving from an
 * Instagram story should not be made to pull a video stream before it has
 * read the dates. Drew, 7 Sep 2026: "i want the video if possible on mobile
 * yeah at least to see." It is the best thing on the page and it is his call,
 * so it plays everywhere now. The embed already carries mute, playsinline and
 * autoplay, which is exactly the combination iOS requires.
 *
 * Two people still get the still: anyone who asked for reduced motion, and
 * anyone whose phone is in data-saver mode. The second is not caution on our
 * part, it is somebody having told their device they are metered or nearly
 * out, and honouring that is not the same as deciding for them.
 */
export function BackgroundVideo({ youtubeId }: { youtubeId: string }) {
  const [show, setShow] = useState(false)
  const [playing, setPlaying] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    /* Chrome and the Android browsers expose this; Safari does not, and an
       absent value is not a request to save data, so it reads as false. */
    const saveData = () => Boolean(
      (navigator as { connection?: { saveData?: boolean } }).connection?.saveData,
    )
    const decide = () => setShow(!still.matches && !saveData())
    decide()
    still.addEventListener('change', decide)
    return () => still.removeEventListener('change', decide)
  }, [])

  useEffect(() => {
    if (!show || playing) return
    const onMessage = (e: MessageEvent) => {
      try {
        if (/(^|\.)youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) setPlaying(true)
      } catch { /* an opaque origin is not the player */ }
    }
    window.addEventListener('message', onMessage)
    const ping = () => frame.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*',
    )
    const t = setInterval(ping, 400)
    const stop = setTimeout(() => clearInterval(t), 8000)
    return () => {
      window.removeEventListener('message', onMessage)
      clearInterval(t)
      clearTimeout(stop)
    }
  }, [show, playing])

  if (!show) return null

  const params = new URLSearchParams({
    autoplay: '1', mute: '1', loop: '1', playlist: youtubeId,
    controls: '0', modestbranding: '1', playsinline: '1',
    rel: '0', disablekb: '1', iv_load_policy: '3', enablejsapi: '1',
  })

  return (
    <div className="video-section__bg-iframe-video" aria-hidden="true" data-playing={playing ? '1' : undefined}>
      <iframe
        ref={frame}
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}?${params}`}
        title=""
        tabIndex={-1}
        allow="autoplay; encrypted-media"
      />
    </div>
  )
}
