import { describe, it, expect } from 'vitest'
import { simulateSeason, simulateScorerRace, type SimTeamState } from '../src/lib/simulate'
import { runPlayerElo } from '../src/lib/playerElo'
import type { MatchEvent } from '../src/lib/types'

const team = (name: string, elo: number, points = 0, played = 22): SimTeamState => ({
  team: name,
  elo,
  rates: null,
  points,
  goalsFor: played,
  goalsAgainst: played,
  played,
})

describe('simulateSeason', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

  it('a dominant team wins the title almost always', () => {
    const teams = names.map((n, i) =>
      team(n, n === 'A' ? 1900 : 1400, n === 'A' ? 60 : 30 - i, 22),
    )
    const res = simulateSeason(teams, [], 2000)
    const a = res.find((r) => r.team === 'A')!
    expect(a.pTitle).toBeGreaterThan(0.95)
    expect(a.pRelegation).toBe(0)
  })

  it('position probabilities sum to 1 per team', () => {
    const teams = names.map((n, i) => team(n, 1500, 30 - i, 22))
    const res = simulateSeason(teams, [], 500)
    for (const r of res) {
      const sum = r.posProbs.reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1, 6)
    }
  })

  it('is deterministic for a fixed seed', () => {
    const teams = names.map((n, i) => team(n, 1450 + i * 10, 20 + i, 22))
    const r1 = simulateSeason(teams, [{ home: 'A', away: 'B' }], 300, 7)
    const r2 = simulateSeason(teams, [{ home: 'A', away: 'B' }], 300, 7)
    expect(r1).toEqual(r2)
  })
})

describe('simulateScorerRace', () => {
  it('a big lead with equal pace wins most of the time', () => {
    const res = simulateScorerRace(
      [
        { name: 'Leader', team: 'X', current: 15, perGame: 0.8, remainingTeamGames: 8 },
        { name: 'Chaser', team: 'Y', current: 9, perGame: 0.8, remainingTeamGames: 8 },
      ],
      4000,
    )
    const leader = res.find((r) => r.name === 'Leader')!
    expect(leader.pWin).toBeGreaterThan(0.8)
    expect(leader.projected).toBeGreaterThan(19)
  })
})

describe('runPlayerElo', () => {
  const ev = (
    type: MatchEvent['type'],
    playerKsiId: number,
    side: 'home' | 'away',
  ): MatchEvent => ({
    eventId: Math.random() * 1e6,
    minute: 50,
    type,
    playerKsiId,
    playerName: `P${playerKsiId}`,
    side,
  })

  it('scorer on winning side gains more than carded player on losing side', () => {
    const recs = runPlayerElo([
      {
        matchId: 1,
        order: 1,
        league: 'besta',
        homeGoals: 2,
        awayGoals: 0,
        events: [ev('goal', 1, 'home'), ev('yellow', 2, 'away')],
      },
    ])
    const scorer = recs.find((r) => r.playerKsiId === 1)!
    const carded = recs.find((r) => r.playerKsiId === 2)!
    expect(scorer.eloAfter - scorer.eloBefore).toBeGreaterThan(0)
    expect(carded.eloAfter - carded.eloBefore).toBeLessThan(0)
    expect(scorer.eloAfter - scorer.eloBefore).toBeGreaterThan(
      carded.eloAfter - carded.eloBefore,
    )
  })

  it('a Lengjudeild goal is worth less than a Besta deild goal, from a lower base', () => {
    const besta = runPlayerElo([
      { matchId: 1, order: 1, league: 'besta', homeGoals: 1, awayGoals: 0,
        events: [ev('goal', 1, 'home')] },
    ])
    const lengju = runPlayerElo([
      { matchId: 1, order: 1, league: 'lengjudeild', homeGoals: 1, awayGoals: 0,
        events: [ev('goal', 1, 'home')] },
    ])
    const b = besta[0], l = lengju[0]
    expect(b.eloBefore).toBe(1500)
    expect(l.eloBefore).toBe(1400)
    expect(b.eloAfter - b.eloBefore).toBeGreaterThan(l.eloAfter - l.eloBefore)
  })

  it('red card is net negative even in a win', () => {
    const recs = runPlayerElo([
      {
        matchId: 1,
        order: 1,
        league: 'besta',
        homeGoals: 3,
        awayGoals: 0,
        events: [ev('red', 5, 'home')],
      },
    ])
    const r = recs.find((x) => x.playerKsiId === 5)!
    expect(r.eloAfter).toBeLessThan(r.eloBefore)
  })
})
