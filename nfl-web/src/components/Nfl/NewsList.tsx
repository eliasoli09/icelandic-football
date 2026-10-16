import { ExternalLink } from 'lucide-react'
import { clock, dayLabel } from '@/lib/nfl/time'
import type { NewsItem } from '@/lib/nfl/queries'

/** Our Icelandic headline and summary; the article itself is always the publisher's, behind the link. */
export function NewsList({ items, compact }: { items: NewsItem[]; compact?: boolean }) {
  if (!items.length) return <p className="text-sm muted">Engar fréttir enn.</p>
  return (
    <ul className={`grid gap-3 ${compact ? 'md:grid-cols-2' : ''}`}>
      {items.map((n) => (
        <li key={n.url} className="card p-4 grid gap-1.5">
          <h3 className="font-semibold leading-snug">{n.title_is}</h3>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>{n.summary_is}</p>
          <p className="text-[11px] muted flex flex-wrap items-center gap-x-2">
            <span>{dayLabel(n.published_at).split(' ').slice(1).join(' ')} kl. {clock(n.published_at)}</span>
            <a href={n.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2">
              Heimild: {n.source} <ExternalLink size={10} aria-hidden />
            </a>
          </p>
        </li>
      ))}
    </ul>
  )
}

export const NEWS_NOTE = 'Íslensk samantekt skrifuð af gervigreind út frá fyrirsögn og stuttri lýsingu fréttamiðilsins. Fréttin sjálf er hjá miðlinum, á bak við tengilinn.'
