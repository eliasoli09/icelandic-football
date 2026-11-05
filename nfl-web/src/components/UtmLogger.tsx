'use client'

import { useEffect } from 'react'

/**
 * Sends a UTM-tagged landing to /api/utm, once per link per tab. It sits in the root layout,
 * which stays mounted across client navigation, so only the landing page is logged.
 */
export function UtmLogger() {
  useEffect(() => {
    const { search, pathname } = window.location
    if (!search.includes('utm_source=')) return
    const key = `utm:${search}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      // storage blocked - log anyway, at worst twice
    }
    fetch('/api/utm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ search, path: pathname, referrer: document.referrer }),
      keepalive: true,
    }).catch(() => {})
  }, [])
  return null
}
