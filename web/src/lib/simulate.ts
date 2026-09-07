import { predictMatch, samplePoisson, type TeamSeasonRates } from './predict'
import type { SplitGroup } from './split'

/** Deterministic RNG (mulberry32) so simulations are reproducible/testable. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SimTeamState {
  team: string
  elo: number
  rates: TeamSeasonRates | null
  points: number
  goalsFor: number
  goalsAgainst: number
  played: number
}

export interface SimFixture {
  home: string
  away: string
}

export interface SeasonSimResult {
  team: string
  posProbs: number[] // index 0 = 1st place
  pTitle: number
  pEurope: number // top 3 (approximation, documented)
  pRelegation: number // bottom 2
  projectedPoints: number // mean final points across runs
  pointsLow: number // 10th percentile — a bad run of results
  pointsHigh: number // 90th percentile — a good one
}

const REGULAR_ROUNDS_GAMES = 22

/**
 * Simulate the rest of a Besta deild season N times.
 * Remaining regular fixtures are played; if the split phase hasn't happened,
 * the table after 22 rounds splits top 6 / bottom 6, each group playing a
 * single round robin (5 games, points carried). Home side in split games is
 * random — the real KSÍ schedule isn't known in advance.
 */
export function simulateSeason(
  teams: SimTeamState[],
  remainingRegular: SimFixture[],
  runs = 10000,
  seed = 20260706,
  opts: {
    split?: boolean
    upSlots?: number
    /**
     * Frozen split halves, once KSÍ has published them. The halves never meet
     * again, so they are ranked separately — the upper half takes places 1–6
     * and the lower half 7–12 however the points fall. When this is set the
     * caller is expected to pass the real split fixtures in `remainingRegular`,
     * so no synthetic split round is generated.
     */
    groups?: Map<string, SplitGroup> | null
  } = {},
): SeasonSimResult[] {
  const { split = true, upSlots = 3, groups = null } = opts
  const rand = mulberry32(seed)
  const n = teams.length
  const posCounts = new Map<string, number[]>()
  const ptsSum = new Map<string, number>()
  const ptsHist = new Map<string, Map<number, number>>()
  for (const t of teams) {
    posCounts.set(t.team, Array(n).fill(0))
    ptsSum.set(t.team, 0)
    ptsHist.set(t.team, new Map())
  }

  for (let run = 0; run < runs; run++) {
    const state = new Map(
      teams.map((t) => [
        t.team,
        { pts: t.points, gf: t.goalsFor, ga: t.goalsAgainst, played: t.played },
      ]),
    )
    const eloOf = new Map(teams.map((t) => [t.team, t.elo]))
    const ratesOf = new Map(teams.map((t) => [t.team, t.rates]))

    const playFixture = (home: string, away: string) => {
      const p = predictMatch({
        eloHome: eloOf.get(home)!,
        eloAway: eloOf.get(away)!,
        home: ratesOf.get(home) ?? null,
        away: ratesOf.get(away) ?? null,
      })
      const hg = samplePoisson(p.lambdaHome, rand)
      const ag = samplePoisson(p.lambdaAway, rand)
      const h = state.get(home)!
      const a = state.get(away)!
      h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg
      h.played++; a.played++
      if (hg > ag) h.pts += 3
      else if (hg < ag) a.pts += 3
      else { h.pts += 1; a.pts += 1 }
    }

    for (const f of remainingRegular) playFixture(f.home, f.away)

    type Entry = [string, { pts: number; gf: number; ga: number; played: number }]
    const byTable = (x: Entry, y: Entry) =>
      y[1].pts - x[1].pts ||
      y[1].gf - y[1].ga - (x[1].gf - x[1].ga) ||
      y[1].gf - x[1].gf ||
      (rand() < 0.5 ? -1 : 1)
    const rank = () => [...state.entries()].sort(byTable)
    // upper half first, each half ordered on its own table
    const rankHalves = () =>
      [...state.entries()].sort(
        (x, y) =>
          (groups!.get(x[0]) === 'nedri' ? 1 : 0) - (groups!.get(y[0]) === 'nedri' ? 1 : 0) ||
          byTable(x, y),
      )

    // Split phase (Besta deild only) if not already complete in input state
    const needsSplit = !groups && split && [...state.values()].some(
      (s) => s.played < REGULAR_ROUNDS_GAMES + 5,
    )
    if (needsSplit && n === 12) {
      const ranked = rank().map((e) => e[0])
      for (const group of [ranked.slice(0, 6), ranked.slice(6)]) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const already = state.get(group[i])!.played
            if (already >= REGULAR_ROUNDS_GAMES + 5) continue
            if (rand() < 0.5) playFixture(group[i], group[j])
            else playFixture(group[j], group[i])
          }
        }
      }
    }

    for (const [t, st] of state) {
      ptsSum.set(t, ptsSum.get(t)! + st.pts)
      const hist = ptsHist.get(t)!
      hist.set(st.pts, (hist.get(st.pts) ?? 0) + 1)
    }

    ;(groups ? rankHalves() : rank()).forEach(([team], idx) => {
      posCounts.get(team)![idx]++
    })
  }

  /** Lowest final points total reached in at least `q` of the runs. */
  const percentile = (hist: Map<number, number>, q: number) => {
    const target = q * runs
    let cum = 0
    for (const pts of [...hist.keys()].sort((a, b) => a - b)) {
      cum += hist.get(pts)!
      if (cum >= target) return pts
    }
    return 0
  }

  return teams.map((t) => {
    const counts = posCounts.get(t.team)!
    const posProbs = counts.map((c) => c / runs)
    const hist = ptsHist.get(t.team)!
    return {
      team: t.team,
      posProbs,
      pTitle: posProbs[0],
      pEurope: posProbs.slice(0, upSlots).reduce((a, b) => a + b, 0),
      pRelegation: posProbs.slice(n - 2).reduce((a, b) => a + b, 0),
      projectedPoints: ptsSum.get(t.team)! / runs,
      pointsLow: percentile(hist, 0.1),
      pointsHigh: percentile(hist, 0.9),
    }
  })
}

export interface ScorerState {
  name: string
  team: string
  current: number
  perGame: number
  remainingTeamGames: number
}

export interface ScorerSimResult {
  name: string
  current: number
  projected: number
  pWin: number
}

/** Monte Carlo race for top scorer / top assister. */
export function simulateScorerRace(
  players: ScorerState[],
  runs = 10000,
  seed = 987,
): ScorerSimResult[] {
  const rand = mulberry32(seed)
  const wins = new Map<string, number>()
  const totalSum = new Map<string, number>()
  for (const p of players) {
    wins.set(p.name, 0)
    totalSum.set(p.name, 0)
  }
  for (let run = 0; run < runs; run++) {
    let best = -1
    let leaders: string[] = []
    for (const p of players) {
      const extra = samplePoisson(p.perGame * p.remainingTeamGames, rand)
      const total = p.current + extra
      totalSum.set(p.name, totalSum.get(p.name)! + total)
      if (total > best) {
        best = total
        leaders = [p.name]
      } else if (total === best) {
        leaders.push(p.name)
      }
    }
    for (const l of leaders) wins.set(l, wins.get(l)! + 1 / leaders.length)
  }
  return players
    .map((p) => ({
      name: p.name,
      current: p.current,
      projected: totalSum.get(p.name)! / runs,
      pWin: wins.get(p.name)! / runs,
    }))
    .sort((a, b) => b.pWin - a.pWin)
}
