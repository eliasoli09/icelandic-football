import { describe, it, expect } from 'vitest'
import { buildEuropeanScale, type RatedMatch } from '../src/lib/uefaRating'

const LEAGUE_A = 1, LEAGUE_B = 2, CONT = 99, CUP = 50
const cont = (id: number) => id === CONT
const isLeague = (id: number) => id === LEAGUE_A || id === LEAGUE_B

/** a double round robin inside one league, with a fixed pecking order */
function domesticSeason(league: number, clubs: number[], year: number, strongWins: boolean): RatedMatch[] {
  const out: RatedMatch[] = []
  let day = 1
  for (const h of clubs) for (const a of clubs) {
    if (h === a) continue
    const better = strongWins ? h < a : false
    out.push({
      date: `${year}-${String(1 + (day % 11)).padStart(2, '0')}-${String(1 + (day % 27)).padStart(2, '0')}`,
      league, home: h, away: a,
      homeGoals: better ? 2 : 1, awayGoals: better ? 0 : 1,
    })
    day++
  }
  return out
}

describe('buildEuropeanScale', () => {
  const clubsA = [1, 2, 3, 4], clubsB = [11, 12, 13, 14]
  const base = [
    ...domesticSeason(LEAGUE_A, clubsA, 2024, true),
    ...domesticSeason(LEAGUE_B, clubsB, 2024, true),
  ].sort((x, y) => x.date.localeCompare(y.date))

  it('says nothing about two leagues that have never met', () => {
    const s = buildEuropeanScale(base, cont, isLeague)
    expect(s.bridged).toBe(0)
    expect(s.league.get(LEAGUE_A) ?? 1500).toBe(s.league.get(LEAGUE_B) ?? 1500)
  })

  // The whole point: only a match that crossed a border can separate leagues.
  it('separates two leagues once their clubs meet, in the direction of the results', () => {
    const ties: RatedMatch[] = []
    for (let i = 0; i < 30; i++) {
      ties.push({ date: `2025-06-${String(1 + (i % 28)).padStart(2, '0')}`, league: CONT,
        home: clubsA[i % 4], away: clubsB[i % 4], homeGoals: 3, awayGoals: 0 })
    }
    const s = buildEuropeanScale([...base, ...ties], cont, isLeague)
    expect(s.bridged).toBe(30)
    expect(s.league.get(LEAGUE_A)!).toBeGreaterThan(s.league.get(LEAGUE_B)!)
  })

  it('ranks clubs inside a league by their own results', () => {
    const s = buildEuropeanScale(base, cont, isLeague)
    expect(s.club.get(1)!).toBeGreaterThan(s.club.get(2)!)
    expect(s.club.get(2)!).toBeGreaterThan(s.club.get(3)!)
    expect(s.club.get(3)!).toBeGreaterThan(s.club.get(4)!)
  })

  it('centres each league on its own strength, so the two scales are comparable', () => {
    const ties: RatedMatch[] = []
    for (let i = 0; i < 30; i++) {
      ties.push({ date: `2025-06-${String(1 + (i % 28)).padStart(2, '0')}`, league: CONT,
        home: clubsA[i % 4], away: clubsB[i % 4], homeGoals: 3, awayGoals: 0 })
    }
    const s = buildEuropeanScale([...base, ...ties], cont, isLeague)
    const meanA = clubsA.reduce((x, c) => x + s.club.get(c)!, 0) / clubsA.length
    const meanB = clubsB.reduce((x, c) => x + s.club.get(c)!, 0) / clubsB.length
    expect(meanA).toBeCloseTo(s.league.get(LEAGUE_A)!, 6)
    expect(meanB).toBeCloseTo(s.league.get(LEAGUE_B)!, 6)
    expect(meanA).toBeGreaterThan(meanB)
  })

  it('does not let a cup decide which league a club belongs to', () => {
    const withCup: RatedMatch[] = [...base,
      { date: '2025-03-01', league: CUP, home: 1, away: 11, homeGoals: 1, awayGoals: 0 }]
    const s = buildEuropeanScale(withCup, cont, isLeague)
    expect(s.leagueOf.get(1)).toBe(LEAGUE_A)
    expect(s.leagueOf.get(11)).toBe(LEAGUE_B)
  })

  it('ignores a continental tie between two clubs of the same league', () => {
    const sameLeague: RatedMatch[] = [...base,
      { date: '2025-06-01', league: CONT, home: 1, away: 2, homeGoals: 5, awayGoals: 0 }]
    const s = buildEuropeanScale(sameLeague, cont, isLeague)
    expect(s.bridged).toBe(0)
  })

  it('gives a club nobody has seen no rating at all, rather than a made-up one', () => {
    const s = buildEuropeanScale(base, cont, isLeague)
    expect(s.club.has(999)).toBe(false)
    expect(s.leagueOf.has(999)).toBe(false)
  })
})

// A continental tie says something about the two clubs, not only their two
// leagues. Before this, a club could take Europe apart without it ever
// reaching its own rating.
describe('continental ties reach the clubs', () => {
  const A = 1, B = 2
  const clubsA = [1, 2, 3, 4], clubsB = [11, 12, 13, 14]
  const cont = (id: number) => id === 99
  const isLeague = (id: number) => id === A || id === B
  const season = (league: number, clubs: number[]) => {
    const out = []
    let day = 1
    for (const h of clubs) for (const a of clubs) {
      if (h === a) continue
      out.push({
        date: `2024-${String(1 + (day % 11)).padStart(2, '0')}-${String(1 + (day % 27)).padStart(2, '0')}`,
        league, home: h, away: a, homeGoals: 1, awayGoals: 1,
      })
      day++
    }
    return out
  }
  const base = [...season(A, clubsA), ...season(B, clubsB)].sort((x, y) => x.date.localeCompare(y.date))

  it('lifts a club that beats another league, above its own league-mates', () => {
    const ties = Array.from({ length: 12 }, (_, i) => ({
      date: `2025-06-${String(1 + (i % 28)).padStart(2, '0')}`,
      league: 99, home: 1, away: clubsB[i % 4], homeGoals: 4, awayGoals: 0,
    }))
    const s = buildEuropeanScale([...base, ...ties], cont, isLeague)
    // every club in league A drew every domestic match, so only Europe separates them
    expect(s.club.get(1)!).toBeGreaterThan(s.club.get(2)!)
    expect(s.club.get(1)!).toBeGreaterThan(s.club.get(3)!)
  })

  it('separates clubs by Europe far more than by a home-advantage drift', () => {
    const ties = Array.from({ length: 12 }, (_, i) => ({
      date: `2025-06-${String(1 + (i % 28)).padStart(2, '0')}`,
      league: 99, home: 1, away: clubsB[i % 4], homeGoals: 4, awayGoals: 0,
    }))
    const s = buildEuropeanScale([...base, ...ties], cont, isLeague)
    // 2 and 3 never left home; all-draw seasons still drift them a little apart
    // because the home side is always the favourite
    const drift = Math.abs(s.club.get(2)! - s.club.get(3)!)
    const europe = s.club.get(1)! - s.club.get(2)!
    expect(drift).toBeLessThan(2)
    expect(europe).toBeGreaterThan(drift * 20)
  })
})
