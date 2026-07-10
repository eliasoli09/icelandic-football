/**
 * In-play win probabilities per bet-slip leg.
 *
 * Model: remaining goals follow independent Poisson processes whose rates
 * decay linearly with time played (the standard in-play approach, à la
 * Dixon–Robinson). Pre-match rates come from the site's own Elo→Poisson
 * engine; the current score is a hard fact the remainder is added to.
 *
 * - Yfir/undir mörk:  P over Poisson(λ_rem,total) tail
 * - Úrslit (1X2):     score-difference distribution over remaining goals
 * - Bæði skora:       per-team P(≥1 more) for whoever hasn't scored
 * - Markaskorari:     1 − exp(−share · λ_rem,team), share ≈ hlutur leikmanns
 *
 * Simple by design — no red-card/momentum adjustments. Good enough to give
 * an honest, moving percentage; not a pricing engine.
 */

const MATCH_MINUTES = 93 // 90 + typical stoppage

const pois = (lambda: number, k: number): number => {
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p *= lambda / i
  return p
}

/** P(N ≤ k) for N ~ Poisson(λ). */
const poisCdf = (lambda: number, k: number): number => {
  if (k < 0) return 0
  let sum = 0
  for (let i = 0; i <= k; i++) sum += pois(lambda, i)
  return Math.min(1, sum)
}

export const remainingShare = (minute: number): number =>
  Math.max(0, Math.min(1, (MATCH_MINUTES - minute) / MATCH_MINUTES))

/** P(final total goes over `line`) given current total and remaining rate. */
export function probOver(currentTotal: number, line: number, lambdaRem: number): number {
  const needed = Math.floor(line) + 1 - currentTotal
  if (needed <= 0) return 1
  return 1 - poisCdf(lambdaRem, needed - 1)
}

export function probUnder(currentTotal: number, line: number, lambdaRem: number): number {
  if (currentTotal > line) return 0
  return poisCdf(lambdaRem, Math.floor(line) - currentTotal)
}

/** P(both teams end up having scored). */
export function probBtts(
  goalsHome: number,
  goalsAway: number,
  lambdaHomeRem: number,
  lambdaAwayRem: number,
): number {
  const pHomeScores = goalsHome > 0 ? 1 : 1 - Math.exp(-lambdaHomeRem)
  const pAwayScores = goalsAway > 0 ? 1 : 1 - Math.exp(-lambdaAwayRem)
  return pHomeScores * pAwayScores
}

/** 1X2 probabilities from current score + remaining Poisson rates (90 mín). */
export function prob1X2(
  goalsHome: number,
  goalsAway: number,
  lambdaHomeRem: number,
  lambdaAwayRem: number,
): { p1: number; px: number; p2: number } {
  const MAX = 10
  let p1 = 0
  let px = 0
  let p2 = 0
  for (let h = 0; h <= MAX; h++) {
    const ph = pois(lambdaHomeRem, h)
    for (let a = 0; a <= MAX; a++) {
      const p = ph * pois(lambdaAwayRem, a)
      const diff = goalsHome + h - (goalsAway + a)
      if (diff > 0) p1 += p
      else if (diff === 0) px += p
      else p2 += p
    }
  }
  const total = p1 + px + p2
  return { p1: p1 / total, px: px / total, p2: p2 / total }
}

/** Typical share of a team's goals scored by the picked player. */
export const SCORER_SHARE = 0.3

/** P(player scores before full time), given they haven't yet. */
export function probScorer(lambdaTeamRem: number, share = SCORER_SHARE): number {
  return 1 - Math.exp(-share * lambdaTeamRem)
}

/** Slip-level probability: independent product over unsettled legs. */
export function slipProbability(legProbs: (number | null)[]): number | null {
  const known = legProbs.filter((p): p is number => p !== null)
  if (!known.length) return null
  return known.reduce((acc, p) => acc * p, 1)
}
