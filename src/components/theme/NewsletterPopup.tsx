'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { SignupForm } from './SignupForm'
import { img } from '@/lib/theme-img'

/** Their own settings, read off the live page's <pop-up> element:
 *  data-trigger="delay" data-delay="2" data-dismiss-days="15" */
const DELAY_MS = 2000
const DISMISS_DAYS = 15
const KEY = 'mm.popup.dismissedUntil'

/**
 * Their "Stay Hooked" pop-up, in their markup.
 *
 * On mermademarket.com this is a Shopify section driven by pop-up.js and it
 * posts to Shopify's customer endpoint. This is the same window, the same
 * photograph and the same copy, writing to our own subscribers table through
 * the same server action as the footer form.
 *
 * Email capture is the revenue miss ranked #1 in docs/09-CONTENT-AUDIT.md, so
 * this is not decoration. It is also the most annoying pattern on the web if
 * it is done carelessly, hence: once every fifteen days, never while someone
 * is filling in an application, never in the admin, Escape and the backdrop
 * both close it, and focus is moved in and handed back.
 */
export function NewsletterPopup() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const windowRef = useRef<HTMLDivElement>(null)
  const returnTo = useRef<Element | null>(null)

  // Never over the application or the admin. Someone part-way through the
  // thing we want them to do does not need to be asked for their email.
  const suppressed = path.startsWith('/admin') || path.startsWith('/apply')

  const close = useCallback(() => {
    setClosing(true)
    try {
      const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000
      window.localStorage.setItem(KEY, String(until))
    } catch { /* private mode; it reappears next visit, which is acceptable */ }
    window.setTimeout(() => { setOpen(false); setClosing(false) }, 400)
    if (returnTo.current instanceof HTMLElement) returnTo.current.focus()
  }, [])

  useEffect(() => {
    if (suppressed) return
    let until = 0
    try { until = Number(window.localStorage.getItem(KEY) ?? 0) } catch { /* ignore */ }
    if (until > Date.now()) return
    const id = window.setTimeout(() => {
      returnTo.current = document.activeElement
      setOpen(true)
    }, DELAY_MS)
    return () => window.clearTimeout(id)
  }, [suppressed])

  useEffect(() => {
    if (!open) return
    windowRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  if (suppressed || !open) return null

  return (
    <div className="shopify-section shopify-section-group-overlay-group cc-pop-up">
      <div
        className={`modal popup-section fixed top-0 left-0 w-full h-full flex justify-center items-center${closing ? ' is-closing' : ''}`}
        // Their CSS keys the whole open state off this attribute.
        {...{ open: true }}
        onClick={(e) => { if (e.target === e.currentTarget) close() }}
      >
        <div
          ref={windowRef}
          className="modal__window modal__window--no-image-block flex relative text-start has-motion"
          role="dialog"
          aria-labelledby="popup-heading"
          aria-modal="true"
          tabIndex={-1}
        >
          <button type="button" className="modal__close-btn absolute" onClick={close}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className="icon feather feather-x" aria-hidden="true" focusable="false" role="presentation">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            <span className="visually-hidden">Close</span>
          </button>

          <div className="flex-auto modal__content relative text-center">
            <div className="popup-section__background-image img-fill absolute top-0 left-0 h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img('7H3A8680.jpg')}
                alt=""
                width={2500}
                height={3445}
                loading="lazy"
                sizes="(min-width: 768px) 640px, 95vw"
                className="theme-img"
              />
            </div>
            <h2 className="section__block section__block--heading h4" id="popup-heading">
              Stay Hooked
            </h2>
            <div className="section__block rte">
              <p>We send show dates, and important VIP info to our subscribers.</p>
            </div>
            <div className="section__block form-width mx-auto">
              <SignupForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
