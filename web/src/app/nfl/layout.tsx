import { Database } from 'lucide-react'
import { NflSubnav } from '@/components/Nfl/NflSubnav'

export const metadata = {
  title: 'NFL - Besta spáin',
  description: 'Leikir vikunnar, úrslit og staðan í NFL, á íslenskum tíma.',
}

export default function NflLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-league="nfl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="display text-3xl font-extrabold tracking-tight">
          NFL <span style={{ color: 'var(--accent)' }}>·</span>
        </h1>
        <NflSubnav />
      </div>
      {children}
      <p className="text-[11px] muted mt-10 inline-flex items-center gap-1.5">
        <Database size={11} aria-hidden /> Gögn: nflverse (nfldata). Tímar eru íslenskir.
      </p>
    </div>
  )
}
