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

  it('a player out for the season (0 remaining games) is frozen on his current tally', () => {
    const res = simulateScorerRace(
      [
        { name: 'Meiddur', team: 'X', current: 12, perGame: 0.9, remainingTeamGames: 0 },
        { name: 'Heill', team: 'Y', current: 12, perGame: 0.9, remainingTeamGames: 12 },
      ],
      4000,
    )
    const injured = res.find((r) => r.name === 'Meiddur')!
    const healthy = res.find((r) => r.name === 'Heill')!
    expect(injured.projected).toBe(12)
    expect(healthy.pWin).toBeGreaterThan(injured.pWin)
    expect(injured.pWin).toBeLessThan(0.05)
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

  it('clean sheet rewards the back line: GK gains more than a forward on the same shutout side', () => {
    const positions = new Map([
      ['markvordur x', 'GK' as const],
      ['framherji y', 'FW' as const],
    ])
    const recs = runPlayerElo(
      [
        {
          matchId: 1, order: 1, league: 'besta', homeGoals: 1, awayGoals: 0,
          events: [
            { eventId: 1, minute: 80, type: 'sub_out', playerKsiId: 10, playerName: 'Markvörður X', side: 'home' },
            { eventId: 2, minute: 80, type: 'sub_out', playerKsiId: 11, playerName: 'Framherji Y', side: 'home' },
            { eventId: 3, minute: 30, type: 'yellow', playerKsiId: 12, playerName: 'Andstæðingur', side: 'away' },
          ],
        },
      ],
      positions,
    )
    const gk = recs.find((r) => r.playerKsiId === 10)!
    const fw = recs.find((r) => r.playerKsiId === 11)!
    const opp = recs.find((r) => r.playerKsiId === 12)!
    expect(gk.eloAfter - gk.eloBefore).toBeGreaterThan(fw.eloAfter - fw.eloBefore)
    expect(gk.eloAfter - gk.eloBefore).toBe(8 + 18) // result + GK clean sheet
    expect(opp.eloAfter - opp.eloBefore).toBeLessThan(0) // conceding side, card, loss
  })

// After round 22 Besta deild freezes into a top 6 and a bottom 6. The halves
// play on for points but never meet again, so a lower-half club cannot reach
// the top six and an upper-half club cannot be relegated — no matter what the
// remaining results are.
describe('simulateSeason — frozen split halves', () => {
  const upper = ['A', 'B', 'C', 'D', 'E', 'F']
  const lower = ['G', 'H', 'I', 'J', 'K', 'L']
  const groups = new Map<string, 'efri' | 'nedri'>([
    ...upper.map((n) => [n, 'efri'] as const),
    ...lower.map((n) => [n, 'nedri'] as const),
  ])
  // single round robin inside each half — the real shape of the split rounds
  const halfFixtures = (g: string[]) =>
    g.flatMap((h, i) => g.slice(i + 1).map((a) => ({ home: h, away: a })))
  const fixtures = [...halfFixtures(upper), ...halfFixtures(lower)]

  // G is a runaway lower-half side: more points and a far better team than
  // anyone above it. Ranking on points alone would float it into the top six.
  const teams = [
    ...upper.map((n, i) => team(n, 1450, 30 - i * 2, 22)),
    team('G', 1900, 60, 22),
    ...lower.slice(1).map((n, i) => team(n, 1350, 20 - i * 2, 22)),
  ]
  const res = simulateSeason(teams, fixtures, 600, 42, { split: true, upSlots: 3, groups })

  it('never lets a lower-half club finish in the top six', () => {
    for (const n of lower) {
      const r = res.find((x) => x.team === n)!
      const topSix = r.posProbs.slice(0, 6).reduce((a, b) => a + b, 0)
      expect(topSix).toBe(0)
    }
    const g = res.find((x) => x.team === 'G')!
    expect(g.posProbs[6]).toBeGreaterThan(0.9) // runaway still wins its half → 7th
  })

  it('gives every upper-half club a top-six finish and no relegation risk', () => {
    for (const n of upper) {
      const r = res.find((x) => x.team === n)!
      expect(r.posProbs.slice(0, 6).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5)
      expect(r.pRelegation).toBe(0)
    }
  })

  it('keeps relegation inside the lower half', () => {
    const total = lower.reduce((s, n) => s + res.find((x) => x.team === n)!.pRelegation, 0)
    expect(total).toBeCloseTo(2, 5)
  })
})

// "Stigaspá": where each club is expected to finish on points, with a range
// so the number is not read as a certainty.
describe('simulateSeason — points projection', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

  it('a finished season projects exactly the points already won', () => {
    const teams = names.map((n, i) => team(n, 1500, 40 - i, 27))
    const res = simulateSeason(teams, [], 200, 3, { split: false })
    for (const r of res) {
      const cur = teams.find((t) => t.team === r.team)!.points
      expect(r.projectedPoints).toBe(cur)
      expect(r.pointsLow).toBe(cur)
      expect(r.pointsHigh).toBe(cur)
    }
  })

  it('never projects fewer points than a club already has, nor more than a clean sweep', () => {
    const teams = names.map((n, i) => team(n, 1500, 30 - i, 22))
    const fixtures = [
      { home: 'A', away: 'B' }, { home: 'C', away: 'D' }, { home: 'E', away: 'F' },
      { home: 'G', away: 'H' }, { home: 'I', away: 'J' }, { home: 'K', away: 'L' },
    ]
    const res = simulateSeason(teams, fixtures, 500, 11, { split: false })
    for (const r of res) {
      const cur = teams.find((t) => t.team === r.team)!.points
      expect(r.projectedPoints).toBeGreaterThanOrEqual(cur)
      expect(r.projectedPoints).toBeLessThanOrEqual(cur + 3)
      expect(r.pointsLow).toBeLessThanOrEqual(r.projectedPoints)
      expect(r.pointsHigh).toBeGreaterThanOrEqual(r.projectedPoints)
    }
  })

  it('projects more points for the stronger side from the same base', () => {
    const teams = names.map((n) => team(n, n === 'A' ? 1900 : n === 'B' ? 1300 : 1500, 30, 22))
    const fixtures = names.flatMap((h) =>
      names.filter((a) => a !== h).slice(0, 1).map((a) => ({ home: h, away: a })),
    )
    const res = simulateSeason(teams, fixtures, 1000, 5, { split: false })
    const a = res.find((r) => r.team === 'A')!
    const b = res.find((r) => r.team === 'B')!
    expect(a.projectedPoints).toBeGreaterThan(b.projectedPoints)
  })
})
