import type { Metadata } from 'next'
import { AtlasView } from '@/components/Atlas/AtlasView'
import clubsData from '@/lib/atlas/clubs.json'
import { atlasFixtures, type AtlasClub, type AtlasMatch } from '@/lib/atlas/geo'
import { seasonMatches } from '@/lib/queries'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Heimavellir Íslands - Besta spáin',
  description: 'Kannaðu heimavelli 24 félaga í Bestu deild og Lengjudeild karla 2026 á gagnvirku Íslandskorti. Félögin, sögurnar og vegalengdirnar á milli þeirra.',
}

export default async function KortPage() {
  const clubs = clubsData as AtlasClub[]
  let matches: AtlasMatch[] = []
  let fixtureMessage: string | null = null
  try {
    const results = await Promise.allSettled([seasonMatches(2026, 'besta'), seasonMatches(2026, 'lengjudeild')])
    const rows = results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
    matches = atlasFixtures(rows, clubs.map(club => club.id)).map(match => ({
      id: match.id,
      home_team: match.home_team,
      away_team: match.away_team,
      date: match.date,
      league: match.league === 'lengjudeild' ? 'lengju' : match.league,
      venue: match.venue,
      status: match.status,
    })).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))
    if (results.some(result => result.status === 'rejected')) {
      fixtureMessage = 'Ekki tókst að sækja alla leiki. Félögin og heimavellirnir eru áfram aðgengilegir.'
    } else if (!matches.length) {
      fixtureMessage = 'Leikjagögn 2026 eru ekki aðgengileg í augnablikinu. Félögin og heimavellirnir eru áfram aðgengilegir.'
    } else if (results.some(result => result.status === 'fulfilled' && !result.value.length)) {
      fixtureMessage = 'Leikjagögn vantar fyrir aðra deildina í augnablikinu. Öll félögin eru áfram aðgengileg.'
    }
  } catch {
    fixtureMessage = 'Ekki tókst að tengjast leikjagögnum. Félögin og heimavellirnir eru áfram aðgengilegir.'
  }
  return <AtlasView clubs={clubs} matches={matches} fixtureMessage={fixtureMessage} />
}
