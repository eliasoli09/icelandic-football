import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { computeStandings, pct } from '../src/lib/nfl/standings'
import { parseGames, parseTeams } from '../src/lib/nfl/csv'
import type { NflGame, NflTeam } from '../src/lib/nfl/types'

const team = (abbr: string, division: NflTeam['division'] = 'East', conference: NflTeam['conference'] = 'AFC') =>
  ({ abbr, franchise: abbr, name: abbr, conference, division, color: '', color2: '', logo: '' }) as NflTeam
let n = 0
const game = (home: string, hs: number, away: string, as: number) =>
  ({ game_id: `g${n++}`, game_type: 'REG', week: 1, kickoff: `2026-09-${String(10 + (n % 18)).padStart(2, '0')}T17:00:00.000Z`, home, away, home_score: hs, away_score: as }) as NflGame

describe('pct', () => {
  it('jafntefli er hálfur sigur', () => {
    expect(pct({ w: 1, l: 0, t: 1 })).toBe(0.75)
    expect(pct({ w: 0, l: 0, t: 0 })).toBe(0)
  })
})

describe('tilbúin dæmi', () => {
  const east = ['A', 'B', 'C', 'D'].map((a) => team(a))
  const others = ['E', 'F', 'G', 'H'].map((a) => team(a, 'North'))
  const teams = [...east, ...others]

  it('innbyrðis viðureignir ráða milli tveggja jafnra liða', () => {
    const s = computeStandings([game('A', 10, 'B', 20), game('A', 30, 'E', 0), game('B', 0, 'F', 3)], teams)
    const div = s.divisions.AFC.East.map((r) => [r.abbr, r.reason])
    expect(div.slice(0, 2)).toEqual([['B', 'h2h'], ['A', 'h2h']])
  })

  it('stigamismunur þegar liðin hafa ekki mæst og allt annað er jafnt', () => {
    const s = computeStandings([game('A', 30, 'E', 0), game('B', 10, 'F', 0)], teams)
    expect(s.divisions.AFC.East.slice(0, 2).map((r) => [r.abbr, r.reason])).toEqual([['A', 'diff'], ['B', 'diff']])
  })

  it('stafróf þegar ekkert skilur á milli', () => {
    const s = computeStandings([], teams)
    expect(s.divisions.AFC.East.map((r) => r.abbr)).toEqual(['A', 'B', 'C', 'D'])
    expect(s.divisions.AFC.East[0].reason).toBe('alpha')
  })

  it('þrjú jöfn lið: eitt skilur sig frá, hin tvö byrja aftur á fyrsta viðmiði', () => {
    // A, B, C all 2-1-1. Inside the group A is 2-0, B and C drew each other.
    // B and C restart as a pair: drew head-to-head, same division and conference
    // records, so points difference decides (B +20, C +10).
    const games = [
      game('A', 10, 'B', 0), game('A', 10, 'C', 0), game('B', 10, 'C', 10),
      game('E', 10, 'A', 0), game('A', 3, 'F', 3),
      game('B', 10, 'G', 0), game('B', 20, 'H', 0), game('C', 10, 'G', 0), game('C', 10, 'H', 0),
    ]
    const s = computeStandings(games, teams)
    expect(s.divisions.AFC.East.slice(0, 3).map((r) => [r.abbr, r.reason])).toEqual([['A', 'h2h'], ['B', 'diff'], ['C', 'diff']])
    expect(s.records.A).toMatchObject({ w: 2, l: 1, t: 1, div: { w: 2, l: 0, t: 0 } })
  })

  it('runa les síðustu leiki', () => {
    const s = computeStandings([game('A', 10, 'B', 0), game('A', 10, 'C', 0), game('D', 10, 'A', 0)], teams)
    expect(s.records.A.streak).toBe('T1')
    expect(s.records.B.streak).toBe('T1')
  })
})

describe('mæling: lokastaða 2025 gegn úrslitakeppninni sjálfri', () => {
  const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf-8')
  const games = parseGames(fx('nfl-2025.csv'))
  const teams = parseTeams(fx('nfl-teams.csv')).filter((t) => t.franchise === t.abbr)
  const s = computeStandings(games.filter((g) => g.game_type === 'REG'), teams)
  const wc = games.filter((g) => g.game_type === 'WC')
  const div = games.filter((g) => g.game_type === 'DIV')

  for (const conf of ['AFC', 'NFC'] as const) {
    it(`${conf}: sömu sjö lið og í raun komust áfram`, () => {
      const confTeams = new Set(teams.filter((t) => t.conference === conf).map((t) => t.abbr))
      const inWc = wc.flatMap((g) => [g.home, g.away]).filter((a) => confTeams.has(a))
      const bye = div.map((g) => g.home).filter((a) => confTeams.has(a) && !inWc.includes(a))
      expect(bye).toHaveLength(1)
      const actual = new Set([...inWc, ...bye])
      const ours = s.seeds[conf].slice(0, 7).map((r) => r.abbr)
      expect(new Set(ours)).toEqual(actual)
      // seed 1 had the bye; each wild-card game paired seeds summing to 9, the better seed at home
      expect(ours[0]).toBe(bye[0])
      for (const g of wc.filter((x) => confTeams.has(x.home))) {
        const h = ours.indexOf(g.home) + 1
        const a = ours.indexOf(g.away) + 1
        expect([g.home, h, g.away, a, h + a]).toEqual([g.home, h, g.away, a, 9])
        expect(h).toBeLessThan(a)
      }
    })
  }
})
