import type { AddOn, SpaceType } from '@/db/schema'
import { usd } from '@/lib/money'

/**
 * The furniture for the two long-form maker rules pages. These pages are
 * reference documents a maker reads once before applying and again the week
 * of the show, so everything here is built to be scanned: one measure, a
 * sticky index, numbered sections, and money in a table instead of a
 * paragraph (docs/03-DATA-MODEL.md §6, "prices stop living in prose").
 */

export type TocItem = { id: string; label: string }

export function Toc({ items }: { items: TocItem[] }) {
  return (
    <nav className="toc" aria-label="On this page">
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`}>{i.label}</a>
      ))}
    </nav>
  )
}

export function Sec({
  n, title, id, children, tint,
}: {
  n: string; title: string; id: string; children: React.ReactNode; tint?: boolean
}) {
  return (
    <section className="sec" id={id} style={tint ? { background: 'var(--paper-2)' } : undefined}>
      <div className="shead">
        <span className="k">{n}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  )
}

export function Rules({ children }: { children: React.ReactNode }) {
  return <div className="rules">{children}</div>
}

export function Pull({ children }: { children: React.ReactNode }) {
  return <div className="pull"><p>{children}</p></div>
}

export function Callout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="callout">
      <div className="k">{label}</div>
      <p>{children}</p>
    </div>
  )
}

export function Checklist({ items }: { items: string[] }) {
  return (
    <div className="check">
      {items.map((t) => (
        <div key={t}><span className="bx" aria-hidden="true" />{t}</div>
      ))}
    </div>
  )
}

/**
 * Prices come off space_types and add_ons. Never typed into a page.
 * `bare` drops the per-row descriptions, for the outdoor table where every
 * day carries the same sentence and saying it once above the table reads
 * better than saying it three times inside it.
 */
export function PriceTable({
  spaces, extras, bare,
}: {
  spaces: SpaceType[]; extras: AddOn[]; bare?: boolean
}) {
  return (
    <>
      <div className="ptab">
        {spaces.map((s) => (
          <div className="r" key={s.id}>
            <span className="n">{s.label}</span>
            <span className="d">{bare ? '' : s.description}</span>
            <span className="p num">{usd(s.priceCents)}</span>
          </div>
        ))}
      </div>
      {extras.length > 0 && (
        <>
          <div className="k" style={{ margin: '38px 0 0' }}>Add-ons</div>
          <div className="ptab">
            {extras.map((a) => (
              <div className="r" key={a.id}>
                <span className="n">{a.name}</span>
                <span className="d">{a.description}</span>
                {a.isLimited && <span className="lmt">Limited</span>}
                <span className="p num">{usd(a.priceCents)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <p style={{
        fontFamily: 'var(--font-j)', fontSize: 13.5, color: 'var(--ink-3)',
        marginTop: 14, maxWidth: '60ch', lineHeight: 1.55,
      }}>
        No fee to apply and no rental tables. You ask for add-ons on the application, and
        we confirm what we can give you when you are accepted.
      </p>
    </>
  )
}
