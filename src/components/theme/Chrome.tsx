import React from 'react'
import Link from 'next/link'
import type { Show } from '@/db/schema'
import { fmtRange } from '@/lib/dates'
import { img } from '@/lib/theme-img'

/**
 * The site chrome, in mermademarket.com's own markup.
 *
 * Class names, element order and the per-section <style> blocks are theirs,
 * copied from the live pages so the vendored Symmetry stylesheet in
 * public/theme/ styles them exactly as it styles the live site. What changed:
 *
 *  - the shop nav points at our routes, not /pages/*;
 *  - the account and cart links are gone, because there is no store;
 *  - the date in the announcement bar and the venue in the footer read off
 *    the Show record (CLAUDE.md rule 6) instead of being typed in.
 *
 * Anything that looks arbitrary here — the id on a section, an empty div, a
 * class that appears to do nothing — is load-bearing for their CSS. Don't
 * tidy it without checking the rendered page.
 */

const ANNOUNCEMENT_CSS = `#section-id-announcement-bar {
  --bg-color: #bc9658;
  --heading-color: 255 255 255;
  --text-color: 255 255 255;
  --link-color: 255 255 255;
  --announcement-font-size: 14px;
}`

/** Their header section style: sticky, transparent over the first section. */
const HEADER_CSS = `.logo img { width: 150px; }
.logo-area__middle--logo-image { max-width: 150px; }
@media (max-width: 767.98px) { .logo img { width: 100px; } }
.section-header { position: -webkit-sticky; position: sticky; }
.section-header {
  margin-bottom: calc(var(--theme-header-height) * -1);
  --transparent-header-text-color: #ffffff;
}
.section-store-messages { display: none; }
#content .shopify-section:first-child .text-overlay { padding-top: var(--theme-header-height); }`

/** Their header again, minus the transparency, for pages with no hero. */
const HEADER_CSS_SOLID = `.logo img { width: 150px; }
.logo-area__middle--logo-image { max-width: 150px; }
@media (max-width: 767.98px) { .logo img { width: 100px; } }
.section-header { position: -webkit-sticky; position: sticky; }
.section-store-messages { display: none; }`

const NAV = [
  { href: '/faq', label: 'FAQ', featured: false },
  { href: '/merchants', label: 'MERCHANTS', featured: false },
  { href: '/schedule', label: 'SCHEDULE', featured: true },
]

