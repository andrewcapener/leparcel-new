'use client'

import { useEffect, useRef } from 'react'
import Script from 'next/script'

/** The theme scripts, in the order they depend on each other. */
const SCRIPTS = [
  '/theme/theme-init.js',
  '/theme/main.js',
  '/theme/animate-on-scroll.js',
  '/theme/scrolling-banner.js',
] as const

/**
 * Symmetry's scripts, started after React has hydrated.
 *
 * This ordering is not a preference, it is a correctness fix. Their theme
 * mutates the DOM as it parses: theme-init swaps `no-js` for `js` on <html>,
 * inlineNavigationCheck adds `pageheader--layout-inline-permitted`, and
 * main.js upgrades <page-header> and friends and hangs classes off them. All
 * of that lands on nodes React rendered on the server. If it happens before
 * hydration, React sees markup it did not produce, throws a hydration error
 * and re-renders the whole tree from scratch — which wipes every class the
 * theme just set. The symptom was a header stuck with dark nav on a
 * transparent hero and a nav that never measured itself.
 *
 * next/script's afterInteractive strategy runs these once hydration is done,
 * so their mutations are the last word instead of a race. React does not diff
 * the DOM again after hydration, so it leaves them alone.
 *
 * Load order matters: theme-init defines window.theme, which main.js reads;
 * scrolling-banner.js needs main.js's initLazyScript.
 *
 * The catch, and the reason for the replay below: main.js and
 * animate-on-scroll.js each put a large chunk of their setup inside a
 * `DOMContentLoaded` listener. On their site the scripts are in the document,
 * so that event is still ahead of them. Ours load after hydration, which is
 * long after DOMContentLoaded has fired, so those listeners were registered
 * for an event that was never coming again and the block simply never ran.
 * What it wires: the mobile nav toggle and `theme.openMobileNav`, the
 * page-shade click that closes the drawer, the `tab-used` keyboard check, and
 * smooth scrolling for in-page anchors. The hamburger did nothing on every
 * page because of it.
 *
 * So once all four have loaded we re-dispatch the event. Nothing else on the
 * page listens for it — React hydrates on its own schedule and Next does not
 * use it — so the only handlers that run are the theme's own, which is
 * exactly the state their page reaches at the same point in its own load.
 */
export function ThemeBoot() {
  const loaded = useRef(0)
  const replayed = useRef(false)

  /** Fire once every script has had its chance to register a listener. */
  const onLoad = () => {
    loaded.current += 1
    if (loaded.current < SCRIPTS.length || replayed.current) return
    replayed.current = true
    // Only where the theme's own markup is. /admin renders none of it, and
    // main.js's setup assumes it is there.
    if (!document.querySelector('page-header')) return
    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true, cancelable: false }))
  }

  useEffect(() => {
    // The header measures itself: whether the inline nav fits beside the logo,
    // and how tall the bar is. Their page calls these right after the header
    // markup; ours calls them once React owns the DOM.
    // Both of these read the header out of the DOM and neither tolerates its
    // absence: inlineNavigationCheck does `.section-header`.querySelector(…)
    // and throws outright. /admin is inside the root layout, so this
    // component mounts there too, with none of the theme's markup under it.
    // The poll below then retried the throw every 50ms for five seconds, a
    // hundred uncaught TypeErrors deep, on every admin page load.
    if (!document.querySelector('page-header')) return

    const boot = () => {
      const t = (window as unknown as { theme?: Record<string, () => void> }).theme
      if (!t) return false
      try {
        t.inlineNavigationCheck?.()
        t.setInitialHeaderHeightProperty?.()
      } catch {
        // Theme measurement is not worth taking the page down for, and a
        // throw here means retrying will throw identically.
      }
      return true
    }
    if (boot()) return
    // theme-init.js may not have run yet; poll briefly rather than guess.
    const id = setInterval(() => { if (boot()) clearInterval(id) }, 50)
    const stop = setTimeout(() => clearInterval(id), 5000)
    return () => { clearInterval(id); clearTimeout(stop) }
  }, [])

  return (
    <>
      {SCRIPTS.map((src) => (
        <Script key={src} src={src} strategy="afterInteractive" onLoad={onLoad} onError={onLoad} />
      ))}
    </>
  )
}
