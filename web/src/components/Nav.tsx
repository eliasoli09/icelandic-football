'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { ThemeToggle } from './ThemeToggle'

const NAV = [
  { href: '/', label: 'Yfirlit' },
  { href: '/elo', label: 'Elo' },
  { href: '/tafla', label: 'Tafla' },
  { href: '/leikir', label: 'Leikir' },
  { href: '/leikmenn', label: 'Leikmenn' },
  { href: '/kastalinn', label: 'Kastalinn' },
  { href: '/saga', label: 'Saga' },
  { href: '/h2h', label: 'H2H' },
]

export function Nav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

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
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link href="/" className="font-bold tracking-tight text-lg whitespace-nowrap display inline-flex items-center gap-2">
          <span aria-hidden>⚽</span> Besta spáin
        </Link>

        <nav aria-label="Aðalvalmynd" className="hidden md:flex gap-1 text-sm font-medium">
          {NAV.map((n) => {
            const active = isActive(n.href)
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className="relative px-3 py-1.5 rounded-full"
                style={{ color: active ? 'var(--accent-ink)' : 'var(--text-2)' }}
              >
                {active && (
                  <motion.span
                    layoutId={reduce ? undefined : 'nav-pill'}
                    className="absolute inset-0 rounded-full"
                    style={{ background: 'var(--accent)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <span className="relative z-10">{n.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            className="md:hidden w-9 h-9 rounded-lg border flex flex-col items-center justify-center gap-1"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            aria-expanded={open}
            aria-label={open ? 'Loka valmynd' : 'Opna valmynd'}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="block w-4 h-0.5 rounded" style={{ background: 'var(--text)' }} />
            <span className="block w-4 h-0.5 rounded" style={{ background: 'var(--text)' }} />
          </button>
        </div>
      </div>

      {open && (
        <motion.nav
          aria-label="Aðalvalmynd (sími)"
          className="md:hidden border-t px-4 py-3 grid grid-cols-2 gap-1.5"
          style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
          initial={reduce ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {NAV.map((n) => {
            const active = isActive(n.href)
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className="px-3 py-2.5 rounded-lg text-sm font-semibold"
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
        </motion.nav>
      )}
    </header>
  )
}
