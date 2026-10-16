'use client'
import { usePathname } from 'next/navigation'
import { NflSubnav } from './NflSubnav'
export function NflPageHeader() {
  const pathname = usePathname()
  if (pathname === '/nfl') return null
  return <div className="flex flex-wrap items-center justify-between gap-3 mb-6"><h1 className="display text-3xl font-extrabold tracking-tight">NFL <span style={{ color: 'var(--accent)' }}>·</span></h1><NflSubnav /></div>
}
