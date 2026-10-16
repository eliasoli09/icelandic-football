'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Eight tabs on every page; on a phone the row scrolls sideways and keeps the active tab in view. */
const TABS: { href: string; label: string; also?: (p: string) => boolean }[] = [
  { href: '/', label: 'Forsíða' },
  { href: '/leikir', label: 'Leikir', also: (p) => p.startsWith('/leikur/') },
  { href: '/spar', label: 'Spár', also: (p) => p === '/styrkleiki' },
  { href: '/stada', label: 'Staðan' },
  { href: '/urslitakeppni', label: 'Úrslitakeppnin' },
  { href: '/spa', label: 'Spáleikur', also: (p) => p.startsWith('/spa/') },
  { href: '/leikmenn', label: 'Leikmenn', also: (p) => p.startsWith('/leikmadur') || p.startsWith('/leikmenn/') || p === '/verdlaun' },
  { href: '/greinar', label: 'Greinar', also: (p) => p.startsWith('/grein/') || p === '/frettir' },
]

export function NflSubnav() {
  const pathname = usePathname()
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = bar.current?.querySelector<HTMLElement>('[aria-current="page"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [pathname])
  return (
    <div ref={bar} className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <nav aria-label="NFL" className="flex w-max gap-1 py-2">
        {TABS.map((t) => {
          const active = pathname === t.href || !!t.also?.(pathname)
          return (
            <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}
              className="rounded-full px-3.5 min-h-[36px] inline-flex items-center text-sm font-semibold whitespace-nowrap transition-colors"
              style={{ background: active ? 'var(--accent)' : 'transparent', color: active ? 'var(--accent-ink)' : 'var(--text-2)' }}>
              {t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
