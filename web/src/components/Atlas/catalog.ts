import type { AtlasClub, AtlasMatch } from '@/lib/atlas/geo'

export type AtlasLeague = 'all' | 'besta' | 'lengju'

function searchable(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/þ/g, 'th').replace(/ð/g, 'd').replace(/æ/g, 'ae').trim()
}

function clubText(club: AtlasClub): string {
  return `${club.name} ${club.fullName} ${club.city} ${club.stadium}`
}

export function filterClubs(clubs: AtlasClub[], league: AtlasLeague, query: string): AtlasClub[] {
  const needle = searchable(query)
  return clubs.filter(club => (league === 'all' || club.league === league) && searchable(clubText(club)).includes(needle))
}

export function filterMatches(matches: AtlasMatch[], clubs: AtlasClub[], league: AtlasLeague, query: string, clubId?: number): AtlasMatch[] {
  const byId = new Map(clubs.map(club => [club.id, clubText(club)]))
  const needle = searchable(query)
  return matches.filter(match =>
    (league === 'all' || match.league === league)
    && (clubId === undefined || match.home_team === clubId || match.away_team === clubId)
    && searchable(`${byId.get(match.home_team) ?? ''} ${byId.get(match.away_team) ?? ''} ${match.venue ?? ''} ${match.date ?? ''}`).includes(needle),
  )
}
