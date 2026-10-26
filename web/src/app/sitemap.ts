import type { MetadataRoute } from 'next'
import { seasonMatches } from '@/lib/queries'
import { SITE_URL } from '@/lib/site'
import type { League } from '@/lib/types'

export const revalidate = 3600

const PAGES = ['', '/tafla', '/leikir', '/elo', '/leikmenn', '/sludur', '/thin-spa', '/kastalinn', '/saga', '/h2h', '/kort', '/landslid', '/uefa', '/rangstada', '/stigatafla', '/vaktin', '/leikjaherbergi', '/leidin', '/vallarleit', '/hver', '/topp10', '/byrjunarlid', '/bikar', '/hausabolti']

/** The Icelandic leagues' matches this season - foreign leagues would add thousands of thin pages. */
const MATCH_LEAGUES: League[] = ['besta', 'lengjudeild']

/** Fixed pages plus every match page of the current Icelandic season. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => `${SITE_URL}${path || '/'}`
  const matches = (await Promise.all(MATCH_LEAGUES.map((l) => seasonMatches(undefined, l).catch(() => [])))).flat()
  return [
    ...PAGES.map((p) => ({ url: url(p), changeFrequency: 'daily' as const, priority: p === '' ? 1 : 0.7 })),
    ...matches.map((m) => ({ url: url(`/leikir/${m.id}`), changeFrequency: 'daily' as const, priority: 0.5 })),
  ]
}
