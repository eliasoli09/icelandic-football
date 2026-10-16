import Link from 'next/link'
import { ArticleList } from '@/components/Nfl/ArticleList'
import { NEWS_NOTE, NewsList } from '@/components/Nfl/NewsList'
import { nflArticles } from '@/lib/nfl/articles/queries'
import { nflNews } from '@/lib/nfl/queries'

export const revalidate = 300
export const metadata = {
  title: 'Greinar og fréttir',
  description: 'Upphitun fyrir hverja umferð, umfjöllun eftir leiki, vikan í hnotskurn og erlendar NFL-fréttir á íslensku.',
}

export default async function NflArticlesPage() {
  const [items, news] = await Promise.all([nflArticles({ limit: 60 }).catch(() => []), nflNews({ limit: 8, sinceDays: 7 }).catch(() => [])])
  return (
    <div className="grid gap-10">
      <section className="grid gap-4">
        <header className="grid gap-1">
          <h2 className="display text-3xl font-extrabold tracking-tight">Greinar</h2>
          <p className="muted text-sm">Upphitun fyrir hverja umferð, umfjöllun eftir leiki og vikan í hnotskurn.</p>
        </header>
        {items.length ? <ArticleList items={items} /> : <p className="muted">Engar greinar birtar enn.</p>}
      </section>
      {news.length > 0 && (
        <section className="grid gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="display text-xl font-extrabold">Erlendar fréttir</h2>
            <Link href="/frettir" className="text-sm underline decoration-dotted underline-offset-2">Allar fréttir eftir liðum</Link>
          </div>
          <NewsList items={news} compact />
          <p className="text-[11px] muted">{NEWS_NOTE}</p>
        </section>
      )}
    </div>
  )
}
