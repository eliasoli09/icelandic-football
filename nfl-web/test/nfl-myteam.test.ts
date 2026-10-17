import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseGames, parseTeams } from '../src/lib/nfl/csv'
import { runElo, NFL_ELO } from '../src/lib/nfl/elo'
import { seasonForecasts } from '../src/lib/nfl/forecast'
import { teamCards } from '../src/lib/nfl/myteam'

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf-8')
const games = parseGames(fx('nfl-2025.csv')).map((g) => (g.week >= 5 ? { ...g, home_score: null, away_score: null } : g))
const teams = parseTeams(fx('nfl-teams.csv'))
const run = runElo(games, NFL_ELO)

describe('teamCards', () => {
  const cards = teamCards(games, teams, seasonForecasts(games, run.rows, run.state), [
    { url: 'u1', source: 'ESPN', published_at: '2025-10-01T00:00:00Z', teams: ['KC'], title_is: 'Chiefs-frétt', summary_is: '' },
  ])
  const kc = cards.find((c) => c.abbr === 'KC')!
  it('eitt spjald á félag, met, næsti og síðasti leikur', () => {
    expect(cards).toHaveLength(32)
    expect(kc.record).toMatch(/^\d+-\d+/)
    expect(kc.next).not.toBeNull()
    expect(kc.next!.p).toBeGreaterThan(0)
    expect(kc.last).not.toBeNull()
    expect(kc.news?.title_is).toBe('Chiefs-frétt')
  })
  it('líkur liðsins eru frá sjónarhóli þess, hvort sem það er heima eða úti', () => {
    const f = seasonForecasts(games, run.rows, run.state)[kc.next!.game_id]
    expect(kc.next!.p).toBeCloseTo(kc.next!.home ? f.pHome : 1 - f.pHome, 12)
  })
})
