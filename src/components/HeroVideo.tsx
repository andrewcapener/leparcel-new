'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The background video behind the hero, which is what the live site's home
 * page does: its background-video section sets video_external to this clip.
 *
 * The still photograph underneath is always rendered and is what shows until
 * the video is ready — and permanently on a narrow screen, where background
 * autoplay is unreliable and expensive, and for anyone who asked for reduced
 * motion. So this only ever adds motion; it never removes the poster.
 *
 * The frame is revealed only once the YouTube player answers us, not merely
 * when the iframe fires `load`. A blocked embed (a corporate network, a
 * content blocker, this container) still fires `load` for its error page, and
 * revealing that would put a grey box over the hero for the people least able
 * to do anything about it.
 */
export function HeroVideo({ youtubeId }: { youtubeId: string }) {
  const [show, setShow] = useState(false)
  const [playing, setPlaying] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 900px)')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    const decide = () => setShow(wide.matches && !still.matches)
    decide()
    wide.addEventListener('change', decide)
    still.addEventListener('change', decide)
    return () => {
      wide.removeEventListener('change', decide)
      still.removeEventListener('change', decide)
    }
  }, [])

  // Handshake with the player. We poll until it answers or we give up, and
  // "no answer" simply means the poster stays, which is a fine outcome.
  useEffect(() => {
    if (!show || playing) return
    const onMessage = (e: MessageEvent) => {
      if (/(^|\.)youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) setPlaying(true)
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
    <div className="herovid" aria-hidden="true" data-loaded={playing ? '1' : undefined}>
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
