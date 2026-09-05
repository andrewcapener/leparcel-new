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
    </div>
  )
}
