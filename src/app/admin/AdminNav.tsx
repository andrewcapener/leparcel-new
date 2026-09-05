'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * The admin's own navigation. Split out of the layout because the active
 * state needs the pathname, and the layout has to stay a server component so
 * it can read the Show record.
 *
 * The stylesheet has carried `.adm-bar a[data-on="1"]` from the start and
 * nothing ever set it, so every tab looked the same and staff had no idea
 * which screen they were on.
 */
const TABS = [
  { href: '/admin/jury', label: 'Jury' },
  { href: '/admin/roster', label: 'Roster' },
  { href: '/admin/show', label: 'Show settings' },
  { href: '/admin/outbox', label: 'Outbox' },
] as const

export function AdminNav() {
  const path = usePathname()
  return (
    <>
      {TABS.map((t) => {
        // /admin/applications/:id is opened from the jury queue and belongs to it.
        const on =
          path === t.href ||
          path.startsWith(`${t.href}/`) ||
          (t.href === '/admin/jury' && path.startsWith('/admin/applications'))
        return (
          <Link
            key={t.href}
            href={t.href}
            data-on={on ? '1' : undefined}
            aria-current={on ? 'page' : undefined}
          >
            {t.label}
          </Link>
        )
      })}
    </>
  )
}
