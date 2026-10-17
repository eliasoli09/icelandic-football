import { Tv } from 'lucide-react'
import type { Broadcast } from '@/lib/nfl/queries'

/** "Sýn Sport 2" on a game shown on Icelandic TV. */
export function TvBadge({ b, className = '' }: { b: Broadcast | undefined; className?: string }) {
  if (!b) return null
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${className}`} style={{ color: 'var(--accent)' }} title={b.note || undefined}>
      <Tv size={12} aria-hidden /> {b.channel}
    </span>
  )
}
