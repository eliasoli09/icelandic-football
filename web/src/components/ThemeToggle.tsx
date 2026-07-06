'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-9 h-9" />
  const dark = resolvedTheme === 'dark'
  return (
    <button
      aria-label={dark ? 'Skipta í bjart þema' : 'Skipta í dökkt þema'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className="w-9 h-9 rounded-lg border flex items-center justify-center text-lg"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      {dark ? '☀' : '☾'}
    </button>
  )
}
