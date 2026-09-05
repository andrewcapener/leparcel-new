import React from 'react'
import Link from 'next/link'
import { img } from '@/lib/theme-img'
import { usd } from '@/lib/money'

/**
 * The Symmetry sections mermademarket.com is built from, as React.
 *
 * Every class name, wrapper and inline section <style> here is copied from
 * their rendered pages. The vendored stylesheet in public/theme/ does the
 * styling; these components only produce the DOM it expects. Where their
 * theme emits a scoped block of custom properties (`#section-id-x { … }`)
 * we emit the same block against a caller-supplied id.
 *
 * Their banner headings are sized per section, not by the global scale:
 * 32px on a phone, 58.8px from 768px, 84px from 1100px. That is why
 * `bannerHeadingCss` exists rather than a class in a stylesheet of ours.
 */

/**
 * The block their banners emit: the image height at two breakpoints, and the
 * heading size at three. Their pages set these per section — the home hero
 * runs 32/58.8/84, the FAQ banner 32/36.4/52 — so they are arguments, not a
 * class in a stylesheet of ours.
 */
function bannerCss(
  id: string,
  heightMobile: number,
  heightDesktop: number,
  heading: [number, number, number],
) {
  return `#${id} .height--fixed { --image-height: ${heightMobile}px; }
@media (min-width: 768px) { #${id} .height--fixed { --image-height: ${heightDesktop}px; } }
#${id} .block-heading { --heading-max-width: 15em; font-size: ${heading[0]}px; }
@media (min-width: 768px) { #${id} .block-heading { font-size: ${heading[1]}px; } }
@media (min-width: 1100px) { #${id} .block-heading { font-size: ${heading[2]}px; } }`
}

export type BannerProps = {
  id: string
  image?: string
  subheading?: string
  title: React.ReactNode
  /** The paragraph under the title, in their `text-overlay__rte`. */
  children?: React.ReactNode
  cta?: { href: string; label: string }
  heightMobile?: number
  heightDesktop?: number
  /** Font size at <768, >=768 and >=1100, as their section styles set it. */
  heading?: [number, number, number]
  /** Their `image-overlay--bg-shadow`: a scrim so white text stays readable. */
  shadow?: boolean
  priority?: boolean
}

/**
 * `section-image-with-text-overlay` — the banner at the top of every inner
 * page, and the shape the home hero uses with a video behind it.
 */
