import { describe, expect, it } from 'vitest'
import { filterClubs, filterMatches } from './catalog'
import type { AtlasClub, AtlasMatch } from '@/lib/atlas/geo'

const clubs = [
  { id: 1, name: 'Þór', fullName: 'Íþróttafélagið Þór', city: 'Akureyri', stadium: 'Þórsvöllur', league: 'besta' },
  { id: 2, name: 'ÍBV', fullName: 'ÍBV', city: 'Vestmannaeyjar', stadium: 'Hásteinsvöllur', league: 'besta' },
  { id: 3, name: 'Fylkir', fullName: 'Fylkir', city: 'Reykjavík', stadium: 'Fylkisvöllur', league: 'lengju' },
] as AtlasClub[]
const fixtures: AtlasMatch[] = [
  { id: 11, home_team: 1, away_team: 2, league: 'besta', date: '2026-05-01T18:00:00Z', venue: 'Hásteinsvöllur' },
  { id: 12, home_team: 2, away_team: 1, league: 'besta', date: null },
  { id: 13, home_team: 3, away_team: 3, league: 'lengju', date: '2026-06-01T18:00:00Z' },
]

describe('atlas catalogue', () => {
  it('finds clubs by an unaccented town or Icelandic club name', () => {
    expect(filterClubs(clubs, 'all', 'akureyri').map(c => c.id)).toEqual([1])
    expect(filterClubs(clubs, 'all', 'thor').map(c => c.id)).toEqual([1])
    expect(filterClubs(clubs, 'all', 'hasteinsvollur').map(c => c.id)).toEqual([2])
  })

  it('keeps league filtering independent of the global league selection', () => {
    expect(filterClubs(clubs, 'lengju', '').map(c => c.id)).toEqual([3])
    expect(filterClubs(clubs, 'all', '')).toHaveLength(3)
  })

  it('finds both home and away fixtures, including an undated fixture', () => {
    expect(filterMatches(fixtures, clubs, 'all', 'thor').map(m => m.id)).toEqual([11, 12])
    expect(filterMatches(fixtures, clubs, 'all', '', 1).map(m => m.id)).toEqual([11, 12])
  })

  it('combines league, search, and selected club filters without inventing rows', () => {
    expect(filterMatches(fixtures, clubs, 'lengju', 'thor')).toEqual([])
    expect(filterMatches(fixtures, clubs, 'all', '2026-05')).toEqual([fixtures[0]])
    expect(filterMatches([], clubs, 'all', '')).toEqual([])
  })
})
