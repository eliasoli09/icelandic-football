'use client'

import { useState } from 'react'

export function ShareButton({
  title,
  text,
  path,
  imagePath,
}: {
  title: string
  text: string
  /** page path to share, e.g. /leikir/123 (defaults to current page) */
  path?: string
  /** OG image endpoint for "sækja mynd", e.g. /api/og/leikur/123 */
  imagePath?: string
}) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = new URL(path ?? window.location.pathname, window.location.origin).toString()
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch {
        // user cancelled — fall through to nothing
        return
      }
    }
    await navigator.clipboard.writeText(`${text} ${url}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={share}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
        aria-label="Deila"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
        </svg>
        {copied ? 'Afritað!' : 'Deila'}
      </button>
      {imagePath && (
        <a
          href={imagePath}
          target="_blank"
          rel="noopener"
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}
        >
          Mynd ↗
        </a>
      )}
    </span>
  )
}
