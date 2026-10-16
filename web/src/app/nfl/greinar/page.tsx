import { ArticleList } from '@/components/Nfl/ArticleList'
import { nflArticles } from '@/lib/nfl/articles/queries'

export const revalidate = 300
export const metadata = {
  title: 'Greinar um NFL - Besta spáin',
  description: 'Upphitun fyrir hverja umferð, umfjöllun eftir leiki og vikan í hnotskurn, á íslensku.',
}

export default async function NflArticlesPage() {
  const items = await nflArticles({ limit: 60 }).catch(() => [])
  return (
    <div className="grid gap-5">
      <header className="grid gap-1">
        <h2 className="display text-3xl font-extrabold tracking-tight">Greinar</h2>
        <p className="muted text-sm">Upphitun fyrir hverja umferð, umfjöllun eftir leiki og vikan í hnotskurn.</p>
      </header>
      {items.length ? <ArticleList items={items} /> : <p className="muted">Engar greinar birtar enn.</p>}
    </div>
  )
}
