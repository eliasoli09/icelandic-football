import { runElo, eloSpread, type EloGame, type EloParams } from './elo'

/** First season of the main test window; nothing from it on may choose parameters. */
export const TEST_FROM = 2015

export interface Pred { p: number; s: number; spread: number; margin: number }
export interface Score { n: number; logLoss: number; brier: number; acc: number; spreadMae: number }

const EPS = 1e-12
export const ll = (p: number, s: number) => -(s * Math.log(Math.max(p, EPS)) + (1 - s) * Math.log(Math.max(1 - p, EPS)))

export function score(preds: Pred[]): Score {
  const n = preds.length
  const decided = preds.filter((x) => x.s !== 0.5 && x.p !== 0.5)
  return {
    n,
    logLoss: preds.reduce((t, x) => t + ll(x.p, x.s), 0) / n,
    brier: preds.reduce((t, x) => t + (x.p - x.s) ** 2, 0) / n,
    acc: decided.filter((x) => (x.p > 0.5) === (x.s === 1)).length / decided.length,
    spreadMae: preds.reduce((t, x) => t + Math.abs(x.spread - x.margin), 0) / n,
  }
}

export const GRID = {
  K: [15, 20, 25, 30, 35],
  HFA: [20, 30, 40, 48, 55, 65, 75],
  R: [0.2, 1 / 3, 0.4, 0.5, 0.6, 0.7],
  BYE: [0, 15, 25, 35, 50, 65],
}

/** Model predictions for the played games of [from, to], from a run over everything. */
export function modelPreds(games: EloGame[], params: EloParams, from: number, to: number): (Pred & { game_id: string })[] {
  return runElo(games, params).records
    .filter((r) => r.season >= from && r.season <= to)
    .map((r) => ({ game_id: r.game_id, p: r.pHome, s: r.margin > 0 ? 1 : r.margin < 0 ? 0 : 0.5, spread: eloSpread(r.diff), margin: r.margin }))
}

/** Grid search on log loss. Throws if the tuning window reaches the seasons it will be tested on. */
export function tune(games: EloGame[], from: number, to: number, testFrom = TEST_FROM, grid = GRID): { params: EloParams; logLoss: number } {
  if (to >= testFrom) throw new Error(`Stillingar má aðeins velja á tímabilum fyrir ${testFrom}, ekki til ${to}`)
  let best = { params: { K: 0, HFA: 0, R: 0, BYE: 0 }, logLoss: Infinity }
  for (const K of grid.K) for (const HFA of grid.HFA) for (const R of grid.R) for (const BYE of grid.BYE) {
    const params = { K, HFA, R, BYE }
    const l = score(modelPreds(games, params, from, to)).logLoss
    if (l < best.logLoss) best = { params, logLoss: l }
  }
  return best
}

/** Mean paired difference with a 95% interval. */
export function pairedDiff(a: number[], b: number[]): { mean: number; lo: number; hi: number } {
  const d = a.map((x, i) => x - b[i])
  const mean = d.reduce((t, x) => t + x, 0) / d.length
  const sd = Math.sqrt(d.reduce((t, x) => t + (x - mean) ** 2, 0) / (d.length - 1))
  const half = (1.96 * sd) / Math.sqrt(d.length)
  return { mean, lo: mean - half, hi: mean + half }
}

/** Pick the candidate with the lowest score. Same guard as `tune`: the window must end before the test seasons. */
export function tuneBy<T>(candidates: T[], run: (c: T) => number, to: number, testFrom = TEST_FROM): { best: T; logLoss: number } {
  if (to >= testFrom) throw new Error(`Stillingar má aðeins velja á tímabilum fyrir ${testFrom}, ekki til ${to}`)
  let best = { best: candidates[0], logLoss: Infinity }
  for (const c of candidates) { const l = run(c); if (l < best.logLoss) best = { best: c, logLoss: l } }
  return best
}
