import { describe, it, expect } from 'vitest'
import { applyPicks, decodePicks, encodePicks, fillWithFavourites, fromPlain, openGames, toPlain } from '../src/lib/nfl/machine'
import type { NflGame } from '../src/lib/nfl/types'

const g = (id: string, kickoff: string, scores: [number | null, number | null] = [null, null]) => ({
  game_id: id, season: 2026, game_type: 'REG', week: 7, kickoff, home: 'H' + id, away: 'A' + id, away_score: scores[0], home_score: scores[1],
} as unknown as NflGame)

const season = [g('1', '2026-10-25T17:00:00Z'), g('2', '2026-10-18T17:00:00Z', [10, 20]), g('3', '2026-10-26T00:20:00Z'), g('4', '2026-10-25T17:00:00Z')]

describe('umspilsvélin', () => {
  it('only open regular-season games can be picked, in kickoff order', () => {
    expect(openGames(season).map((x) => x.game_id)).toEqual(['1', '4', '3'])
  })
  it('turns picks into results and leaves played games alone', () => {
    const out = applyPicks(season, { 1: 'A', 2: 'H', 3: 'H' })
    expect([out[0].away_score, out[0].home_score]).toEqual([1, 0])
    expect([out[1].away_score, out[1].home_score]).toEqual([10, 20])
    expect([out[2].away_score, out[2].home_score]).toEqual([0, 1])
    expect(out[3].home_score).toBeNull()
  })
  it('fills the rest with the favourite', () => {
    expect(fillWithFavourites(season, { 1: 'A' }, (x) => (x.game_id === '4' ? 0.3 : 0.7))).toEqual({ 1: 'A', 4: 'A', 3: 'H' })
  })
  it('round-trips picks through a link', () => {
    const open = openGames(season)
    const picks = { 1: 'H', 3: 'A' } as const
    const code = encodePicks(open, picks)
    expect(code).toBe('h-a')
    expect(decodePicks(open, code)).toEqual(picks)
  })
  it('sends the Elo state as plain JSON and back', () => {
    const s = { ratings: new Map([['KC', 1600]]), lastSeason: new Map([['KC', 2026]]), scheduled: new Set(['2026:7:KC', '2025:1:KC']), params: { K: 20, HFA: 40, R: 0.4, BYE: 35 } }
    const back = fromPlain(JSON.parse(JSON.stringify(toPlain(s, 2026))))
    expect(back.ratings.get('KC')).toBe(1600)
    expect([...back.scheduled]).toEqual(['2026:7:KC'])
  })
})
