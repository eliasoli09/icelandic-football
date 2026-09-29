import { mulberry32 } from '../simulate'
import { samplePoisson } from '../predict'
import type { SplitGroup } from '../split'

/** What the reader has decided about a match, if anything. */
export type Pick =
  | { kind: 'score'; home: number; away: number }
  | { kind: 'outcome'; pick: 'home' | 'draw' | 'away' }

export interface WhatIfTeam {
  id: number
  points: number
  gf: number
  ga: number
  played: number
  /** which half of the split, once KSÍ has published it */
  group: SplitGroup | null
}

/**
 * A match still to be played. The two expectations are the site's own model
 * output for this exact fixture, so a run with nothing chosen is the same
 * model the front page shows - only run in the reader's browser.
 */
export interface WhatIfFixture {
  id: number
  home: number
  away: number
  lambdaHome: number
  lambdaAway: number
}

export interface WhatIfResult {
  id: number
  posProbs: number[]
  pTitle: number
  pEurope: number
  pRelegation: number
  projectedPoints: number
  pointsLow: number
  pointsHigh: number
}

/** Tries before a conditioned draw gives up and takes the plainest score. */
const TRIES = 80

/**
 * Plays out the rest of the season many times. A match the reader has given a
 * score keeps that score in every run; one where only the winner is named has
 * its score drawn from the model until it agrees with that winner, so the
 * goals are still the model's own; the rest are played by the model outright.
 */
export function simulateRest(
  teams: WhatIfTeam[],
  fixtures: WhatIfFixture[],
  picks: Map<number, Pick>,
  opts: { runs?: number; seed?: number; upSlots?: number } = {},
): WhatIfResult[] {
  const { runs = 5000, seed = 20260706, upSlots = 3 } = opts
  const rand = mulberry32(seed)
  const n = teams.length
  const split = teams.some((t) => t.group)
  const posCounts = new Map<number, number[]>()
  const ptsSum = new Map<number, number>()
  const ptsHist = new Map<number, Map<number, number>>()
  for (const t of teams) {
    posCounts.set(t.id, Array(n).fill(0))
    ptsSum.set(t.id, 0)
    ptsHist.set(t.id, new Map())
  }

  const goalsFor = (fixture: WhatIfFixture): [number, number] => {
    const pick = picks.get(fixture.id)
    if (pick?.kind === 'score') return [pick.home, pick.away]
    for (let i = 0; i < (pick ? TRIES : 1); i++) {
      const hg = samplePoisson(fixture.lambdaHome, rand)
      const ag = samplePoisson(fixture.lambdaAway, rand)
      if (!pick) return [hg, ag]
      const outcome = hg > ag ? 'home' : hg < ag ? 'away' : 'draw'
      if (outcome === pick.pick) return [hg, ag]
    }
    // a lopsided fixture can refuse the asked-for winner for a long time
    return pick?.pick === 'home' ? [1, 0] : pick?.pick === 'away' ? [0, 1] : [0, 0]
  }

  for (let run = 0; run < runs; run++) {
    const state = new Map(teams.map((t) => [t.id, { pts: t.points, gf: t.gf, ga: t.ga, played: t.played }]))
    for (const fixture of fixtures) {
      const [hg, ag] = goalsFor(fixture)
      const h = state.get(fixture.home)
      const a = state.get(fixture.away)
      if (!h || !a) continue
      h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg
      h.played++; a.played++
      if (hg > ag) h.pts += 3
      else if (hg < ag) a.pts += 3
      else { h.pts++; a.pts++ }
    }

    type Entry = [number, { pts: number; gf: number; ga: number; played: number }]
    const groupOf = new Map(teams.map((t) => [t.id, t.group]))
    // the same order the league uses, and a coin toss where even that is level
    const byTable = (x: Entry, y: Entry) =>
      y[1].pts - x[1].pts ||
      y[1].gf - y[1].ga - (x[1].gf - x[1].ga) ||
      y[1].gf - x[1].gf ||
      (rand() < 0.5 ? -1 : 1)
    const ranked = [...state.entries()].sort((x, y) =>
      split
        ? (groupOf.get(x[0]) === 'nedri' ? 1 : 0) - (groupOf.get(y[0]) === 'nedri' ? 1 : 0) || byTable(x, y)
        : byTable(x, y))

    for (const [id, st] of state) {
      ptsSum.set(id, ptsSum.get(id)! + st.pts)
      const hist = ptsHist.get(id)!
      hist.set(st.pts, (hist.get(st.pts) ?? 0) + 1)
    }
    ranked.forEach(([id], place) => { posCounts.get(id)![place]++ })
  }

  /** The lowest points total reached in at least this share of the runs. */
  const percentile = (hist: Map<number, number>, q: number) => {
    let cum = 0
    for (const pts of [...hist.keys()].sort((a, b) => a - b)) {
      cum += hist.get(pts)!
      if (cum >= q * runs) return pts
    }
    return 0
  }

  return teams.map((t) => {
    const posProbs = posCounts.get(t.id)!.map((c) => c / runs)
    return {
      id: t.id,
      posProbs,
      pTitle: posProbs[0],
      pEurope: posProbs.slice(0, upSlots).reduce((a, b) => a + b, 0),
      pRelegation: posProbs.slice(n - 2).reduce((a, b) => a + b, 0),
      projectedPoints: ptsSum.get(t.id)! / runs,
      pointsLow: percentile(ptsHist.get(t.id)!, 0.1),
      pointsHigh: percentile(ptsHist.get(t.id)!, 0.9),
    }
  })
}

/** Points a chosen result is worth, for the line under the fixture. */
export const pickPoints = (pick: Pick | undefined): [number, number] =>
  !pick ? [0, 0]
    : pick.kind === 'score'
      ? pick.home > pick.away ? [3, 0] : pick.home < pick.away ? [0, 3] : [1, 1]
      : pick.pick === 'home' ? [3, 0] : pick.pick === 'away' ? [0, 3] : [1, 1]
