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
  const [near, setNear] = useState(false)
  const [settled, setSettled] = useState(false)
  const [playing, setPlaying] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const box = useRef<HTMLDivElement>(null)

  /* Both have to be true before a byte of player is fetched: the page itself
     has finished, and this section is near enough to be worth it. */
  const ready = near && settled

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

  /* Wait for the page itself to finish before fetching a megabyte of player.
     The embed costs about 1MB across sixteen requests, and mounting it during
     hydration put all of that in a race with the hero photograph and the
     fonts: the home page took 3.2s to load and 5.1s to go quiet on a phone,
     and the thing people were waiting for was a video they had not asked to
     watch yet. The poster is already on screen the whole time, so nothing is
     missing while this waits. */
  useEffect(() => {
    if (document.readyState === 'complete') {
      const t = setTimeout(() => setSettled(true), 400)
      return () => clearTimeout(t)
    }
    const done = () => setTimeout(() => setSettled(true), 400)
    window.addEventListener('load', done, { once: true })
    return () => window.removeEventListener('load', done)
  }, [])

  /* And only for a section somebody can actually see. The home page carries
     two of these; the second is well below the fold and was pulling its own
     player on every visit for a film nobody had scrolled to. */
  /* Depends on `show`, and that is not incidental. This component renders
     null until the first effect decides motion is wanted, so on mount there
     is no element to observe: with an empty dependency list the observer
     attached to nothing, `near` stayed false, and the video never appeared at
     all. It has to run again once the box is actually in the document. */
  useEffect(() => {
    if (!show || near) return
    const el = box.current
    if (!el) return
    if (typeof IntersectionObserver !== 'function') { setNear(true); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setNear(true); io.disconnect() }
    }, { rootMargin: '250px' })
    io.observe(el)
    return () => io.disconnect()
  }, [show, near])

  useEffect(() => {
    if (!show || !ready || playing) return
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
  }, [show, ready, playing])

  if (!show) return null

  const params = new URLSearchParams({
    autoplay: '1', mute: '1', loop: '1', playlist: youtubeId,
    controls: '0', modestbranding: '1', playsinline: '1',
    rel: '0', disablekb: '1', iv_load_policy: '3', enablejsapi: '1',
  })

  return (
    <div
      ref={box}
      className="video-section__bg-iframe-video"
      aria-hidden="true"
      data-playing={playing ? '1' : undefined}
    >
      {ready && (
        <iframe
          ref={frame}
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?${params}`}
          title=""
          tabIndex={-1}
          allow="autoplay; encrypted-media"
          loading="lazy"
        />
      )}
    </div>
  )
}
