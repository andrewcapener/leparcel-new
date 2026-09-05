'use client'

import { useEffect, useState } from 'react'

/**
 * The background video behind the hero, which is what the old site's
 * home page actually does: its background-video section sets
 * video_external to this clip.
 *
 * The still photograph underneath is always rendered and is what shows
 * until the video is ready — and permanently on a narrow screen, where
 * background autoplay is unreliable and expensive, and for anyone who
 * asked for reduced motion. So this only ever adds motion; it never
 * removes the poster.
 */
export function HeroVideo({ youtubeId }: { youtubeId: string }) {
  const [show, setShow] = useState(false)
  const [loaded, setLoaded] = useState(false)

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

  if (!show) return null

  const params = new URLSearchParams({
    autoplay: '1', mute: '1', loop: '1', playlist: youtubeId,
    controls: '0', modestbranding: '1', playsinline: '1',
    rel: '0', disablekb: '1', iv_load_policy: '3',
  })

  return (
    <div className="herovid" aria-hidden="true" data-loaded={loaded ? '1' : undefined}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}?${params}`}
        title=""
        tabIndex={-1}
        allow="autoplay; encrypted-media"
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}
