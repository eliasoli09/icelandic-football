'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/nfl', label: 'Vikan' },
  { href: '/nfl/stada', label: 'Staðan' },
  { href: '/nfl/styrkleiki', label: 'Styrkleiki' },
  { href: '/nfl/urslitakeppni', label: 'Úrslitakeppnin' },
]

export function NflSubnav() {
  const pathname = usePathname()
  return (
    <nav aria-label="NFL" className="inline-flex max-w-full overflow-x-auto rounded-full border p-1 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {TABS.map((t) => {
        const active = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className="rounded-full px-2.5 sm:px-4 min-h-[36px] inline-flex items-center font-semibold whitespace-nowrap shrink-0"
            style={{ background: active ? 'var(--accent)' : 'transparent', color: active ? 'var(--accent-ink)' : 'var(--text-2)' }}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
