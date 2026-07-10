'use client'

import { useEffect } from 'react'

/** Registers the service worker (push notifications + installability). */
export function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // push simply stays unavailable
      })
    }
  }, [])
  return null
}
