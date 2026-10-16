import type { MetadataRoute } from 'next'
import { nflArticles } from '@/lib/nfl/articles/queries'
import { nflCurrentSeason, nflSeasonGames } from '@/lib/nfl/queries'
import { SITE_URL } from '@/lib/site'

export const revalidate = 3600

const PAGES = ['', '/stada', '/styrkleiki', '/urslitakeppni', '/leikmenn', '/verdlaun', '/frettir', '/spa', '/greinar', '/um']

/** Fixed pages, every published article and this season's games. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => `${SITE_URL}${path}`
  const [articles, season] = await Promise.all([nflArticles({ limit: 1000 }).catch(() => []), nflCurrentSeason().catch(() => null)])
  const games = season ? await nflSeasonGames(season).catch(() => []) : []
  return [
    ...PAGES.map((p) => ({ url: url(p || '/'), changeFrequency: 'daily' as const, priority: p === '' ? 1 : 0.7 })),
    ...articles.map((a) => ({ url: url(`/grein/${a.slug}`), lastModified: a.updated_at, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...games.map((g) => ({ url: url(`/leikur/${g.game_id}`), changeFrequency: 'daily' as const, priority: 0.5 })),
  ]
}
