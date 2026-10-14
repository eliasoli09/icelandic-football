'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/nfl', label: 'Vikan' },
  { href: '/nfl/stada', label: 'Staðan' },
]

export function NflSubnav() {
  const pathname = usePathname()
  return (
    <nav aria-label="NFL" className="inline-flex rounded-full border p-1 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {TABS.map((t) => {
        const active = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className="rounded-full px-4 min-h-[36px] inline-flex items-center font-semibold"
            style={{ background: active ? 'var(--accent)' : 'transparent', color: active ? 'var(--accent-ink)' : 'var(--text-2)' }}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
