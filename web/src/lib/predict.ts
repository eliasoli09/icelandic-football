import type { Prediction, PredictionFactors } from './types'
import { HFA } from './elo'

// League-wide averages measured from 1,968 KSÍ matches 2019–2025
export const LEAGUE_HOME_AVG = 1.81
export const LEAGUE_AWAY_AVG = 1.483
export const LEAGUE_AVG = (LEAGUE_HOME_AVG + LEAGUE_AWAY_AVG) / 2

export interface TeamSeasonRates {
  gfPerGame: number
  gaPerGame: number
  games: number
  form: string // e.g. 'WDLWW', newest first
}

export interface PredictInput {
  eloHome: number
  eloAway: number
  home: TeamSeasonRates | null // null → Elo-only (e.g. season start)
  away: TeamSeasonRates | null
  h2h?: { homeWins: number; draws: number; awayWins: number }
}

const poisson = (lambda: number, k: number): number => {
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p *= lambda / i
  return p
}

const MIN_GAMES = 5
const MAX_GOALS = 9

/**
 * Expected goals blend: Elo difference sets the baseline strength ratio,
 * current-season attack/defence rates refine it (50/50 blend once a team
 * has MIN_GAMES played). Poisson score matrix turns λs into H/D/A odds.
 */
export function predictMatch(input: PredictInput): Prediction {
  const { eloHome, eloAway, home, away } = input
  const eloEdge = (eloHome + HFA - eloAway) / 800
  const eloFactorHome = 10 ** eloEdge
  const eloFactorAway = 10 ** -eloEdge

  let lambdaHome = LEAGUE_HOME_AVG * eloFactorHome
  let lambdaAway = LEAGUE_AWAY_AVG * eloFactorAway

  if (home && away && home.games >= MIN_GAMES && away.games >= MIN_GAMES) {
    const attackHome = home.gfPerGame / LEAGUE_AVG
    const defAway = away.gaPerGame / LEAGUE_AVG
    const attackAway = away.gfPerGame / LEAGUE_AVG
    const defHome = home.gaPerGame / LEAGUE_AVG
    lambdaHome = LEAGUE_HOME_AVG * (0.5 * eloFactorHome + 0.5 * attackHome * defAway)
    lambdaAway = LEAGUE_AWAY_AVG * (0.5 * eloFactorAway + 0.5 * attackAway * defHome)
  }

  lambdaHome = Math.min(Math.max(lambdaHome, 0.15), 6)
  lambdaAway = Math.min(Math.max(lambdaAway, 0.15), 6)

  let pHome = 0
  let pDraw = 0
  let pAway = 0
  const scorelines: { home: number; away: number; p: number }[] = []
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = poisson(lambdaHome, i) * poisson(lambdaAway, j)
      scorelines.push({ home: i, away: j, p })
      if (i > j) pHome += p
      else if (i === j) pDraw += p
      else pAway += p
    }
  }
  const total = pHome + pDraw + pAway
  scorelines.sort((a, b) => b.p - a.p)

  const factors: PredictionFactors = {
    eloHome: Math.round(eloHome),
    eloAway: Math.round(eloAway),
    eloDiff: Math.round(eloHome - eloAway),
    formHome: home?.form ?? '',
    formAway: away?.form ?? '',
    gfHome: home ? round2(home.gfPerGame) : 0,
    gaHome: home ? round2(home.gaPerGame) : 0,
    gfAway: away ? round2(away.gfPerGame) : 0,
    gaAway: away ? round2(away.gaPerGame) : 0,
    h2h: input.h2h ?? { homeWins: 0, draws: 0, awayWins: 0 },
    homeAdvantage: round2(LEAGUE_HOME_AVG / LEAGUE_AWAY_AVG),
  }

  return {
    pHome: pHome / total,
    pDraw: pDraw / total,
    pAway: pAway / total,
    lambdaHome,
    lambdaAway,
    topScorelines: scorelines.slice(0, 5).map((s) => ({ ...s, p: s.p / total })),
    factors,
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Sample a scoreline from the model — used by the Monte Carlo simulator. */
export function samplePoisson(lambda: number, rand: () => number): number {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rand()
  } while (p > L)
  return k - 1
}
