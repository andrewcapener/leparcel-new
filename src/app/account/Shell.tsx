import Link from 'next/link'

/**
 * The furniture of the maker account.
 *
 * The page used to be built from the theme's full-bleed rich-text sections,
 * which are pitched for a marketing page: a centred title, a lot of air, one
 * idea per screen. On a dashboard that reads as a webpage rather than as your
 * own account, which is exactly what Drew said on 14 September. These three
 * pieces give it its own ground and its own furniture instead, and stay on
 * the site's palette by using the theme's own colour variables in CSS.
 *
 * Presentational only. Nothing here decides anything.
 */

/** The band that says whose account this is. Replaces the marketing title. */
export function AccountHeader({
  shopName, vendorCode, status, showName, signOut = true, eyebrow = 'Maker account',
}: {
  shopName: string
  vendorCode?: string
  /** One short phrase, already decided by the caller. */
  status?: string
  showName: string
  /** Off for the preview, where there is no session to end. */
  signOut?: boolean
  /** What this page is. /pay/<token> is deliberately NOT the account, and a
   *  header that says otherwise invites somebody to go looking for the rest
   *  of it. */
  eyebrow?: string
}) {
  return (
    <div className="mk-acct__head">
      <div>
        <p className="mk-acct__eyebrow">{eyebrow}</p>
        <h1 className="mk-acct__name">{shopName}</h1>
        <div className="mk-acct__meta">
          {[showName, status].filter(Boolean).map((bit) => <p key={String(bit)}>{bit}</p>)}
          {vendorCode && <p className="mk-acct__id">{vendorCode}</p>}
        </div>
      </div>
      {signOut && (
        /* A form, not a link: signing out changes state, and a GET would let
           any page on the internet do it with an image tag. */
        <form className="mk-acct__out" action="/account/signout" method="POST">
          <button className="btn btn--secondary" type="submit">Sign out</button>
        </form>
      )}
    </div>
  )
}

export function Card({
  title, children, id, wide = false,
}: {
  title?: string
  children: React.ReactNode
  id?: string
  /** Span both columns of the grid. */
  wide?: boolean
}) {
  return (
    <section className={`mk-card${wide ? ' mk-grid__wide' : ''}`} id={id}>
      {title && <h2 className="mk-card__title">{title}</h2>}
      {children}
    </section>
  )
}

export type Fact = { label: string; value: React.ReactNode }

/** Label and value rows inside a card. The compact cousin of FactTable, which
 *  is a whole page section and is right on a marketing page and wrong here. */
export function Facts({ rows }: { rows: Fact[] }) {
  return (
    <dl className="mk-dl">
      {rows.map((r) => (
        <div className="mk-dl__row" key={r.label}>
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The quiet line under a card's rows. */
export function CardNote({ children }: { children: React.ReactNode }) {
  return <p className="mk-card__note">{children}</p>
}

export { Link }
