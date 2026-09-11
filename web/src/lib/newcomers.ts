/**
 * A club the rating system has barely seen.
 *
 * Elo starts everyone at 1500 and moves them from there. That is fine in a
 * pool whose average stays near 1500, but the English pool runs from about
 * 1200 in the Championship to 2000 at the top of the Premier League, so 1500
 * is not neutral — it is upper-mid-table Championship. A club promoted from
 * below therefore arrives rated above sides that earned their way to less.
 *
 * The three clubs in this position on 11 September 2026 — Lincoln, Elversberg
 * and Academico Viseu — produced three of the eight largest disagreements with
 * the bookmakers' closing prices, all in the same direction.
 *
 * The fix is a prior, not a guess: a promoted club is placed near the bottom
 * of the division it has joined, and its own record takes over as it plays.
 */

/** Matches of its own before a club's rating is trusted on its own terms. */
export const TRUST_AFTER = 20
/** Where in its new division a promoted club is assumed to belong. */
export const NEWCOMER_QUANTILE = 0.2

/** The rating at a given quantile of a division. */
export function divisionQuantile(ratings: number[], q = NEWCOMER_QUANTILE): number | null {
  const xs = ratings.filter((r) => Number.isFinite(r)).sort((a, b) => a - b)
  if (!xs.length) return null
  const i = Math.min(xs.length - 1, Math.max(0, Math.round(q * (xs.length - 1))))
  return xs[i]
}

/**
 * Blend a club's own rating towards the newcomer prior, in proportion to how
 * little of its own record there is. A club with a full history is untouched.
 */
export function seededRating(
  elo: number,
  ratedMatches: number,
  prior: number | null,
  trustAfter = TRUST_AFTER,
): number {
  if (prior === null || !Number.isFinite(prior)) return elo
  const own = Math.min(1, Math.max(0, ratedMatches / trustAfter))
  return elo * own + prior * (1 - own)
}
