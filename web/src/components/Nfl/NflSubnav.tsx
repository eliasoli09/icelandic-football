'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// `short` is what fits five tabs on a 375 px phone
const TABS = [
  { href: '/nfl', label: 'Vikan' },
  { href: '/nfl/stada', label: 'Staðan' },
  { href: '/nfl/urslitakeppni', label: 'Úrslitakeppnin', short: 'Úrslit' },
  { href: '/nfl/spa', label: 'Spáleikur', short: 'Spá' },
  { href: '/nfl/leikmenn', label: 'Leikmenn' },
]

export function NflSubnav() {
  const pathname = usePathname()
  return (
    <nav aria-label="NFL" className="inline-flex max-w-full overflow-x-auto rounded-full border p-1 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {TABS.map((t) => {
        const active = pathname === t.href
          || (t.href === '/nfl/leikmenn' && (pathname.startsWith('/nfl/leikmadur') || pathname.startsWith('/nfl/verdlaun')))
          || (t.href === '/nfl/stada' && pathname === '/nfl/styrkleiki')
          || (t.href === '/nfl/spa' && pathname.startsWith('/nfl/spa/'))
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className="rounded-full px-2 sm:px-4 min-h-[36px] inline-flex items-center font-semibold whitespace-nowrap shrink-0 text-[13px] sm:text-sm"
            style={{ background: active ? 'var(--accent)' : 'transparent', color: active ? 'var(--accent-ink)' : 'var(--text-2)' }}
          >
            {t.short ? <><span className="sm:hidden">{t.short}</span><span className="hidden sm:inline">{t.label}</span></> : t.label}
          </Link>
        )
      })}
    </nav>
  )
}
