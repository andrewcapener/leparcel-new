import Link from 'next/link'

/**
 * The admin register: dense and precise, not warm and photographic.
 * docs/08-DESIGN-SYSTEM.md — "Institutional is for the vendors and for a
 * future buyer, not for the shoppers." Two registers, one system.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="adm">
      <div className="adm-bar">
        <Link href="/" className="brand">Mermade</Link>
        <Link href="/admin/jury">Jury</Link>
        <Link href="/admin/roster">Roster</Link>
        <Link href="/admin/show">Show settings</Link>
        <Link href="/admin/outbox">Outbox</Link>
        <span className="who">elise@mermademarket.com · prototype, no auth</span>
      </div>
      {children}
    </div>
  )
}
