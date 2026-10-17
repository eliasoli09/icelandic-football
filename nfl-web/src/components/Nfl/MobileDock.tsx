'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, CalendarDays, ExternalLink, House, Info, LayoutGrid, Medal, Megaphone, Newspaper, Radio, Shirt, Target, Ticket, Trophy, Users, X } from 'lucide-react'
import { FOOTBALL_URL } from '@/lib/site'
import { TABS } from './NflSubnav'

/** The four places a phone reader goes most; everything else is under "Meira". */
const DOCK = [
  { href: '/', label: 'Forsíða', icon: House },
  { href: '/leikir', label: 'Leikir', icon: CalendarDays },
  { href: '/stjornbord', label: 'Í beinni', icon: Radio },
  { href: '/vedmal', label: 'Veðmál', icon: Ticket },
] as const
const ICON: Record<string, typeof House> = {
  '/spar': BarChart3, '/stada': Trophy, '/urslitakeppni': Medal, '/sludur': Megaphone, '/spa': Target,
  '/leikmenn': Shirt, '/greinar': Newspaper,
}

const isActive = (href: string, path: string) => {
  const t = TABS.find((x) => x.href === href)
  return path === href || !!t?.also?.(path)
}

/** Whether any game is on, for the dot on "Í beinni"; checked once a minute while the page is visible. */
function useAnyLive(): boolean {
  const [live, setLive] = useState(false)
  useEffect(() => {
    let alive = true
    const load = async () => {
      if (document.hidden) return
      try {
        const r = await fetch('/api/nfl/live', { cache: 'no-store' })
        const d = await r.json()
        if (alive) setLive(!!d.games?.some((g: { live: boolean }) => g.live))
      } catch { /* no dot */ }
    }
    void load()
    const t = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  return live
}

/**
 * The phone's navigation: a bar at the bottom of the screen, in thumb's reach,
 * lit like a scoreboard over the active tab, and a sheet with the rest.
 */
export function MobileDock() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const live = useAnyLive()
  useEffect(() => { setOpen(false) }, [path])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open])
  const inDock = new Set<string>(DOCK.map((d) => d.href))
  const rest = TABS.filter((t) => !inDock.has(t.href))
  const restActive = rest.some((t) => isActive(t.href, path))

  return (
    <>
      {open && (
        <div className="dock-sheet md:hidden" role="dialog" aria-modal="true" aria-label="Allar síður">
          <button className="dock-scrim" aria-label="Loka" onClick={() => setOpen(false)} />
          <div className="dock-panel">
            <div className="flex items-center justify-between mb-3">
              <p className="display text-lg font-extrabold">Allt á síðunni</p>
              <button onClick={() => setOpen(false)} aria-label="Loka" className="w-10 h-10 grid place-items-center rounded-full" style={{ background: 'var(--surface-2)' }}><X size={18} /></button>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {rest.map((t) => {
                const Icon = ICON[t.href] ?? Users
                const on = isActive(t.href, path)
                return (
                  <li key={t.href}>
                    <Link href={t.href} aria-current={on ? 'page' : undefined} className="dock-tile" data-on={on}>
                      <Icon size={18} aria-hidden /> {t.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
            <div className="mt-4 pt-3 border-t grid gap-1 text-sm" style={{ borderColor: 'var(--border)' }}>
              <Link href="/um" className="dock-link"><Info size={16} aria-hidden /> Um síðuna</Link>
              <a href={FOOTBALL_URL} className="dock-link"><ExternalLink size={16} aria-hidden /> Íslenskur fótbolti</a>
            </div>
          </div>
        </div>
      )}
      <nav className="dock md:hidden" aria-label="Aðalvalmynd">
        {DOCK.map((d) => {
          const on = isActive(d.href, path)
          const Icon = d.icon
          return (
            <Link key={d.href} href={d.href} aria-current={on ? 'page' : undefined} className="dock-item" data-on={on}>
              <span className="relative"><Icon size={21} aria-hidden />{d.href === '/stjornbord' && live && <span className="dock-live" aria-label="Leikir í gangi" />}</span>
              <span>{d.label}</span>
            </Link>
          )
        })}
        <button onClick={() => setOpen(true)} className="dock-item" data-on={restActive || open} aria-expanded={open} aria-haspopup="dialog">
          <LayoutGrid size={21} aria-hidden />
          <span>Meira</span>
        </button>
      </nav>
    </>
  )
}