function Nav({ id }: { id?: string }) {
  return (
    <div
      {...(id ? { id } : {})}
      className={id ? 'navigation navigation--left' : 'navigation navigation--main'}
      role="navigation"
      aria-label="Primary"
    >
      <div className="navigation__tier-1-container">
        <ul className="navigation__tier-1">
          {NAV.map((n) => (
            <li className={`navigation__item${n.featured ? ' featured-link' : ''}`} key={n.href}>
              <Link href={n.href} className="navigation__link">{n.label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function AnnouncementBar({ show }: { show: Show }) {
  return (
    <div className="shopify-section shopify-section-group-header-group section-announcement-bar">
      <div
        id="section-id-announcement-bar"
        className="announcement-bar announcement-bar--with-announcement"
        data-cc-animate=""
      >
        <style dangerouslySetInnerHTML={{ __html: ANNOUNCEMENT_CSS }} />
        <div className="container container--no-max">
          <div className="announcement-bar__left desktop-only" />
          <div className="announcement-bar__middle">
            <div className="announcement-bar__announcements">
              <div className="announcement">
                <div className="announcement__text">
                  Next Show! {fmtRange(show.startsOn, show.endsOn)} Dana Point {show.venueName}
                </div>
              </div>
            </div>
          </div>
          <div className="announcement-bar__right desktop-only" />
        </div>
      </div>
    </div>
  )
}

/**
 * `transparent` is their pageheader--transparent modifier: the header sits
 * over the first section in white instead of on its own white band. Their
 * home page uses it because the hero is a full-bleed video; their inner pages
 * do not.
 */
export function PageHeader({ transparent = false }: { transparent?: boolean }) {
  return (
    <div className="shopify-section shopify-section-group-header-group section-header">
      <style dangerouslySetInnerHTML={{ __html: transparent ? HEADER_CSS : HEADER_CSS_SOLID }} />
      <div
        id="pageheader"
        className={
          'pageheader pageheader--layout-inline-menu-left pageheader--sticky'
          + (transparent ? ' pageheader--transparent-permitted pageheader--transparent' : '')
        }
      >
        <div className="logo-area container container--no-max">
          <div className="logo-area__left">
            <div className="logo-area__left__inner">
              {/* Their hamburger. main.js wires it to the drawer through
                  aria-controls; without the button there is no nav on a
                  phone at all. */}
              <button className="mobile-nav-toggle" aria-label="Menu" aria-controls="main-nav">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" role="presentation">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <Nav id="proxy-nav" />
            </div>
          </div>
          <div className="logo-area__middle logo-area__middle--logo-image">
            <div className="logo-area__middle__inner">
              <div className="logo">
                <h1 className="logo__h1">
                  <Link className="logo__link" href="/" title="Mermade Market">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="logo__image"
                      src={img('Mermade-Market-Icon.png')}
                      alt="Mermade Market"
                      width={150}
                      height={150}
                    />
                    {/* The transparent header swaps to the white mark. Their
                        theme does this with a second <img>; so do we. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="logo__image logo__image-transparent"
                      src={img('Mermade-Market-Icon-white1-01.png')}
                      alt=""
                      width={150}
                      height={150}
                      aria-hidden="true"
                    />
                  </Link>
                </h1>
              </div>
            </div>
          </div>
          <div className="logo-area__right">
            <div className="logo-area__right__inner">
              <Link href="/apply" className="btn btn--primary header-apply-link">Apply</Link>
            </div>
          </div>
        </div>
      </div>
      {React.createElement(
        'main-navigation',
        { id: 'main-nav', className: 'desktop-only', 'data-proxy-nav': 'proxy-nav' },
        <Nav key="n" />,
        /* main.js clones this template to build the phone drawer, so without
           it theme.openMobileNav throws and the hamburger does nothing. */
        <script
          key="t"
          className="mobile-navigation-drawer-template"
          type="text/template"
          dangerouslySetInnerHTML={{ __html: DRAWER_TEMPLATE }}
        />,
      )}
      {/* The scrim behind the open drawer, and a second way to close it. */}
      {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
      <a href="#" className="header-shade mobile-nav-toggle" aria-label="Close" />
      {/* Their theme measures the header the moment it is in the DOM: whether
          the inline nav fits beside the logo, and how tall the bar is, which
          is what the transparent header offsets the first section by. Both
          calls have to run after this markup, exactly as they do on the live
          page. */}
      <script dangerouslySetInnerHTML={{ __html: HEADER_BOOT }} />
    </div>
  )
}

const DRAWER_TEMPLATE = `
<div class="mobile-navigation-drawer" data-mobile-expand-with-entire-link="true">
  <div class="navigation navigation--main" role="navigation" aria-label="Primary">
    <div class="navigation__tier-1-container">
      <div class="navigation__mobile-header">
        <a href="#" class="mobile-nav-back has-ltr-icon" aria-label="Back"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" class="icon feather feather-chevron-left" aria-hidden="true" focusable="false" role="presentation"><path d="m15 18-6-6 6-6"/></svg></a>
        <span class="mobile-nav-title"></span>
        <a href="#" class="mobile-nav-toggle" aria-label="Close"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" class="icon feather feather-x" aria-hidden="true" focusable="false" role="presentation"><path d="M18 6 6 18M6 6l12 12"/></svg></a>
      </div>
      <ul class="navigation__tier-1">
${NAV.map((n) => `        <li class="navigation__item${n.featured ? ' featured-link' : ''}"><a href="${n.href}" class="navigation__link">${n.label}</a></li>`).join('\n')}
        <li class="navigation__item"><a href="/apply" class="navigation__link">APPLY</a></li>
      </ul>
    </div>
  </div>
  <div class="mobile-navigation-drawer__footer"></div>
</div>`

const HEADER_BOOT = `if (window.theme && theme.inlineNavigationCheck) {
  theme.inlineNavigationCheck();
  setTimeout(theme.setInitialHeaderHeightProperty, 0);
}`

export function PageFooter({ show }: { show: Show }) {
  return (
    <div id="pagefooter">
      <div className="shopify-section shopify-section-group-footer-group section-footer">
        <div className="container container--no-max section-footer__row-container">
          <div className="section-footer__row section-footer__row--blocks" data-num-blocks="3">
            <div className="section-footer__row__col section-footer__text-block">
              <span className="section-footer__text-block__image" style={{ maxWidth: 150 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img('Mermade-Market-Icon-white1-01.png')} alt="" width={150} height={150} />
              </span>
            </div>
            <div className="section-footer__row__col section-footer__text-block section-footer__text-block--with-text">
              <div className="section-footer__text rte">
                <p>Shop small. Think Big. </p>
                <p>
                  Mermade Market is a hand curated market. Uniting creators with
                  community, we feature 100+ indoor &amp; outdoor merchants every
                  spring &amp; winter!{' '}
                </p>
                <p>Dana Point {show.venueName}</p>
                <p>{show.venueAddress}</p>
              </div>
              <div className="section-footer__text-block__social">
                <ul className="social inline-flex flex-wrap">
                  <li>
                    <a
                      className="social__link flex items-center justify-center"
                      href="https://www.facebook.com/mermademarketoc"
                      target="_blank" rel="noopener noreferrer"
                      title="Mermade Market on Facebook"
                    >
                      <svg aria-hidden="true" className="icon icon-facebook" viewBox="2 2 16 16" focusable="false" role="presentation">
                        <path fill="currentColor" d="M18 10.049C18 5.603 14.419 2 10 2c-4.419 0-8 3.603-8 8.049C2 14.067 4.925 17.396 8.75 18v-5.624H6.719v-2.328h2.03V8.275c0-2.017 1.195-3.132 3.023-3.132.874 0 1.79.158 1.79.158v1.98h-1.009c-.994 0-1.303.621-1.303 1.258v1.51h2.219l-.355 2.326H11.25V18c3.825-.604 6.75-3.933 6.75-7.951Z" />
                      </svg>
                      <span className="visually-hidden">Facebook</span>
                    </a>
                  </li>
                  <li>
                    <a
                      className="social__link flex items-center justify-center"
                      href="https://instagram.com/mermademarket"
                      target="_blank" rel="noopener noreferrer"
                      title="Mermade Market on Instagram"
                    >
                      <svg aria-hidden="true" className="icon icon-instagram" viewBox="2 2 16 16" focusable="false" role="presentation">
                        <path fill="currentColor" d="M10 3.442c2.136 0 2.39.008 3.233.047.78.035 1.203.166 1.485.276.373.145.64.318.92.598.28.28.453.546.598.92.11.281.24.705.276 1.485.039.843.047 1.096.047 3.232 0 2.136-.008 2.39-.047 3.233-.035.78-.166 1.203-.276 1.485a2.478 2.478 0 0 1-.598.92c-.28.28-.547.453-.92.598-.282.11-.705.24-1.485.276-.843.039-1.097.047-3.233.047-2.136 0-2.39-.008-3.232-.047-.78-.035-1.204-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.478 2.478 0 0 1-.599-.92c-.11-.282-.24-.705-.276-1.485-.038-.843-.047-1.097-.047-3.233 0-2.136.009-2.39.047-3.232.036-.78.166-1.204.276-1.485.145-.374.319-.64.599-.92.28-.28.546-.453.92-.598.28-.11.704-.241 1.485-.276C7.61 3.45 7.864 3.442 10 3.442ZM10 2c-2.172 0-2.445.01-3.298.048-.851.039-1.433.174-1.941.372a3.92 3.92 0 0 0-1.417.923c-.445.444-.719.89-.923 1.417-.198.508-.333 1.09-.372 1.941C2.01 7.555 2 7.828 2 10s.01 2.445.049 3.298c.038.852.173 1.433.371 1.942.205.526.478.972.923 1.417.444.444.89.718 1.417.922.508.198 1.09.333 1.941.372C7.555 17.99 7.828 18 10 18s2.445-.01 3.298-.049c.852-.039 1.433-.174 1.942-.372a3.921 3.921 0 0 0 1.417-.922c.444-.445.718-.891.922-1.417.198-.509.333-1.09.372-1.942.038-.853.048-1.126.048-3.298s-.01-2.445-.048-3.299c-.039-.851-.174-1.433-.372-1.94a3.922 3.922 0 0 0-.922-1.418 3.92 3.92 0 0 0-1.417-.923c-.509-.198-1.09-.333-1.942-.372C12.445 2.01 12.172 2 10 2Zm0 3.892a4.108 4.108 0 1 0 0 8.216 4.108 4.108 0 0 0 0-8.216Zm0 6.775a2.667 2.667 0 1 1 0-5.334 2.667 2.667 0 0 1 0 5.334Zm5.23-6.937a.96.96 0 1 1-1.92 0 .96.96 0 0 1 1.92 0Z" />
                      </svg>
                      <span className="visually-hidden">Instagram</span>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div className="section-footer__row__col section-footer__newsletter-block">
              <div className="section-footer__text rte">
                <p>Stay hooked: We send show dates, and important VIP info to our subscribers.</p>
              </div>
              <FooterSignup />
            </div>
          </div>
        </div>
        <div className="container container--no-max section-footer__row-container">
          <div className="section-footer__row section-footer__row-lower">
            <div className="section-footer__row__col">
              <div className="section-footer__lower-menu" role="navigation">
                <ul className="section-footer__lower-menu__list" aria-label="Secondary">
                  <li><Link href="/contact">Contact</Link></li>
                  <li><Link href="/faq">FAQ</Link></li>
                  <li><Link href="/journal">Journal</Link></li>
                  <li><Link href="/apply">Apply</Link></li>
                  <li><Link href="/collaborate">Collaborate</Link></li>
                </ul>
              </div>
            </div>
            <div className="section-footer__row__col">
              <div className="copyright">
                <span className="copy">
                  &copy; {new Date().getFullYear()} <Link href="/">Mermade Market</Link>.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Split out so the footer stays a server component and only the form ships JS. */
import { SignupForm } from './SignupForm'
function FooterSignup() {
  return <SignupForm />
}
