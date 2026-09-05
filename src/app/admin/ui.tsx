import Link from 'next/link'
import { Icon, type IconName } from './Icon'

/**
 * The admin's shapes, as components, so every screen builds from the same
 * five and none of them is redrawn by hand. docs/08-DESIGN-SYSTEM.md §5.
 *
 *   PageHead   large sentence-case title, a mono subtitle, actions right
 *   Stats/Stat a row of equal cards: caps label, icon, one loud figure
 *   ActionCard the wider card under a stat row: icon, caps title, mono line
 *   Progress   figure loud, unit quiet, bar, status line, link right
 *   Tabs/Tab   a filter strip: caps label, count pill, thick active underline
 *
 * All of these are server components. Nothing here holds state.
 */

/** The page's own head. `sub` is machine text: counts, dates, totals. */
export function PageHead({
  title, sub, children,
}: {
  title: string
  sub: React.ReactNode
  /** The primary action, and any quiet links beside it. */
  children?: React.ReactNode
}) {
  return (
    <header className="adm-head">
      <div className="l">
        <h1 className="adm-title">{title}</h1>
        <p className="adm-sub">{sub}</p>
      </div>
      {children && <div className="r">{children}</div>}
    </header>
  )
}

export function Stats({ children }: { children: React.ReactNode }) {
  return <div className="adm-stats">{children}</div>
}

export function Stat({
  label, icon, value, unit, note, warn, href, text,
}: {
  label: string
  icon: IconName
  value: React.ReactNode
  /** Quiet, beside the figure: "of 45", "spaces", "expected". */
  unit?: string
  note?: string
  warn?: boolean
  /** A stat card that is also the way into the screen behind it. */
  href?: string
  /** The value is a date or a phrase rather than a figure: the same card,
   *  set at reading size so it does not wrap to three lines. */
  text?: boolean
}) {
  const body = (
    <>
      <span className="hd">
        <span className="k">{label}</span>
        <Icon name={icon} size={18} />
      </span>
      <span className={text ? 'v txt' : 'v'}>
        {value}{unit && <small>{unit}</small>}
      </span>
      {note && <span className="n">{note}</span>}
    </>
  )
  return href
    ? <Link className="adm-stat" href={href} data-warn={warn ? '1' : undefined}>{body}</Link>
    : <div className="adm-stat" data-warn={warn ? '1' : undefined}>{body}</div>
}

export function ActionCard({
  href, icon, title, note,
}: {
  href: string; icon: IconName; title: string; note: string
}) {
  return (
    <Link className="adm-act" href={href}>
      <Icon name={icon} size={22} />
      <span className="b">
        <span className="t">{title}</span>
        <span className="n">{note}</span>
      </span>
      <span className="go" aria-hidden="true"><Icon name="chevron" size={16} /></span>
    </Link>
  )
}

/**
 * A proportion. The figures are printed beside the bar, so the bar itself is
 * decoration for the eye and is hidden from assistive technology.
 */
export function Progress({
  label, figure, unit, pct, status, link,
}: {
  label: string
  figure: React.ReactNode
  unit: string
  /** 0-100. Clamped, because a roster can collect more than it expected. */
  pct: number
  status: React.ReactNode
  link?: { href: string; label: string }
}) {
  const w = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div className="adm-card adm-prog">
      <span className="k">{label}</span>
      <div className="fig">
        {figure}<span className="unit">{unit}</span>
      </div>
      <div className="bar" aria-hidden="true"><span style={{ width: `${w}%` }} /></div>
      <div className="ft">
        <span className="st">{status}</span>
        {link && (
          <Link className="adm-lk" href={link.href}>
            {link.label} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
    </div>
  )
}

export function Tabs({ label, children }: { label: string; children: React.ReactNode }) {
  return <nav className="adm-tabs" aria-label={label}>{children}</nav>
}

export function Tab({
  href, label, count, on,
}: {
  href: string; label: string; count: number; on: boolean
}) {
  return (
    <Link className="adm-tab" href={href} aria-current={on ? 'page' : undefined}>
      {label}
      <span className="pill">{count}</span>
    </Link>
  )
}
