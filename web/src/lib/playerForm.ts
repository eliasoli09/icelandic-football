/**
 * What the squad says about the next match.
 *
 * Elo knows only results. Two things it cannot see are how well a club has
 * been creating and conceding chances lately, and who is unavailable this
 * weekend. Both come from player-level data.
 *
 * Fitted walk-forward on 1,308 Premier League matches, 2022/23 to 2026/27,
 * with ratings that only ever saw finished games:
 *
 *   Elo alone                 0.98769
 *   + expected-goals form     0.98181
 *   + availability            0.98148
 *
 * The combined gain over Elo alone is 0.00621 of log loss, 95% interval
 * ±0.00464. Small, but it holds on a held-out slice as well: the 381 matches
 * from August 2025 on go from 1.02421 to 1.02068.
 */

/** How strongly expected-goals form pulls the Elo expectation. Swept 0 to 1. */
export const XG_WEIGHT = 0.3
/** Matches for expected-goals form to lose half its weight. */
export const XG_HALF_LIFE = 6
/** Form is only trusted once a club has this many matches of it. */
export const XG_MIN_MATCHES = 6
/** A summer of transfers makes last season's form less relevant, not void. */
export const SEASON_PULL = 0.35
/**
 * What a missing player actually costs. A club short 20% of its expected
 * involvement loses about 4% of its goal expectation, because replacements do
 * most of the job. Fitted at 0.2 on matches before August 2025 and confirmed
 * on the ones after.
 */
export const ABSENCE_COST = 0.2
/** Half-life, in matches, for how much of a club's output a player carries. */
export const PLAYER_HALF_LIFE = 8

const decay = (halfLife: number) => 1 - Math.pow(0.5, 1 / halfLife)

export interface TeamXg {
  /** expected goals created per match, as a ratio of the league average */
  attack: number
  /** expected goals allowed per match, as a ratio of the league average */
  defence: number
  matches: number
}

/**
 * Rolling expected-goals form. Holds raw per-match averages internally and
 * reports them relative to the league, so a caller can mix competitions.
 */
export class XgForm {
  private teams = new Map<string, { att: number; def: number; n: number }>()
  private readonly w: number

  constructor(
    private readonly leagueAverage: number,
    halfLife = XG_HALF_LIFE,
  ) {
    this.w = decay(halfLife)
  }

  private slot(team: string) {
    let v = this.teams.get(team)
    if (!v) {
      v = { att: this.leagueAverage, def: this.leagueAverage, n: 0 }
      this.teams.set(team, v)
    }
    return v
  }

  /** null until the club has enough history to be worth trusting */
  get(team: string): TeamXg | null {
    const v = this.teams.get(team)
    if (!v || v.n < XG_MIN_MATCHES) return null
    return { attack: v.att / this.leagueAverage, defence: v.def / this.leagueAverage, matches: v.n }
  }

  record(team: string, xgFor: number, xgAgainst: number) {
    const v = this.slot(team)
    v.att += (xgFor - v.att) * this.w
    v.def += (xgAgainst - v.def) * this.w
    v.n++
  }

  newSeason(pull = SEASON_PULL) {
    for (const v of this.teams.values()) {
      v.att += (this.leagueAverage - v.att) * pull
      v.def += (this.leagueAverage - v.def) * pull
    }
  }
}

/**
 * How much of a club's attacking output is unavailable, as a share between 0
 * and 1. `weight` is how much of the club's recent expected involvement each
 * player carries; `absent` is the fraction of him that will be missing — 1 for
 * injured or suspended, less for a doubt.
 */
export function missingShare(squad: { weight: number; absent: number }[]): number {
  let total = 0
  let out = 0
  for (const p of squad) {
    if (!(p.weight > 0)) continue
    total += p.weight
    out += p.weight * Math.min(1, Math.max(0, p.absent))
  }
  return total > 0 ? out / total : 0
}

/** The multiplier a club's goal expectation earns for who is missing. */
export const availability = (share: number, cost = ABSENCE_COST) =>
  1 - cost * Math.min(1, Math.max(0, share))

/**
 * Pull an Elo goal expectation towards what expected-goals form implies, then
 * discount for absences. `base` and `form` are goal expectations for the same
 * side of the same match.
 */
export function adjustLambda(
  base: number,
  form: number | null,
  share = 0,
  weight = XG_WEIGHT,
): number {
  const blended = form === null ? base : base * (1 - weight) + form * weight
  return blended * availability(share)
}

/** A player's share of his club's output, decayed over the matches he plays. */
export class PlayerWeights {
  private w = new Map<string, number>()
  private readonly rate = decay(PLAYER_HALF_LIFE)

  get(team: string, player: string) {
    return this.w.get(`${team}|${player}`) ?? 0
  }

  record(team: string, player: string, involvement: number) {
    const k = `${team}|${player}`
    const prev = this.w.get(k) ?? 0
    this.w.set(k, prev + (involvement - prev) * this.rate)
  }
}
