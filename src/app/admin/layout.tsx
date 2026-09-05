import Link from 'next/link'
// The admin's own stylesheet. Imported here rather than in the root layout so
// the public site gets the vendored Symmetry theme and nothing else, and so
// this one loads after it and wins inside /admin.
import '../globals.css'

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
        <span className="who">Staff · shared password until real accounts land</span>
      </div>
      {children}
    </div>
  )
}
