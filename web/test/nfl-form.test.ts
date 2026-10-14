import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseGames } from '../src/lib/nfl/csv'
import { runElo, NFL_ELO } from '../src/lib/nfl/elo'
import { teamForm } from '../src/lib/nfl/form'

const games = parseGames(readFileSync(join(__dirname, 'fixtures', 'nfl-2025.csv'), 'utf-8'))
const elo = runElo(games, NFL_ELO).rows

describe('teamForm', () => {
  it('fyrir fyrsta leik: ekkert að baki', () => {
    const first = games.filter((g) => g.home === 'SEA' || g.away === 'SEA').sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0]
    expect(teamForm('SEA', first.kickoff, games, elo)).toEqual({ record: { w: 0, l: 0, t: 0 }, last5: [], eloChange5: null })
  })
  it('telur aðeins leiki fyrir upphaf og síðustu fimm í tímaröð, nýjasti síðast', () => {
    const sb = games.find((g) => g.game_type === 'SB')!
    const f = teamForm('SEA', sb.kickoff, games, elo)
    expect(f.record.w + f.record.l + f.record.t).toBe(17) // regular season only
    expect(f.last5).toHaveLength(5)
    const sea = elo.filter((r) => r.team === 'SEA')
    const five = sea.slice(-6, -1) // the five before the Super Bowl itself
    expect(f.eloChange5).toBeCloseTo(five[4].elo_after - five[0].elo_before, 9)
  })
})
