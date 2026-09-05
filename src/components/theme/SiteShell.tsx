import type { Show } from '@/db/schema'
import { AnnouncementBar, PageHeader, PageFooter } from './Chrome'

/**
 * The page shell: announcement bar, header, <main>, footer — and, crucially,
 * the template class.
 *
 * Symmetry keys a lot of layout off the template class Shopify puts on
 * <body>: `template-index`, `template-page template-suffix-<handle>`,
 * `template-article`, `template-blog`. The rule that matters most is
 *
 *   .template-index #content > .container,
 *   .template-page  #content > .container, … {
 *     max-width: none; margin: 0; padding-left: 0; padding-right: 0 }
 *
 * which is what makes their sections full-bleed. Without it every section is
 * inset by the container gutter and pushed down by --section-padding (50px),
 * which on the home page opened a white gap between the header and the hero
 * and left the transparent header's white nav sitting on white.
 *
 * The selectors are descendant selectors, so the class works on any ancestor
 * of #content. It lives here rather than on <body> because in the App Router
 * only the root layout renders <body>, and this varies per page.
 */
export function SiteShell({
  show, template, children, transparentHeader = false,
}: {
  show: Show
  /** e.g. 'index', 'page template-suffix-faq', 'article', 'blog' */
  template: string
  children: React.ReactNode
  transparentHeader?: boolean
}) {
  return (
    <div className={`template-${template}`}>
      {/* Theirs, and the first focusable thing on the page: a keyboard user
          should not have to tab the whole header to reach the content. */}
      <a className="skip-link visually-hidden" href="#content">Skip to content</a>
      <AnnouncementBar show={show} />
      <PageHeader transparent={transparentHeader} />
      <main id="content" role="main">
        <div className="container cf">{children}</div>
      </main>
      <PageFooter show={show} />
      {/* Their drawer scrim. It has to sit here, at page level, rather than
          inside the header: it is `position: fixed` with `height: 100%`, and
          the header carries a transform, which would make the header its
          containing block and clip it to the height of the bar. Two rules
          depend on that placement —

            .reveal-mobile-nav .page-shade { height:100%; opacity:1;
                                             pointer-events:auto }

          dims the page while the drawer is open, and main.js binds a click on
          it to close the drawer. The header's own `.header-shade` cannot do
          this job: a transparent header zeroes its opacity, which is why the
          scrim appeared everywhere except the home page.

          It carries `mobile-nav-toggle` as well, which theirs does not.
          main.js binds the scrim's own close by reference, once, inside the
          DOMContentLoaded block; a client-side navigation can remount this
          node and leave the new one unbound. The toggle handler is delegated
          on document, so it survives. The two are idempotent — both end with
          the drawer closed. The scrim is `pointer-events: none` unless the
          drawer is open, so it is inert the rest of the time. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div className="page-shade mobile-nav-toggle" aria-hidden="true" />
    </div>
  )
}
