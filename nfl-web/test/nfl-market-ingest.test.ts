import { describe, it, expect, vi } from 'vitest'

const written: { week: number; rows: { player_id: string; team: string }[] }[] = []
vi.mock('../src/lib/db', () => ({
  db: () => ({ rpc: async (_: string, a: { p_week: number; p_rows: { player_id: string; team: string }[] }) => { written.push({ week: a.p_week, rows: a.p_rows }); return { data: a.p_rows.length, error: null } } }),
}))
const Z = { passing_yards: 0, passing_tds: 0, interceptions: 0, rushing_yards: 0, rushing_tds: 0, receptions: 0, receiving_yards: 0, receiving_tds: 0, fumbles_lost: 0 }
const game = (week: number, home: string, away: string, played: boolean) => ({
  game_id: `${week}${home}${away}`, season: 2026, game_type: 'REG', week, home, away, kickoff: `2026-09-${10 + 7 * week}T17:00:00Z`,
  home_score: played ? 20 : null, away_score: played ? 17 : null,
})
const games = [game(1, 'T1', 'T2', true), game(2, 'T1', 'T3', true), game(2, 'T2', 'T4', true), game(3, 'T2', 'T3', false), game(3, 'T1', 'T4', false)]
const line = (player_id: string, g: (typeof games)[number], team: string) => ({ ...Z, receiving_yards: 100, player_id, week: g.week, team, game_id: g.game_id })
vi.mock('../src/lib/nfl/queries', () => ({
  nflSeasonGames: async () => games,
  nflMarketWeeks: async () => [],
  nflInjuries: async () => ({ week: null, rows: [] }),
  // A played both rounds for T1 and is now on T2's register; B fills the other week-2 game
  nflMarketInputs: async () => ({ lines: [line('A', games[0], 'T1'), line('A', games[1], 'T1'), line('B', games[2], 'T4')], prev: new Map(), players: [{ player_id: 'A', position: 'WR', team: 'T2' }, { player_id: 'B', position: 'WR', team: 'T4' }] }),
}))

describe('ingestMarket', () => {
  it('aðeins nýjasta lokna umferðin tekur félagið á skrá', async () => {
    const { ingestMarket } = await import('../src/lib/nfl/marketIngest')
    const r = await ingestMarket(2026, { all: true, now: new Date('2026-10-01T00:00:00Z'), injuries: async () => ({ week: null, rows: [] }) })
    expect(r.weeks).toEqual([1, 2])
    const team = (w: number) => written.find((x) => x.week === w)!.rows.find((x) => x.player_id === 'A')!.team
    expect(team(1)).toBe('T1')
    expect(team(2)).toBe('T2')
  })
})
