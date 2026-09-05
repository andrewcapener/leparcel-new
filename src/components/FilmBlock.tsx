'use client'

import { useState } from 'react'
import { Photo } from './Photo'
import { film } from '@/lib/content'

/**
 * The film block, restored now that the film exists (docs/09: the
 * highest-fidelity proof there is). A plate with a play affordance;
 * clicking swaps in the embed, so nothing loads or moves until asked.
 */
export function FilmBlock() {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <div className="film">
        <div style={{ position: 'relative', height: 'min(68vh,620px)', background: '#141210' }}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${film.youtubeId}?autoplay=1&rel=0`}
            title={film.label}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="film">
      <Photo src="/photos/film.jpg" alt="" />
      <button
        type="button"
        className="play"
        onClick={() => setPlaying(true)}
        aria-label={`Play: ${film.label}`}
        style={{ background: 'none', border: 0, cursor: 'pointer', width: '100%' }}
      >
        <span className="circ">▶</span>
        <span className="lb">{film.label}</span>
      </button>
    </div>
  )
}
