import { Gallery } from '@/components/Nfl/celebrate/Gallery'
import { nflCurrentSeason, nflSeasonModel } from '@/lib/nfl/queries'

export const revalidate = 3600
export const metadata = { title: 'Fagnaðir', robots: { index: false } }

/** Every club's score banner, to look them over before a Sunday. */
export default async function CelebrationsPage() {
  const season = await nflCurrentSeason().catch(() => null)
  const teams = season ? (await nflSeasonModel(season)).teams.filter((t) => t.franchise === t.abbr).sort((a, b) => a.abbr.localeCompare(b.abbr)) : []
  return <Gallery teams={teams.map((t) => ({ abbr: t.abbr, name: t.name, logo: t.logo }))} />
}
