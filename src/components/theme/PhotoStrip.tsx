'use client'

import { useEffect, useRef } from 'react'

/**
 * A filmstrip of the show, running slowly across the page, and swipeable.
 *
 * It replaces the second background-video band, which was the last piece of
 * the old Shopify site on this page and was full of a venue Mermade no longer
 * uses.
 *
 * A slider was the obvious answer and is the wrong one. An auto-advancing
 * carousel shows one photograph at a time, needs arrows and dots and a pause
 * control, and most people never see the second slide. The argument this band
 * has to make is quantity: a hundred makers, three days, more than you can
 * take in. Quantity is made of things going past.
 *
 * **Why the motion is JavaScript and not a CSS animation.** It used to be
 * `animation: translate3d(-50%)`, which cannot be swiped: a transform moves
 * the pixels without moving any scroll position, so a finger on it does
 * nothing. Drew, on a phone: "would be nice on mobile if you could swipe
 * through it." Driving `scrollLeft` instead means the auto-motion and the
 * finger are the SAME mechanism rather than two that fight, so it can be
 * pushed, flicked, trackpadded or tabbed through, and it picks itself back up
 * afterwards.
 *
 * Two copies of the list is what makes it endless: the moment the first copy
 * has fully left, scrollLeft is put back by exactly half the track and the
 * second copy is where the first began. Nobody can see the join. The second
 * copy is aria-hidden, so a screen reader hears the photographs once.
 *
 * It stops when it is not being watched (tab hidden), while a finger is on it,
 * for a few seconds after anybody moves it, and entirely for somebody who
 * asked for less motion. Every one of those still leaves a strip you can push
 * yourself, which is the point: the animation is a suggestion, not the only
 * way in.
 */

type Frame = { file: string; alt: string }

/** Pixels a second. Matches the old 64s-per-half-track CSS animation. */
const SPEED = 45
/** How long the strip stays still after somebody moves it themselves. */
const RESUME_AFTER = 2500

export function PhotoStrip({ id, frames }: { id: string; frames: readonly Frame[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    let raf = 0
    let last = 0
    let heldUntil = 0
    let down = false

    /** Half the track: one full copy of the list. */
    const half = () => el.scrollWidth / 2

    /* Wrap in both directions, so a hard flick backwards past zero lands in
       the middle rather than against a wall. */
    const wrap = () => {
      const h = half()
      if (h <= 0) return
      if (el.scrollLeft >= h) el.scrollLeft -= h
      else if (el.scrollLeft <= 0) el.scrollLeft += h
    }

    const tick = (now: number) => {
      const dt = last ? Math.min(now - last, 100) : 0   // a backgrounded tab
      last = now                                        // must not lurch
      if (!down && now >= heldUntil && !still.matches && !document.hidden) {
        el.scrollLeft += (SPEED * dt) / 1000
        wrap()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const hold = () => { heldUntil = performance.now() + RESUME_AFTER }
    const press = () => { down = true; hold() }
    const release = () => { down = false; hold() }

    el.addEventListener('pointerdown', press, { passive: true })
    el.addEventListener('pointerup', release, { passive: true })
    el.addEventListener('pointercancel', release, { passive: true })
    el.addEventListener('wheel', hold, { passive: true })
    el.addEventListener('touchstart', press, { passive: true })
    el.addEventListener('touchend', release, { passive: true })
    /* Keyboard and a scrollbar drag both surface as scroll and nothing else,
       so the wrap has to run there too or a tabbed strip walks off the end. */
    el.addEventListener('scroll', wrap, { passive: true })
    /* A pointer resting on it on a desktop means somebody is looking at one
       photograph. Let them. */
    el.addEventListener('pointerenter', hold, { passive: true })
    el.addEventListener('pointermove', hold, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerdown', press)
      el.removeEventListener('pointerup', release)
      el.removeEventListener('pointercancel', release)
      el.removeEventListener('wheel', hold)
      el.removeEventListener('touchstart', press)
      el.removeEventListener('touchend', release)
      el.removeEventListener('scroll', wrap)
      el.removeEventListener('pointerenter', hold)
      el.removeEventListener('pointermove', hold)
    }
  }, [])

  if (frames.length === 0) return null

  const run = (hidden: boolean) => (
    <div className="mm-strip__run" aria-hidden={hidden || undefined}>
      {frames.map((f, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${hidden ? 'b' : 'a'}-${f.file}`}
          className="mm-strip__frame"
          src={`/photos/strip/${f.file}`}
          alt={hidden ? '' : f.alt}
          /* The first two of the real run load eagerly, so the band is never
             empty while a browser makes its mind up about the rest. */
          loading={!hidden && i < 2 ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
        />
      ))}
    </div>
  )

  return (
    <div className="shopify-section section-photo-strip">
      {/* A scroll container, so a finger and the animation move the same
          thing. Labelled and focusable because that is what makes it
          reachable from a keyboard: a scrollable region with no name is
          announced as nothing. */}
      <div
        className="mm-strip"
        id={id}
        ref={ref}
        tabIndex={0}
        role="region"
        aria-label="Photographs from the last show"
      >
        <div className="mm-strip__track">
          {run(false)}
          {run(true)}
        </div>
      </div>
    </div>
  )
}
