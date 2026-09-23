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
  pRelegation: number // the places the league sends down
  projectedPoints: number // mean final points across runs
  pointsLow: number // 10th percentile - a bad run of results
  pointsHigh: number // 90th percentile - a good one
}

const REGULAR_ROUNDS_GAMES = 22

/**
 * Simulate the rest of a Besta deild season N times.
 * Remaining regular fixtures are played; if the split phase hasn't happened,
 * the table after 22 rounds splits top 6 / bottom 6, each group playing a
 * single round robin (5 games, points carried). Home side in split games is
 * random - the real KSÍ schedule isn't known in advance.
 */
export function simulateSeason(
  teams: SimTeamState[],
  remainingRegular: SimFixture[],
  runs = 10000,
  seed = 20260706,
  opts: {
    split?: boolean
    upSlots?: number
    /** places relegated: two at home, three in most of the big leagues */
    downSlots?: number
    /**
     * Frozen split halves, once KSÍ has published them. The halves never meet
     * again, so they are ranked separately - the upper half takes places 1–6
     * and the lower half 7–12 however the points fall. When this is set the
     * caller is expected to pass the real split fixtures in `remainingRegular`,
     * so no synthetic split round is generated.
     */
    groups?: Map<string, SplitGroup> | null
    /** league scoring rates, so a sim of one league is not run on another's */
    goals?: { home: number; away: number }
  } = {},
): SeasonSimResult[] {
  const { split = true, upSlots = 3, downSlots = 2, groups = null, goals } = opts
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

  /**
   * Elo and the rates do not move inside a simulation, so a pairing's expected
   * goals are the same in every one of the ten thousand seasons. Working them
   * out once a pairing instead of once a match is the difference between a
   * nightly job that finishes and one that does not.
   */
  const expected = new Map<string, { lambdaHome: number; lambdaAway: number }>()
  const lambdas = (home: string, away: string) => {
    const key = `${home}|${away}`
    let p = expected.get(key)
    if (!p) {
      const full = predictMatch({
        goals,
        eloHome: eloByTeam.get(home)!,
        eloAway: eloByTeam.get(away)!,
        home: ratesByTeam.get(home) ?? null,
        away: ratesByTeam.get(away) ?? null,
      })
      p = { lambdaHome: full.lambdaHome, lambdaAway: full.lambdaAway }
      expected.set(key, p)
    }
    return p
  }
  const eloByTeam = new Map(teams.map((t) => [t.team, t.elo]))
  const ratesByTeam = new Map(teams.map((t) => [t.team, t.rates]))

  for (let run = 0; run < runs; run++) {
    const state = new Map(
      teams.map((t) => [
        t.team,
        { pts: t.points, gf: t.goalsFor, ga: t.goalsAgainst, played: t.played },
      ]),
    )
    const playFixture = (home: string, away: string) => {
      const p = lambdas(home, away)
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
      pRelegation: posProbs.slice(n - downSlots).reduce((a, b) => a + b, 0),
      projectedPoints: ptsSum.get(t.team)! / runs,
      pointsLow: percentile(hist, 0.1),
      pointsHigh: percentile(hist, 0.9),
    }
  })
}

/** Gamma(shape, 1) by Marsaglia and Tsang, on the seeded generator. */
export function sampleGamma(shape: number, rand: () => number): number {
  if (shape < 1) return sampleGamma(shape + 1, rand) * Math.pow(rand() || 1e-12, 1 / shape)
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x = 0, v = 0
    do {
      const u1 = rand() || 1e-12, u2 = rand()
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = rand() || 1e-12
    if (u < 1 - 0.0331 * x * x * x * x) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

export interface ScorerState {
  name: string
  team: string
  current: number
  perGame: number
  remainingTeamGames: number
  /**
   * How many matches the rate rests on. A rate from five matches is a guess
   * and one from twenty-five is not, and the race should sound like it: the
   * rate is drawn afresh in every run from what that many matches support.
   * Left out, the rate is taken as known, which is how it always behaved.
   */
  rateGames?: number
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
      const rate = p.rateGames && p.rateGames > 0
        ? sampleGamma(Math.max(0.5, p.perGame * p.rateGames), rand) / p.rateGames
        : p.perGame
      const extra = samplePoisson(rate * p.remainingTeamGames, rand)
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
