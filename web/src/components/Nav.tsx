'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { Menu, X, Clock, Shield } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { LeagueSwitcher } from './LeagueSwitcher'

const NAV = [
  { href: '/', label: 'Yfirlit' },
  { href: '/elo', label: 'Elo' },
  { href: '/tafla', label: 'Tafla' },
  { href: '/leikir', label: 'Leikir' },
  { href: '/leikmenn', label: 'Leikmenn' },
  { href: '/sludur', label: 'Slúður' },
  { href: '/hm', label: 'HM' },
  { href: '/kastalinn', label: 'Kastalinn' },
  { href: '/saga', label: 'Saga' },
  { href: '/h2h', label: 'H2H' },
]

export function Nav({ updatedAt }: { updatedAt: string | null }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  const stamp = updatedAt
    ? new Date(updatedAt).toLocaleString('is-IS', {
        day: 'numeric', month: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
      })
    : null

  return (
    <header
      className="sticky top-0 z-20 border-b"
      style={{
        borderColor: 'var(--border)',
        background: 'color-mix(in srgb, var(--bg) 72%, transparent)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
        <Link href="/" className="font-bold tracking-tight text-lg whitespace-nowrap display inline-flex items-center gap-2">
          <Shield size={20} aria-hidden style={{ color: 'var(--accent)' }} />
          Besta spáin
        </Link>

        <nav aria-label="Aðalvalmynd" className="hidden lg:flex gap-0.5 text-sm font-medium ml-2">
          {NAV.map((n) => {
            const active = isActive(n.href)
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className="relative px-3 py-1.5"
                style={{ color: active ? 'var(--text)' : 'var(--text-2)' }}
              >
                {active && (
                  <motion.span
                    layoutId={reduce ? undefined : 'nav-underline'}
                    className="absolute left-3 right-3 -bottom-[3px] h-[2.5px] rounded-full"
                    style={{ background: 'var(--accent)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative z-10">{n.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="flex-1" />

        <div className="hidden md:block">
          <LeagueSwitcher size="sm" />
        </div>

        <span className="hidden xl:inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border"
          style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
          <span className="live-dot" aria-hidden />
          Live
        </span>
        {stamp && (
          <span className="hidden xl:inline-flex items-center gap-1.5 text-xs muted num whitespace-nowrap">
            <Clock size={12} aria-hidden />
            Síðast uppfært: {stamp}
          </span>
        )}

        <ThemeToggle />
        <button
          className="lg:hidden w-11 h-11 rounded-lg border flex items-center justify-center"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          aria-expanded={open}
          aria-label={open ? 'Loka valmynd' : 'Opna valmynd'}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
        </button>
      </div>

      {open && (
        <motion.nav
          aria-label="Aðalvalmynd (sími)"
          className="lg:hidden border-t px-4 py-4 grid gap-3"
          style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
          initial={reduce ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <div className="md:hidden flex justify-center"><LeagueSwitcher size="sm" /></div>
          <div className="grid grid-cols-2 gap-1.5">
            {NAV.map((n) => {
              const active = isActive(n.href)
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className="px-3 py-2.5 rounded-lg text-sm font-semibold min-h-[44px] flex items-center"
                  style={{
                    background: active ? 'var(--accent)' : 'var(--surface)',
                    color: active ? 'var(--accent-ink)' : 'var(--text)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {n.label}
                </Link>
              )
            })}
          </div>
          {stamp && (
            <p className="text-[11px] muted num inline-flex items-center gap-1.5">
              <Clock size={11} aria-hidden /> Síðast uppfært: {stamp}
            </p>
          )}
        </motion.nav>
      )}
    </header>
  )
}
