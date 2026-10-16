import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseGames } from '../src/lib/nfl/csv'
import { runElo, predictGame, NFL_ELO } from '../src/lib/nfl/elo'
import { seasonForecasts } from '../src/lib/nfl/forecast'

const games = parseGames(readFileSync(join(__dirname, 'fixtures', 'nfl-2025.csv'), 'utf-8'))

describe('seasonForecasts', () => {
  it('spilaður leikur fær líkurnar sem líkanið gaf fyrir leik', () => {
    const run = runElo(games, NFL_ELO)
    const f = seasonForecasts(games, run.rows, run.state)
    const rec = run.records.find((r) => r.game_id === '2025_05_HOU_BAL')!
    expect(f['2025_05_HOU_BAL']).toMatchObject({ played: true, pHome: rec.pHome, spread: null })
  })
  it('óspilaður leikur fær spá úr nýjustu einkunnum og merki um nýjan leikstjórnanda', () => {
    // pretend BAL's week-5 game has not been played yet
    const open = games.map((g) => (g.game_id === '2025_05_HOU_BAL' ? { ...g, home_score: null, away_score: null } : g))
    const run = runElo(open, NFL_ELO)
    const f = seasonForecasts(open, run.rows, run.state)['2025_05_HOU_BAL']
    const g = open.find((x) => x.game_id === '2025_05_HOU_BAL')!
    expect(f.played).toBe(false)
    expect(f.pHome).toBe(predictGame(g, run.state).pHome)
    expect(f.newQb?.home).toEqual({ qb: 'Cooper Rush', usual: 'Lamar Jackson' })
    expect(f.newQb?.away).toBeNull()
  })
})
