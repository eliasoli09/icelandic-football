import Link from 'next/link'
import type { PublishedArticle } from '@/lib/nfl/articles/queries'
import { dayLabel } from '@/lib/nfl/time'

export const ARTICLE_KIND: Record<PublishedArticle['kind'], string> = { upphitun: 'Upphitun', umfjollun: 'Umfjöllun', vikan: 'Vikan í hnotskurn', grein: 'Grein' }

export function ArticleList({ items, compact = false }: { items: PublishedArticle[]; compact?: boolean }) {
  return (
    <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
      {items.map((a) => (
        <li key={a.slug}>
          <Link href={`/grein/${a.slug}`} className="trow grid gap-1 px-4 py-3">
            <span className="text-[11px] font-bold tracking-wide" style={{ color: 'var(--accent)' }}>
              {ARTICLE_KIND[a.kind].toUpperCase()} <span className="muted font-normal">· {dayLabel(a.published_at)}</span>
            </span>
            <span className="font-semibold">{a.title}</span>
            {!compact && a.lede && <span className="text-sm muted">{a.lede}</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}
