'use client'

import { useEffect } from 'react'
import Script from 'next/script'

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
 */
export function ThemeBoot() {
  useEffect(() => {
    // The header measures itself: whether the inline nav fits beside the logo,
    // and how tall the bar is. Their page calls these right after the header
    // markup; ours calls them once React owns the DOM.
    const boot = () => {
      const t = (window as unknown as { theme?: Record<string, () => void> }).theme
      if (!t) return false
      t.inlineNavigationCheck?.()
      t.setInitialHeaderHeightProperty?.()
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
      <Script src="/theme/theme-init.js" strategy="afterInteractive" />
      <Script src="/theme/main.js" strategy="afterInteractive" />
      <Script src="/theme/animate-on-scroll.js" strategy="afterInteractive" />
      <Script src="/theme/scrolling-banner.js" strategy="afterInteractive" />
    </>
  )
}
