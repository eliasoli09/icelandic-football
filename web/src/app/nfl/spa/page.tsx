import type { Metadata } from 'next'
import { PickemView } from '@/components/Nfl/Pickem/PickemView'
import { seasonForecasts } from '@/lib/nfl/forecast'
import { pickWeek } from '@/lib/nfl/pickem'
import { nflCurrentSeason, nflSeasonModel } from '@/lib/nfl/queries'
import { defaultWeek } from '@/lib/nfl/week'

export const revalidate = 300

/** ChatGPT's artwork (spec 6): switch each on once its file is in web/public/nfl/spaleikur/. */
const ART = { 'hero.webp': false, 'og.png': false }
const art = (file: keyof typeof ART) => (ART[file] ? `/nfl/spaleikur/${file}` : null)

export function generateMetadata(): Metadata {
  const og = art('og.png')
  return {
    title: 'Spáleikur NFL - Besta spáin',
    description: 'Spáðu í sigurvegara hverrar viku í NFL, kepptu við vinina og við líkanið.',
    ...(og ? { openGraph: { images: [{ url: og, width: 1200, height: 630 }] } } : {}),
  }
}

export default async function NflPickemPage() {
  try {
    const season = await nflCurrentSeason()
    if (!season) return <p className="muted">Engir leikir fundust.</p>
    const { games, teams, elo, state } = await nflSeasonModel(season)
    // the model's chance for the home side: before kickoff for played games, from today's ratings otherwise
    const pHome = Object.fromEntries(Object.entries(seasonForecasts(games, elo, state)).map(([id, f]) => [id, f.pHome]))
    const now = new Date()
    const initialWeek = pickWeek(games, now)?.week ?? defaultWeek(games, now)
    return <PickemView season={season} games={games} teams={teams} pHome={pHome} initialWeek={initialWeek} hero={art('hero.webp')} />
  } catch {
    return <p className="muted">Gagnagrunnur ekki tengdur enn.</p>
  }
}