export function Banner({
  id, image = '', subheading, title, children, cta,
  heightMobile = 300, heightDesktop = 360, heading = [32, 58.8, 84],
  shadow = true, priority = false,
}: BannerProps) {
  return (
    <div className="shopify-section section-image-with-text-overlay">
      <div id={id}>
        <style dangerouslySetInnerHTML={{ __html: bannerCss(id, heightMobile, heightDesktop, heading) }} />
        <div
          className={`height--fixed image-overlay image-overlay--bg-full${shadow ? ' image-overlay--bg-shadow' : ''}`}
          data-cc-animate=""
        >
          <div className="height__image image-overlay__image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img(image)}
              alt=""
              loading={priority ? 'eager' : 'lazy'}
              sizes="100vw"
              className="theme-img"
              {...(priority ? { fetchPriority: 'high' as const } : {})}
            />
          </div>
          <div className="text-overlay text-overlay--for-banner text-overlay--v-center text-overlay--h-center image-overlay__over">
            <div className="text-overlay__inner">
              <div className="text-overlay__text">
                {subheading && (
                  <div className="text-overlay__subheading subheading subheading--over lightish-spaced-row-above">
                    {subheading}
                  </div>
                )}
                {/* Only when there is something to say. An untitled hero was
                    emitting an empty h1, which reads as a heading with no
                    text to a screen reader and spends the page's one h1 on
                    nothing. */}
                {title && (
                  <h1 className="text-overlay__title h1 block-heading">{title}</h1>
                )}
                {children && (
                  <div className="text-overlay__rte rte lightly-spaced-row large-text">{children}</div>
                )}
                {cta && (
                  <div className="text-overlay__button-row button-row lightish-spaced-row-above">
                    <Link className="text-overlay__button button-row__btn btn btn--secondary" href={cta.href}>
                      {cta.label}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * `section-background-video` — the home hero. Their theme lazy-loads a
 * YouTube player over a poster frame; the poster is always there, so the
 * section is complete without it.
 */
export function VideoBanner({
  id, poster, subheading, title, children, cta,
  heightMobile = 500, heightDesktop = 600, heading = [32, 58.8, 84], video,
}: BannerProps & { poster: string; video?: string }) {
  return (
    <div className="shopify-section section-background-video">
      <div id={id} className=" video-section video-section--background" data-cc-animate="">
        <style dangerouslySetInnerHTML={{ __html: bannerCss(id, heightMobile, heightDesktop, heading) }} />
        <div className="height--fixed image-overlay image-overlay--bg-full">
          <div className="image-overlay__image height__image">
            {video && <BackgroundVideo youtubeId={video} />}
            {poster && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={img(poster)} alt="" sizes="100vw" className="theme-img" />
            )}
          </div>
          <div className="text-overlay text-overlay--for-banner text-overlay--v-center text-overlay--h-center image-overlay__over">
            <div className="text-overlay__inner">
              <div className="text-overlay__text">
                {subheading && (
                  <div className="text-overlay__subheading subheading subheading--over lightish-spaced-row-above">
                    {subheading}
                  </div>
                )}
                {/* Only when there is something to say. An untitled hero was
                    emitting an empty h1, which reads as a heading with no
                    text to a screen reader and spends the page's one h1 on
                    nothing. */}
                {title && (
                  <h1 className="text-overlay__title h1 block-heading">{title}</h1>
                )}
                {children && (
                  <div className="text-overlay__rte rte lightly-spaced-row">{children}</div>
                )}
                {cta && (
                  <div className="text-overlay__button-row button-row lightish-spaced-row-above">
                    <Link className="text-overlay__button button-row__btn btn btn--secondary" href={cta.href}>
                      {cta.label}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { BackgroundVideo } from './BackgroundVideo'

/** A full-bleed video band with no text — their second background-video. */
export function VideoBand({
  id, poster, video, heightMobile = 480, heightDesktop = 580,
}: {
  id: string
  /** Optional, and their own band has none: it is video only. Pass one only
      where the section is a still. */
  poster?: string
  video?: string
  heightMobile?: number
  heightDesktop?: number
}) {
  return (
    <div className="shopify-section section-background-video">
      <div id={id} className=" video-section video-section--background" data-cc-animate="">
        <style dangerouslySetInnerHTML={{
          __html: `#${id} .height--fixed { --image-height: ${heightMobile}px; }
@media (min-width: 768px) { #${id} .height--fixed { --image-height: ${heightDesktop}px; } }`,
        }} />
        <div className="height--fixed image-overlay image-overlay--bg-full image-overlay--bg-shadow">
          <div className="image-overlay__image height__image">
            {video && <BackgroundVideo youtubeId={video} />}
            {poster && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={img(poster)} alt="" sizes="100vw" className="theme-img" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * `section-rich-text` — a centred heading and a paragraph, optionally over an
 * icon and under a button. Their most-used section by a distance.
 */
export function RichText({
  title, children, mark, markWidth = 170, icon, cta, wide = false, scheme = false,
  large = true, primary = false,
}: {
  title?: React.ReactNode
  children: React.ReactNode
  mark?: string
  markWidth?: number
  icon?: React.ReactNode
  cta?: { href: string; label: string }
  /** Their pages drop container--reading-width when the text is a long list. */
  wide?: boolean
  /** Their `use-color-scheme--1` band. */
  scheme?: boolean
  /** Render the title as the page's h1. For a page whose only heading is this
   *  one, which is both lookbooks. */
  primary?: boolean
  /** Their `large-text` class, which most but not all of their blocks carry. */
  large?: boolean
}) {
  return (
    <div className="shopify-section section-rich-text">
      <div
        className={scheme
          ? 'use-color-scheme use-color-scheme--1 fully-padded-row--small'
          : 'fully-spaced-row--medium'}
        data-cc-animate=""
      >
        <div className={`container${wide ? '' : ' container--reading-width'}`}>
          <div className="align-ltr-center spaced-column">
            {icon && (
              <div className="lightly-spaced-row">
                <span className="large-light-icon">{icon}</span>
              </div>
            )}
            {/* `primary` promotes this to the page's h1. The lookbooks have
                no hero, so their only heading was an h2 and the page had no
                h1 at all. The class list is unchanged either way, so the two
                look identical. */}
            {title && (primary
              ? <h1 className="majortitle in-content h1">{title}</h1>
              : <h2 className="majortitle in-content h1">{title}</h2>)}
            <div className={`rte lightly-spaced-row${large ? ' large-text' : ''}`}>{children}</div>
            {mark && (
              <div
                className="lightly-spaced-row lightish-spaced-row-above inline-width-container"
                style={{ width: markWidth }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img(mark)} alt="" loading="lazy" sizes={`${markWidth}px`} className="theme-img" />
              </div>
            )}
            {cta && (
              <div className="lightly-spaced-row button-row">
                <Link className="btn btn--primary button-row__btn" href={cta.href}>{cta.label}</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** `section-map` — text on one side, a photograph on the other. */
export function MapSection({
  id, title, children, directionsTo, image, map,
}: {
  id: string
  title: React.ReactNode
  children: React.ReactNode
  directionsTo: string
  image: string
  /** The third column. Their section is text · feature · map; without it the
      grid still reserves the column and the band ends in a blank third. */
  map: string
}) {
  return (
    <div className="shopify-section section-map">
      <div
        id={id}
        className="map-section use-color-scheme use-color-scheme--1 map-section--has-feature-image"
        data-cc-animate=""
      >
        <div className="container">
          <div className="map-section__wrapper">
            <div className="map-section__content map-section__text">
              <h2>{title}</h2>
              <div className="rte lightly-spaced-row">{children}</div>
              <div>
                <a
                  href={`https://maps.google.com?daddr=${encodeURIComponent(directionsTo)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn--secondary"
                >
                  <span>Directions</span>
                </a>
              </div>
            </div>
            <div className="map-section__content map-section__feature">
              <div className="map-section__feature-image img-fill">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img(image)} alt="" loading="lazy" sizes="50vw" className="theme-img" />
              </div>
            </div>
            <div className="map-section__content map-section__map">
              <div className="map-section__map-image img-fill">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img(map)}
                  alt=""
                  loading="lazy"
                  sizes="(min-width: 1600px) 800px, (min-width: 768px) 50vw, 100vw"
                  className="theme-img"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * `section-scrolling-banner` — their marquee.
 *
 * The outer element is their `<scrolling-banner>` custom element on purpose:
 * their scrolling-banner.js waits for the fonts to load and only then adds
 * `marquee--animate`, and until it does their CSS keeps the marquee at
 * `opacity: 0`. A plain div renders an invisible band.
 */
export type MarqueeImage = { file: string; width: number }

export function ScrollingBanner({
  id, text, images, copies = 14, duration = '21s', space = '50px', textSize = '40px',
  padding = 40, headingFont = true,
}: {
  id: string
  text?: string
  /** Their sponsor strip is the same section carrying logos instead of words. */
  images?: MarqueeImage[]
  copies?: number
  duration?: string
  space?: string
  textSize?: string
  padding?: number
  headingFont?: boolean
}) {
  const content = images
    ? images.map((im) => (
        <span className="marquee-item marquee-image" key={im.file} style={{ '--width': `${im.width}px` } as React.CSSProperties}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img(im.file)} alt="" loading="lazy" sizes={`${im.width}px`} className="theme-img" />
        </span>
      ))
    : <span className="marquee-item marquee-text">{text}</span>

  return (
    <div className="shopify-section section-scrolling-banner">
      {React.createElement(
        'scrolling-banner',
        { id, className: 'block', 'data-cc-animate': '' },
        <style key="s" dangerouslySetInnerHTML={{ __html: `#${id} { --vertical-padding: ${padding}px; }` }} />,
        <div className="marquee-container" key="m">
          <div
            className={`marquee marquee--left${headingFont ? ' heading-font' : ''}`}
            style={{ '--duration': duration, '--space': space, '--text-size': textSize } as React.CSSProperties}
            role="marquee"
          >
            {Array.from({ length: copies }).map((_, i) => (
              <span className="marquee-content" key={i} {...(i > 0 ? { 'aria-hidden': true } : {})}>
                {content}
              </span>
            ))}
          </div>
        </div>,
      )}
    </div>
  )
}

export type ArticleCard = {
  href: string
  title: string
  excerpt: string
  image: string | null
}

/** `section-featured-blog` — the three-up article row. */
export function ArticleRow({
  heading, headingHref, articles,
}: {
  heading: string; headingHref?: string; articles: ArticleCard[]
}) {
  return (
    <div className="shopify-section section-featured-blog">
      <div className="fully-spaced-row--medium">
        <div className="container blog-row">
          <h2 className="hometitle h4 align-center">
            {headingHref ? <Link href={headingHref}>{heading}</Link> : heading}
          </h2>
          <div className="article-list article-layout--columns article-layout--one-row">
            {articles.map((a, i) => (
              <div className="article" key={a.href} data-cc-animate="" data-cc-animate-delay={`${0.15 * (i + 1)}s`}>
                <div className="article__inner">
                  {a.image && (
                    <div className="article-image">
                      <Link href={a.href}>
                        <div className="img-ar img-ar--cover" style={{ '--aspect-ratio': 1.78 } as React.CSSProperties}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={a.image}
                            alt={a.title}
                            loading="lazy"
                            sizes="(min-width: 1024px) 440px, (min-width: 768px) 50vw, 100vw"
                            className="theme-img"
                          />
                        </div>
                      </Link>
                    </div>
                  )}
                  <h3><Link href={a.href}>{a.title}</Link></h3>
                  <div className="rte">{a.excerpt}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Their page body wrapper: `page-section-spacing` + a container. */
export function PageSection({
  children, reading = false, className = '',
}: {
  children: React.ReactNode; reading?: boolean; className?: string
}) {
  return (
    <div className={`shopify-section page-section-spacing ${className}`.trim()}>
      <div className={`container${reading ? ' container--reading-width' : ''}`}>
        {children}
      </div>
    </div>
  )
}

/** Their rich-text block, for page prose. */
export function Rte({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rte ${className}`.trim()}>{children}</div>
}

/** `section-faq-header` — an empty block their FAQ page carries above the tabs. */
export function FaqHeader() {
  return (
    <div className="shopify-section section-faq-header">
      <div className="container" data-cc-animate="">
        <div className="faq-header block">
          <div className="faq-header__content" />
        </div>
      </div>
    </div>
  )
}

export type Tab = {
  q: string
  a: React.ReactNode
  /** Fragment a link can point at, e.g. `/makers/indoor#labels`. */
  id?: string
  /** Open on load. The rules pages open their first section and no others. */
  open?: boolean
}

/**
 * `section-collapsible-tabs` — their accordion. Native <details>, so it opens
 * and closes with no JavaScript; their `details-disclosure` element only adds
 * the slide animation.
 */
/**
 * Opens the section a link points at. Chrome and Firefox now expand a closed
 * <details> when a fragment lands inside it and Safari does not, so a link to
 * /makers/indoor#labels would scroll to a shut section on some browsers. Six
 * lines of progressive enhancement: with no JavaScript the link still scrolls
 * to the right heading, which is the behaviour without this.
 */
const OPEN_TARGET = `(function(){function o(){var h=location.hash.slice(1);if(!h)return;var e=document.getElementById(h);if(!e)return;var d=e.querySelector('details');if(d&&!d.open){d.open=true;e.scrollIntoView();}}o();addEventListener('hashchange',o);})();`

export function CollapsibleTabs({
  heading, id, tabs, intro, deepLink = false,
}: {
  heading?: string; id?: string; tabs: Tab[]
  /** A block between the heading and the first tab. The rules pages put the
   *  short list of rules that cost money there. */
  intro?: React.ReactNode
  /** Open the section a `#fragment` names. Only the pages whose tabs carry
   *  `id`s need it. */
  deepLink?: boolean
}) {
  return (
    <div className="shopify-section section-collapsible-tabs">
      <div className="container" data-cc-animate="">
        <div className="collapsible-tabs">
          {heading && (
            <h2 className="collapsible-tabs__heading collapsible-tabs__content" id={id}>{heading}</h2>
          )}
          {intro}
          {tabs.map((t) => (
            <div className="collapsible-tabs__block" key={t.q} id={t.id}>
              <div className="collapsible-tabs__tab">
                <details className="disclosure" open={t.open}>
                  <summary className="disclosure__title">{t.q}</summary>
                  <div className="disclosure__panel has-motion">
                    <div className="disclosure__content rte">{t.a}</div>
                  </div>
                </details>
              </div>
            </div>
          ))}
        </div>
        {deepLink && <script dangerouslySetInnerHTML={{ __html: OPEN_TARGET }} />}
      </div>
    </div>
  )
}

/**
 * `section-multi-column` — a row of text columns. Their price lists, their
 * sponsor tiers and their merchant grids are all this section.
 */
export function MultiColumn({
  id, columns, align = 'left', imageMaxWidth = 700, scheme = false, titles,
}: {
  id: string
  columns: React.ReactNode[]
  align?: 'left' | 'center'
  imageMaxWidth?: number
  /** Their `use-color-scheme--1` band: the pale green behind the tiers. */
  scheme?: boolean
  /** An `h3.text-column__title` above each column. */
  titles?: string[]
}) {
  return (
    <div className="shopify-section section-multi-column">
      <div
        id={id}
        className={scheme
          ? 'use-color-scheme use-color-scheme--1 fully-padded-row--medium'
          : 'fully-spaced-row--medium'}
      >
        <style dangerouslySetInnerHTML={{
          __html: `#${id} .text-column__image { max-width: ${imageMaxWidth}px; }`,
        }} />
        <div className="container">
          <div className={`flexible-layout flexible-layout--variable-columns align-ltr-${align}`}>
            {columns.map((c, i) => (
              <div className="column text-column fade-in-up" key={i} data-cc-animate="" data-cc-animate-delay={`${0.15 * (i + 1)}s`}>
                {titles?.[i] && <h3 className="text-column__title">{titles[i]}</h3>}
                {c && <div className="text-column__text rte">{c}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * `section-image-with-text` — a photograph beside a heading and a paragraph.
 * `flip` is their `column--order-push-desktop`, which puts the image on the
 * right; they alternate it down the lookbook pages.
 */
export function ImageWithText({
  image, title, children, flip = false, imageMaxWidth = 700,
}: {
  image: string
  title: React.ReactNode
  children: React.ReactNode
  flip?: boolean
  imageMaxWidth?: number
}) {
  return (
    <div className="shopify-section section-image-with-text">
      <div className="fully-spaced-row--medium">
        <div className="container">
          <div className="flexible-layout valign-middle">
            <div className={`column column--half${flip ? ' column--order-push-desktop' : ''}`}>
              <div className="image-overlap" style={{ maxWidth: imageMaxWidth }}>
                <div className="image-overlap__image image-overlap__image-1">
                  <div className="fade-in-up" data-cc-animate="" data-cc-animate-delay="0.1s">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img(image)}
                      alt=""
                      loading="lazy"
                      sizes="(min-width: 1600px) 800px, (min-width: 768px) 50vw, 100vw"
                      className="theme-img"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="column column--half align-ltr-left" data-cc-animate="">
              <div className="feature-text-paired">
                <h2 className="majortitle in-content h1">{title}</h2>
                <div className="rte lightly-spaced-row">{children}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Their page template's own title block. */
export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="shopify-section page-section-spacing">
      <div className="container container--reading-width" data-cc-animate="">
        <div className="page-header">
          <h1 className="majortitle">{title}</h1>
        </div>
        <div className="rte cf">{children}</div>
      </div>
    </div>
  )
}

/**
 * A rich-text section that carries several headed blocks, the way their
 * schedule page stacks a day at a time inside one section.
 */
export function RichTextBlocks({
  blocks, wide = false,
}: {
  blocks: Array<{ title?: React.ReactNode; body: React.ReactNode }>
  wide?: boolean
}) {
  return (
    <div className="shopify-section section-rich-text">
      <div className="fully-spaced-row--medium">
        <div className={`container${wide ? '' : ' container--reading-width'}`}>
          <div className="align-ltr-center spaced-column">
            {blocks.map((b, i) => (
              <React.Fragment key={i}>
                {b.title && <h2 className="majortitle in-content h1">{b.title}</h2>}
                <div className="rte lightly-spaced-row large-text">{b.body}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Their `section-rich-text` carrying only a subheading, used as a divider. */
export function SubheadingSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="shopify-section section-rich-text">
      <div className="fully-spaced-row--medium">
        <div className="container container--reading-width">
          <div className="align-ltr-center spaced-column">
            <div className="subheading subheading--over lightish-spaced-row-above">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export type LogoCard = { name: string; href?: string | null; image?: string | null }

/**
 * `section-multi-column` with an image block per column — their merchant
 * grids. A shop with no logo yet renders as the name alone rather than a
 * broken frame.
 */
export function LogoGrid({ id, cards }: { id: string; cards: LogoCard[] }) {
  return (
    <div className="shopify-section section-multi-column">
      <div id={id} className="fully-spaced-row--medium">
        <style dangerouslySetInnerHTML={{
          __html: `#${id} .text-column__image { max-width: 700px; }`,
        }} />
        <div className="container">
          <div className="flexible-layout flexible-layout--variable-columns align-ltr-center">
            {cards.map((c) => (
              <div className="column text-column fade-in-up" key={c.name} data-cc-animate="">
                {c.image && (
                  <div className="text-column__image lightly-spaced-row">
                    <Wrap href={c.href}>
                      <div className="img-ar img-ar--cover" style={{ '--aspect-ratio': 1 } as React.CSSProperties}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.image}
                          alt=""
                          loading="lazy"
                          sizes="(min-width: 1600px) 533px, (min-width: 768px) 33vw, 100vw"
                          className="theme-img"
                        />
                      </div>
                    </Wrap>
                  </div>
                )}
                <h3 className="text-column__title">
                  <Wrap href={c.href}>{c.name}</Wrap>
                </h3>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Wrap({ href, children }: { href?: string | null; children: React.ReactNode }) {
  if (!href) return <>{children}</>
  const external = /^https?:/i.test(href)
  return external
    ? <a href={href} target="_blank" rel="noreferrer">{children}</a>
    : <Link href={href}>{children}</Link>
}

export type FactRow = { label: string; value: React.ReactNode }

/**
 * The facts a maker needs before reading two thousand words of rules.
 *
 * An audit timed the top six questions against /makers/indoor and found two
 * answerable: the commission rate appeared nowhere on the page at all, and
 * "we pay within 1 week" was a clause in the middle of the opening paragraph.
 * This puts them in one block above the prose, as a definition list — the
 * shape the content actually is — with the money in tabular numerals so the
 * figures line up.
 *
 * The rules below it are unchanged. This is a summary, not a replacement.
 */
export function FactTable({
  id, title, rows, cta,
}: {
  id?: string
  title?: string
  rows: FactRow[]
  /** `external` renders a plain anchor, for routes that are a download. */
  cta?: { href: string; label: string; external?: boolean }
}) {
  return (
    <div className="shopify-section section-rich-text" id={id}>
      <div className="fully-spaced-row--medium" data-cc-animate="">
        <div className="container container--reading-width">
          {title && <div className="subheading subheading--over lightish-spaced-row-above">{title}</div>}
          <dl className="fact-table">
            {rows.map((r) => (
              <div className="fact-table__row" key={r.label}>
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
          {cta && (
            <div className="lightly-spaced-row button-row">
              {cta.external
                ? <a className="btn btn--primary button-row__btn" href={cta.href}>{cta.label}</a>
                : <Link className="btn btn--primary button-row__btn" href={cta.href}>{cta.label}</Link>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * One price list, used by /apply and both maker rules pages, replacing three
 * divergent renderings of the same eight spaces. A real table, because the
 * theme already styles `th` and `td` properly and has never used it.
 */
export function PriceTable({
  spaces, extras, caption,
}: {
  spaces: Array<{ id: string; label: string; description: string; priceCents: number }>
  extras?: Array<{ id: string; name: string; description: string; priceCents: number; isLimited: boolean }>
  caption?: string
}) {
  return (
    <div className="rte price-table">
      <table>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr><th scope="col">Space</th><th scope="col">What it suits</th><th scope="col" className="num">Price</th></tr>
        </thead>
        <tbody>
          {spaces.map((s) => (
            <tr key={s.id}>
              <th scope="row">{s.label}</th>
              <td>{s.description}</td>
              <td className="num">{usd(s.priceCents)}</td>
            </tr>
          ))}
        </tbody>
        {extras && extras.length > 0 && (
          <tbody>
            <tr><th scope="row" colSpan={3} className="price-table__group">Add-ons</th></tr>
            {extras.map((a) => (
              <tr key={a.id}>
                <th scope="row">{a.name}</th>
                <td>{a.description}{a.isLimited ? ' (limited)' : ''}</td>
                <td className="num">{usd(a.priceCents)}</td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  )
}

/**
 * `section-multi-column` as stat tiles. A stat has exactly two levels and the
 * whole point is the contrast between them; their page ran "6K REPEAT SHOW
 * ATTENDEES" as one uniform 27px string, which throws away the only
 * typographic move the component has.
 */
export function StatRow({ id, stats }: { id: string; stats: Array<{ value: string; label: string }> }) {
  return (
    <div className="shopify-section section-multi-column">
      <div id={id} className="fully-spaced-row--medium">
        <div className="container">
          <div className="flexible-layout flexible-layout--variable-columns align-ltr-center">
            {stats.map((s, i) => (
              <div className="column text-column fade-in-up stat" key={s.label}
                data-cc-animate="" data-cc-animate-delay={`${0.15 * (i + 1)}s`}>
                <div className="stat__value">{s.value}</div>
                <div className="stat__label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
